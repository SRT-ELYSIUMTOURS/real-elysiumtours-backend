#!/usr/bin/env node
"use strict";

/**
 * E2E Full Flow Test — Real MongoDB, Real API Endpoints
 *
 * Tests all core business flows against the live API gateway,
 * validated against mermaid architecture diagrams 3, 4, 9, 10.
 *
 * Usage: node scripts/testScripts/e2e-full-flow.js
 *
 * Requires:
 *   - MONGO_URI in .env pointing to a real MongoDB (Atlas or local)
 *   - No other server running on PORT (default 3005)
 */

require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");

const E2E_PORT = process.env.E2E_PORT || 3005;
const BASE = `http://localhost:${E2E_PORT}`;

// ── Test state ──
let customerToken = null;
let adminToken = null;
let staffToken = null;

// IDs collected during flow
const state = {
	destinationId: null,
	hotelId: null,
	attractionId: null,
	diningId: null,
	transportProviderId: null,
	vehicleId: null,
	packageId: null,
	pricingTierId: null,
	bookingId: null,
	bookingRef: null,
	paymentId: null,
	transactionRef: null,
	tourRequestId: null,
	quoteId: null,
	dynamicBookingId: null,
	paymentPlanId: null,
	milestoneId: null,
	contractId: null,
	signatureToken: null,
	interestId: null,
	notificationId: null,
	templateId: null,
};

const results = [];
let passed = 0;
let failed = 0;

// ── HTTP helper ──
function request(method, path, body, token) {
	return new Promise((resolve, reject) => {
		const url = new URL(path, BASE);
		const opts = {
			hostname: url.hostname,
			port: url.port,
			path: url.pathname + url.search,
			method,
			headers: { "Content-Type": "application/json" },
		};
		if (token) opts.headers["Authorization"] = `Bearer ${token}`;

		const req = http.request(opts, (res) => {
			let data = "";
			res.on("data", (chunk) => (data += chunk));
			res.on("end", () => {
				try {
					resolve({ status: res.statusCode, body: JSON.parse(data) });
				} catch (e) {
					resolve({ status: res.statusCode, body: data });
				}
			});
		});
		req.on("error", reject);
		if (body) req.write(JSON.stringify(body));
		req.end();
	});
}

const GET = (path, token) => request("GET", path, null, token);
const POST = (path, body, token) => request("POST", path, body, token);
const PUT = (path, body, token) => request("PUT", path, body, token);

// ── Test runner ──
async function test(name, fn) {
	try {
		await fn();
		results.push({ name, status: "PASS" });
		passed++;
		console.log(`  ✓ ${name}`);
	} catch (err) {
		results.push({ name, status: "FAIL", error: err.message });
		failed++;
		console.log(`  ✗ ${name}`);
		console.log(`    Error: ${err.message}`);
	}
}

function assert(condition, msg) {
	if (!condition) throw new Error(msg);
}

// ── DB helpers for test setup ──
async function createUserDirect(email, password, role) {
	const bcrypt = require("bcrypt");
	const hash = await bcrypt.hash(password, 12);
	const db = mongoose.connection.db;
	await db.collection("users").updateOne(
		{ email },
		{
			$set: {
				email,
				password: hash,
				firstName: role.charAt(0).toUpperCase() + role.slice(1),
				lastName: "E2EUser",
				role,
				isVerified: true,
				status: "active",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		},
		{ upsert: true }
	);
}

async function cleanupE2EData() {
	const db = mongoose.connection.db;
	const collections = [
		"bookings", "payments", "paymentplans", "milestones",
		"contracts", "contracttemplates", "tourrequests", "quotes",
		"tourpackages", "packagepricings", "interests", "notifications",
		"hotelpartners", "transportproviders", "vehicles",
		"attractions", "diningpartners", "destinations", "templates",
	];
	for (const col of collections) {
		try { await db.collection(col).deleteMany({}); } catch (e) { /* ignore */ }
	}
	// Clean up E2E-specific users (only those with e2e- prefix emails)
	try { await db.collection("users").deleteMany({ email: /^e2e-/ }); } catch (e) { /* ignore */ }
}

// ══════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════
async function main() {
	console.log("\n══════════════════════════════════════════════════════");
	console.log("  E2E FULL FLOW TEST — Real MongoDB, Real Endpoints  ");
	console.log("══════════════════════════════════════════════════════\n");

	// ── Connect to MongoDB for setup/cleanup ──
	await mongoose.connect(process.env.MONGO_URI);
	console.log("  [setup] Connected to MongoDB for test data management");

	// ── Clean up previous E2E test data ──
	await cleanupE2EData();
	console.log("  [setup] Cleaned up previous E2E data");

	// ── Create test users directly in DB ──
	await createUserDirect("e2e-customer@test.com", "CustPass123!", "customer");
	await createUserDirect("e2e-staff@test.com", "StaffPass123!", "staff");
	await createUserDirect("e2e-admin@test.com", "AdminPass123!", "admin");
	console.log("  [setup] Created 3 test users (customer, staff, admin)\n");

	// ── Start the broker ──
	console.log("  [setup] Starting MoleculerJS broker with all services...");
	process.env.PORT = E2E_PORT;
	const { ServiceBroker } = require("moleculer");
	const brokerConfig = require("../../moleculer.config");
	const broker = new ServiceBroker({
		...brokerConfig,
		logger: { type: "Console", options: { level: "error" } },
	});

	// Load ALL service files
	const serviceFiles = [
		"api", "auth", "user", "rbac",
		"tourPackage", "dynamicTour", "pricingDesk",
		"booking", "payment", "paymentPlan", "contract", "interest",
		"hotelPartner", "transport", "attraction", "dining", "destination",
		"email", "notification", "template", "media",
		"organization", "superAdmin", "cms", "review", "contact",
	];
	for (const name of serviceFiles) {
		broker.loadService(`./services/${name}.service.js`);
	}

	// Load ALL model files
	const modelPaths = [
		"user/user", "rbac/role", "rbac/permission", "rbac/rolePermission",
		"tour/tourPackage", "tour/packagePricing", "tour/tourRequest", "tour/quote",
		"booking/booking", "booking/payment",
		"partner/hotelPartner", "partner/transportProvider", "partner/vehicle",
		"partner/attraction", "partner/diningPartner",
		"destination/destination",
		"contract/contract", "contract/contractTemplate",
		"paymentPlan/paymentPlan", "paymentPlan/milestone",
		"interest/interest",
		"notification/notification",
		"template/template",
		"organization/organization",
		"review/review",
		"subscriber/subscriber",
		"tour/waitlistEntry",
	];
	for (const p of modelPaths) {
		broker.loadService(`./services/models/${p}.model.js`);
	}

	await broker.start();
	console.log(`  [setup] Broker started on port ${E2E_PORT}\n`);

	// Override Paystack mixin methods with E2E mocks
	const paymentSvc = broker.getLocalService("payment");
	paymentSvc.initializeTransaction = async () => ({
		authorization_url: "https://checkout.paystack.com/e2e-test",
		access_code: "e2e_access_code",
		reference: "e2e-ref-123",
	});
	paymentSvc.verifyTransaction = async () => ({
		status: "success",
		amount: 100000,
		currency: "GHS",
		reference: "e2e-ref-123",
		paid_at: new Date().toISOString(),
		channel: "card",
	});
	paymentSvc.createRefund = async () => ({ status: "processed" });
	paymentSvc.validateWebhookSignature = () => true;
	console.log("  [setup] Paystack methods overridden with E2E mocks");

	// Wait for all services to be ready
	await new Promise((r) => setTimeout(r, 6000));

	// ─────────────────────────────────────────
	// PHASE A: Authentication & Setup
	// ─────────────────────────────────────────
	console.log("─── Phase A: Authentication ───");

	await test("A1: Health check", async () => {
		const res = await GET("/health");
		assert(res.status === 200, `Expected 200, got ${res.status}`);
		assert(res.body.status === "ok", "Health status not ok");
	});

	await test("A2: Register new customer", async () => {
		const res = await POST("/api/v1/auth/register", {
			email: "e2e-newcust@test.com",
			password: "NewCust123!",
			firstName: "New",
			lastName: "Customer",
		});
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body.userId, "No userId returned");
	});

	await test("A3: Login as customer", async () => {
		const res = await POST("/api/v1/auth/login", {
			email: "e2e-customer@test.com",
			password: "CustPass123!",
		});
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body.accessToken, "No access token");
		assert(res.body.user.role === "customer", `Expected customer role, got ${res.body.user.role}`);
		customerToken = res.body.accessToken;
	});

	await test("A4: Login as staff", async () => {
		const res = await POST("/api/v1/auth/login", {
			email: "e2e-staff@test.com",
			password: "StaffPass123!",
		});
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body.user.role === "staff", `Expected staff role`);
		staffToken = res.body.accessToken;
	});

	await test("A5: Login as admin", async () => {
		const res = await POST("/api/v1/auth/login", {
			email: "e2e-admin@test.com",
			password: "AdminPass123!",
		});
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body.user.role === "admin", `Expected admin role`);
		adminToken = res.body.accessToken;
	});

	await test("A6: Customer gets profile", async () => {
		const res = await GET("/api/v1/users/profile", customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
		assert(res.body.email === "e2e-customer@test.com", "Wrong email");
	});

	await test("A7: Unauthenticated request blocked (401)", async () => {
		const res = await GET("/api/v1/users/profile");
		assert(res.status === 401, `Expected 401, got ${res.status}`);
	});

	await test("A8: Customer blocked from admin action (403)", async () => {
		const res = await GET("/api/v1/users", customerToken);
		assert(res.status === 403, `Expected 403, got ${res.status}`);
	});

	// ─────────────────────────────────────────
	// PHASE B: Partner & Destination Setup (Admin)
	// Diagram 6 — Data Model setup
	// ─────────────────────────────────────────
	console.log("\n─── Phase B: Admin sets up partners & destinations (Diagram 6) ───");

	await test("B1: Admin creates destination (Cape Coast)", async () => {
		const res = await POST("/api/v1/destinations", {
			name: "Cape Coast",
			region: "Central Region",
			description: "Historic coastal city with castles and canopy walks",
			highlights: ["Historical", "Beach", "Castle"],
		}, adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body._id, "No destination ID");
		assert(res.body.slug === "cape-coast", `Expected slug cape-coast, got ${res.body.slug}`);
		state.destinationId = res.body._id;
	});

	await test("B2: Admin creates hotel partner", async () => {
		const res = await POST("/api/v1/partners/hotels", {
			name: "Cape Coast Beach Resort",
			destinationId: state.destinationId,
			tier: "premium",
			commissionRate: 15,
			contactInfo: { contactPerson: "John Mensah", phone: "+233244000001", email: "hotel@resort.com" },
			rateData: { standardRate: 250 },
			amenities: ["Pool", "WiFi", "Restaurant"],
		}, adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		state.hotelId = res.body._id;
	});

	await test("B3: Admin creates attraction", async () => {
		const res = await POST("/api/v1/partners/attractions", {
			name: "Cape Coast Castle",
			destinationId: state.destinationId,
			category: "Historical",
			entryFee: 50,
			description: "UNESCO World Heritage Site",
		}, adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		state.attractionId = res.body._id;
	});

	await test("B4: Admin creates dining partner", async () => {
		const res = await POST("/api/v1/partners/dining", {
			name: "Oasis Beach Restaurant",
			destinationId: state.destinationId,
			cuisineType: "Seafood",
			tier: "standard",
			commissionRate: 10,
			menuOptions: [{ name: "Seafood Platter", description: "Fresh catch", pricePerPerson: 80 }],
		}, adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		state.diningId = res.body._id;
	});

	await test("B5: Admin creates transport provider", async () => {
		const res = await POST("/api/v1/partners/transport/providers", {
			companyName: "GhanaRide Tours",
			contactPerson: "Kwame Asante",
			phone: "+233244000002",
			email: "info@ghanaride.com",
		}, adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		state.transportProviderId = res.body._id;
	});

	await test("B6: Admin adds vehicle", async () => {
		const res = await POST("/api/v1/partners/transport/vehicles", {
			providerId: state.transportProviderId,
			type: "minibus",
			capacity: 15,
			basePricePerDay: 500,
			description: "15-seater minibus with AC",
		}, adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		state.vehicleId = res.body._id;
	});

	await test("B7: Customer can list hotels by destination (public)", async () => {
		const res = await GET(`/api/v1/partners/hotels/destination/${state.destinationId}`, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
		assert(Array.isArray(res.body), "Expected array");
		assert(res.body.length >= 1, "Expected at least 1 hotel");
	});

	// ─────────────────────────────────────────
	// PHASE C-PREP: Seed templates early (needed for contract auto-generation)
	// ─────────────────────────────────────────
	console.log("\n─── Seeding templates (needed before booking creation) ───");

	await POST("/api/v1/admin/templates/seed", {}, adminToken);
	await POST("/api/v1/admin/contract-templates/seed", {}, adminToken);
	console.log("  [setup] Templates and contract templates seeded");

	// ─────────────────────────────────────────
	// PHASE C: Pre-Packaged Tour Flow (Diagram 3)
	// ─────────────────────────────────────────
	console.log("\n─── Phase C: Pre-Packaged Tour Flow (Diagram 3) ───");

	await test("C1: Admin creates tour package", async () => {
		const res = await POST("/api/v1/tours/packages", {
			title: "Cape Coast Heritage Weekend",
			description: "3-day cultural immersion in Cape Coast",
			destinationId: state.destinationId,
			hotelPartnerId: state.hotelId,
			attractionIds: [state.attractionId],
			diningIds: [state.diningId],
			transportType: "minibus",
			durationDays: 3,
			sellingMode: "group_buy",
			highlights: ["Castle Tour", "Beach Day", "Local Cuisine"],
			inclusions: ["Hotel", "Transport", "Meals", "Entry Fees"],
			itinerary: [
				{ day: 1, title: "Arrival & Castle", description: "Arrive, visit Cape Coast Castle", activities: ["Transfer", "Castle Tour"] },
				{ day: 2, title: "Beach & Culture", description: "Beach activities and cultural experiences", activities: ["Beach", "Market Visit"] },
				{ day: 3, title: "Departure", description: "Canopy walk and departure", activities: ["Canopy Walk", "Transfer"] },
			],
			pricingTiers: [
				{ minGroupSize: 1, maxGroupSize: 5, pricePerPerson: 1500, label: "Small Group" },
				{ minGroupSize: 6, maxGroupSize: 10, pricePerPerson: 1200, label: "Medium Group" },
				{ minGroupSize: 11, maxGroupSize: 20, pricePerPerson: 900, label: "Large Group" },
			],
		}, adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body._id, "No package ID");
		state.packageId = res.body._id;
	});

	await test("C2: Admin publishes the package", async () => {
		const res = await PUT(`/api/v1/tours/packages/${state.packageId}`, {
			status: "published",
		}, adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	await test("C3: Customer browses packages (Diagram 3 Step 1)", async () => {
		const res = await GET("/api/v1/tours/packages", customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
		assert(Array.isArray(res.body), "Expected array");
		assert(res.body.length >= 1, "Expected at least 1 package");
	});

	await test("C4: Customer views package detail (Diagram 3 Step 2)", async () => {
		const res = await GET(`/api/v1/tours/packages/${state.packageId}`, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
		assert(res.body.title === "Cape Coast Heritage Weekend", "Wrong title");
		assert(res.body.destinationId, "No destinationId");
	});

	await test("C5: Customer creates booking (Diagram 3 Step 3)", async () => {
		const res = await POST("/api/v1/bookings", {
			packageId: state.packageId,
			groupSize: 4,
			tourDate: "2026-06-15",
		}, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body.bookingRef, "No bookingRef");
		// On-request hotel → booking starts as pending_partner_confirmation
		const validStatuses = ["pending_payment", "pending_partner_confirmation"];
		assert(validStatuses.includes(res.body.status), `Expected pending_payment or pending_partner_confirmation, got ${res.body.status}`);
		assert(res.body.commitmentFeeAmount > 0, "No commitment fee calculated");
		assert(res.body.totalAmount > 0, "No total amount");
		state.bookingId = res.body._id;
		state.bookingRef = res.body.bookingRef;
		console.log(`    [info] Booking ${state.bookingRef}, status: ${res.body.status}, total: ${res.body.totalAmount} GHS`);

		// If pending_partner_confirmation, extract partnerId for confirmation step
		if (res.body.status === "pending_partner_confirmation" && res.body.partnerConfirmations) {
			const pending = res.body.partnerConfirmations.find(pc => pc.status === "pending");
			if (pending) state.pendingPartnerId = pending.partnerId;
		}
	});

	// If booking needs partner confirmation, staff confirms it
	await test("C5b: Staff confirms partner (on-request flow)", async () => {
		if (!state.pendingPartnerId) {
			console.log("    [skip] No partner confirmation needed (free-sale)");
			return;
		}
		const res = await POST(`/api/v1/bookings/${state.bookingId}/confirm-partner`, {
			bookingId: state.bookingId,
			partnerId: state.pendingPartnerId,
			notes: "Partner confirmed via phone call",
		}, staffToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		// After all partners confirmed, booking should transition to pending_payment
		const booking = await GET(`/api/v1/bookings/${state.bookingId}`, staffToken);
		assert(booking.body.status === "pending_payment", `Expected pending_payment after confirmation, got ${booking.body.status}`);
		console.log("    [info] Partner confirmed, booking now pending_payment");
	});

	// Wait for async event handlers (contract auto-generation via booking.created event)
	await new Promise((r) => setTimeout(r, 2000));

	await test("C6: Customer initiates payment (Diagram 3 Step 4)", async () => {
		const res = await POST("/api/v1/payments/initiate", {
			bookingId: state.bookingId,
			paymentType: "commitment_fee",
		}, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body.authorizationUrl, "No authorization URL");
		assert(res.body.transactionRef, "No transaction ref");
		state.paymentId = res.body.paymentId;
		state.transactionRef = res.body.transactionRef;
	});

	await test("C7: Payment verified → booking confirmed (Diagram 3 Step 5)", async () => {
		const res = await POST("/api/v1/payments/verify", {
			reference: state.transactionRef,
		}, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		// Check booking is now confirmed
		assert(
			res.body.booking && res.body.booking.status === "confirmed",
			`Expected booking status confirmed, got ${res.body.booking ? res.body.booking.status : "no booking"}`
		);
	});

	await test("C8: Customer can view confirmed booking", async () => {
		const res = await GET(`/api/v1/bookings/${state.bookingId}`, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
		assert(res.body.status === "confirmed", `Expected confirmed, got ${res.body.status}`);
	});

	// ─────────────────────────────────────────
	// PHASE D: Payment Plan & Contract (Diagram 9 lifecycle)
	// ─────────────────────────────────────────
	console.log("\n─── Phase D: Payment Plan & Contract (Diagram 9) ───");

	await test("D1: Payment plan was auto-created for booking", async () => {
		const res = await GET(`/api/v1/payment-plans/booking/${state.bookingId}`, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body.paymentPlan || res.body._id, "No payment plan found");
		const plan = res.body.paymentPlan || res.body;
		state.paymentPlanId = plan._id;
		assert(plan.totalAmount > 0, "Plan totalAmount should be > 0");
	});

	await test("D2: Payment plan has milestones", async () => {
		const res = await GET(`/api/v1/payment-plans/${state.paymentPlanId}/milestones`, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		const milestones = Array.isArray(res.body) ? res.body : res.body.milestones;
		assert(milestones && milestones.length >= 2, `Expected 2+ milestones, got ${milestones ? milestones.length : 0}`);
		// Find first unpaid milestone
		const unpaid = milestones.find((m) => m.status === "pending");
		if (unpaid) state.milestoneId = unpaid._id;
	});

	await test("D3: Contract was auto-generated for booking", async () => {
		const res = await GET(`/api/v1/contracts/booking/${state.bookingId}`, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		const contract = res.body;
		assert(contract._id, "No contract found");
		state.contractId = contract._id;
		state.signatureToken = contract.signatureToken;
	});

	await test("D4: Staff sends contract to customer", async () => {
		assert(state.contractId, "No contract ID — contract may not have been generated");
		const res = await POST(`/api/v1/contracts/${state.contractId}/send`, {}, staffToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body.status === "sent", `Expected sent status, got ${res.body.status}`);
	});

	await test("D5: Customer accepts contract with signature token", async () => {
		if (!state.signatureToken) {
			throw new Error("No signature token — contract may not have been generated");
		}
		const res = await POST("/api/v1/contracts/accept", {
			signatureToken: state.signatureToken,
		}, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	await test("D6: Contract acceptance verified", async () => {
		const res = await GET(`/api/v1/contracts/verify/${state.bookingId}`, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
		assert(res.body.accepted === true, `Expected accepted: true, got ${res.body.accepted}`);
	});

	// ─────────────────────────────────────────
	// PHASE E: Dynamic Tour Flow (Diagram 4)
	// ─────────────────────────────────────────
	console.log("\n─── Phase E: Dynamic Tour / Build-Your-Own (Diagram 4) ───");

	await test("E1: Customer browses destinations (Diagram 4 Step 1)", async () => {
		const res = await GET("/api/v1/destinations", customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
		assert(Array.isArray(res.body) && res.body.length >= 1, "No destinations");
	});

	await test("E2: Customer gets options for Cape Coast (Diagram 4 Step 2)", async () => {
		// dynamicTour.getOptions expects destinationId
		const res = await GET(`/api/v1/tours/packages?destinationId=${state.destinationId}`, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
	});

	await test("E3: Customer builds tour request (Diagram 4 Step 3)", async () => {
		// Step 1: Build the tour request (creates in draft status)
		const buildRes = await POST("/api/v1/tours/dynamic/build", {
			destinations: [{
				destinationId: state.destinationId,
				nightsStay: 3,
				hotelPreference: "premium",
				selectedAttractions: [state.attractionId],
				diningPreferences: [state.diningId],
			}],
			groupSize: 8,
			transportPreference: "minibus",
			preferredStartDate: "2026-07-20",
			durationDays: 3,
			specialRequests: "Need vegetarian options",
		}, customerToken);
		assert(buildRes.status === 200, `Build expected 200, got ${buildRes.status}: ${JSON.stringify(buildRes.body)}`);
		state.tourRequestId = buildRes.body._id;
		assert(state.tourRequestId, `No tour request ID from build: ${JSON.stringify(buildRes.body)}`);

		// Step 2: Submit the tour request for pricing (creates a quote)
		const submitRes = await POST("/api/v1/tours/dynamic/submit", {
			tourRequestId: state.tourRequestId,
		}, customerToken);
		assert(submitRes.status === 200, `Submit expected 200, got ${submitRes.status}: ${JSON.stringify(submitRes.body)}`);
		const body = submitRes.body;
		state.quoteId = body.quote ? body.quote._id : body.quoteId;
		console.log(`    [info] Tour request: ${state.tourRequestId}, Quote: ${state.quoteId || "pending"}`);
	});

	await test("E4: Staff views pricing queue (Diagram 4 Step 4)", async () => {
		const res = await GET("/api/v1/pricing-desk/queue", staffToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		const quotes = res.body.quotes || res.body;
		assert(Array.isArray(quotes), "Expected quotes array");
		// Find our quote
		if (!state.quoteId && quotes.length > 0) {
			state.quoteId = quotes[0]._id;
		}
		assert(state.quoteId, "No quote found in queue");
	});

	await test("E5: Staff assigns quote to self", async () => {
		const res = await POST(`/api/v1/pricing-desk/quotes/${state.quoteId}/assign`, {}, staffToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	await test("E6: Staff submits quote with cost breakdown (Diagram 10)", async () => {
		const res = await POST(`/api/v1/pricing-desk/quotes/${state.quoteId}/submit`, {
			costBreakdown: {
				transport: { description: "15-seater minibus x 3 days", amount: 1500 },
				accommodation: { description: "Cape Coast Beach Resort x 3 nights x 4 rooms", amount: 3000 },
				attractions: { description: "Cape Coast Castle x 8 people", amount: 400 },
				dining: { description: "Seafood platter x 8 people x 3 days", amount: 1920 },
				platformFee: { description: "20% platform fee", amount: 1364 },
				subtotal: 6820,
				margin: 1364,
				marginPercent: 20,
			},
			totalPrice: 8184,
			pricePerPerson: 1023,
		}, staffToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	await test("E7: Customer accepts the quote (Diagram 4 — Accept)", async () => {
		const res = await POST(`/api/v1/pricing-desk/quotes/${state.quoteId}/accept`, {}, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	await test("E8: Customer creates booking from accepted quote", async () => {
		const res = await POST("/api/v1/bookings", {
			quoteId: state.quoteId,
			groupSize: 8,
			tourDate: "2026-07-20",
		}, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body.bookingType === "dynamic", `Expected dynamic, got ${res.body.bookingType}`);
		const validDynStatuses = ["pending_payment", "pending_partner_confirmation"];
		assert(validDynStatuses.includes(res.body.status), `Expected pending_payment or pending_partner_confirmation, got ${res.body.status}`);
		state.dynamicBookingId = res.body._id;
		console.log(`    [info] Dynamic booking: ${res.body.bookingRef}, total: ${res.body.totalAmount} GHS`);
	});

	// ─────────────────────────────────────────
	// PHASE F: Expression of Interest
	// ─────────────────────────────────────────
	console.log("\n─── Phase F: Expression of Interest ───");

	await test("F1: Customer submits interest in a package", async () => {
		const res = await POST("/api/v1/interests", {
			tourPackageId: state.packageId,
			groupSize: 6,
			contactPreference: "email",
			notes: "Interested for August dates",
		}, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		state.interestId = res.body._id;
	});

	await test("F2: Customer views own interests", async () => {
		const res = await GET("/api/v1/interests/mine", customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
		assert(Array.isArray(res.body), "Expected array");
		assert(res.body.length >= 1, "Expected at least 1 interest");
	});

	await test("F3: Staff views all interests", async () => {
		const res = await GET("/api/v1/interests", staffToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
	});

	await test("F4: Customer withdraws interest", async () => {
		const res = await PUT(`/api/v1/interests/${state.interestId}/withdraw`, {}, customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	// ─────────────────────────────────────────
	// PHASE G: Notifications & Templates
	// ─────────────────────────────────────────
	console.log("\n─── Phase G: Notifications & Templates ───");

	await test("G1: Admin seeds default templates", async () => {
		const res = await POST("/api/v1/admin/templates/seed", {}, adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	await test("G2: Admin lists templates", async () => {
		const res = await GET("/api/v1/admin/templates", adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
		const templates = Array.isArray(res.body) ? res.body : res.body.rows;
		assert(templates && templates.length >= 5, `Expected 5+ templates, got ${templates ? templates.length : 0}`);
	});

	await test("G3: Customer lists notifications", async () => {
		const res = await GET("/api/v1/notifications", customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}`);
	});

	// ─────────────────────────────────────────
	// PHASE H: Admin Analytics (Diagram 5)
	// ─────────────────────────────────────────
	console.log("\n─── Phase H: Admin Analytics (Diagram 5) ───");

	await test("H1: Admin views booking analytics", async () => {
		const res = await GET("/api/v1/admin/analytics/bookings", adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
		assert(res.body.totalBookings !== undefined, "No totalBookings in response");
	});

	await test("H2: Admin views payment analytics", async () => {
		const res = await GET("/api/v1/admin/analytics/payments", adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	await test("H3: Admin views SLA metrics", async () => {
		const res = await GET("/api/v1/admin/sla-metrics", adminToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	await test("H4: Customer blocked from analytics (403)", async () => {
		const res = await GET("/api/v1/admin/analytics/bookings", customerToken);
		assert(res.status === 403, `Expected 403, got ${res.status}`);
	});

	// ─────────────────────────────────────────
	// PHASE I: Search (Phase 4)
	// ─────────────────────────────────────────
	console.log("\n─── Phase I: Search ───");

	await test("I1: Search tour packages by query", async () => {
		const res = await GET("/api/v1/tours/packages/search?query=Cape+Coast", customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	await test("I2: Search destinations", async () => {
		const res = await GET("/api/v1/destinations/search?query=Cape", customerToken);
		assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
	});

	// ─────────────────────────────────────────
	// SUMMARY
	// ─────────────────────────────────────────
	console.log("\n══════════════════════════════════════════════════════");
	console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
	console.log("══════════════════════════════════════════════════════");

	if (failed > 0) {
		console.log("\n  Failed tests:");
		for (const r of results.filter((r) => r.status === "FAIL")) {
			console.log(`    ✗ ${r.name}: ${r.error}`);
		}
	}

	console.log("");

	// Cleanup
	await broker.stop();
	await mongoose.disconnect();

	process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
