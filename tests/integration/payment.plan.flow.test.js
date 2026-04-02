"use strict";

const { ServiceBroker } = require("moleculer");
const TourPackageService = require("../../services/tourPackage.service");
const BookingService = require("../../services/booking.service");
const PaymentService = require("../../services/payment.service");
const PaymentPlanService = require("../../services/paymentPlan.service");
const ContractService = require("../../services/contract.service");
const NotificationService = require("../../services/notification.service");

// ---- In-memory stores ----

let stores;
let idCounter;

function resetStores() {
	stores = {
		"tourPackage.model": new Map(),
		"packagePricing.model": new Map(),
		"booking.model": new Map(),
		"payment.model": new Map(),
		"paymentPlan.model": new Map(),
		"milestone.model": new Map(),
		"contract.model": new Map(),
		"contractTemplate.model": new Map(),
		"destination.model": new Map(),
		"hotelPartner.model": new Map(),
		"attraction.model": new Map(),
		"notification.model": new Map(),
		"template.model": new Map(),
		"quote.model": new Map(),
		"tourRequest.model": new Map(),
		"user.model": new Map(),
		"review.model": new Map(),
		"waitlistEntry.model": new Map(),
	};
	idCounter = 1;
}

/**
 * Create a generic mock model service backed by an in-memory Map.
 * Supports: create, find, get, update, remove, count.
 */
function createMockModel(name) {
	return {
		name,
		actions: {
			create: {
				handler(ctx) {
					const store = stores[name];
					const id = `${name.replace(".model", "")}_${idCounter++}`;
					const doc = { _id: id, ...ctx.params, createdAt: new Date().toISOString() };
					store.set(id, doc);
					return { ...doc };
				},
			},
			find: {
				handler(ctx) {
					const store = stores[name];
					const { query } = ctx.params || {};
					const results = [];
					for (const doc of store.values()) {
						let match = true;
						if (query) {
							for (const [key, val] of Object.entries(query)) {
								if (typeof val === "object" && val !== null && !Array.isArray(val)) {
									// Skip complex queries like $in, $lt — return all
									continue;
								}
								if (doc[key] !== val) {
									match = false;
									break;
								}
							}
						}
						if (match) results.push({ ...doc });
					}
					return results;
				},
			},
			get: {
				handler(ctx) {
					const store = stores[name];
					const id = ctx.params.id;
					const doc = store.get(id);
					return doc ? { ...doc } : null;
				},
			},
			update: {
				handler(ctx) {
					const store = stores[name];
					const { id, ...updates } = ctx.params;
					const doc = store.get(id);
					if (!doc) return null;
					Object.assign(doc, updates);
					store.set(id, doc);
					return { ...doc };
				},
			},
			remove: {
				handler(ctx) {
					const store = stores[name];
					const doc = store.get(ctx.params.id);
					store.delete(ctx.params.id);
					return doc ? { ...doc } : null;
				},
			},
			count: {
				handler(ctx) {
					const store = stores[name];
					const { query } = ctx.params || {};
					if (!query || Object.keys(query).length === 0) return store.size;
					let count = 0;
					for (const doc of store.values()) {
						let match = true;
						if (query) {
							for (const [key, val] of Object.entries(query)) {
								if (typeof val === "object" && val !== null && !Array.isArray(val)) continue;
								if (doc[key] !== val) {
									match = false;
									break;
								}
							}
						}
						if (match) count++;
					}
					return count;
				},
			},
		},
	};
}

// ---- Tests ----

describe("Payment Plan + Contract Flow — Integration (Phase 3)", () => {
	let broker;
	let paymentService;

	// State carried across ordered tests
	let destinationId;
	let hotelPartnerId;
	let attractionId;
	let packageId;
	let bookingId;
	let bookingRef;
	let planId;
	let milestoneIds;
	let contractId;
	let signatureToken;
	let transactionRef1;
	let transactionRef2;
	let transactionRef3;
	let paymentCallCount;

	const ADMIN_META = { user: { id: "admin1", email: "admin@test.com", role: "admin" } };
	const CUSTOMER_META = { user: { id: "cust1", email: "customer@test.com", role: "customer" } };

	beforeAll(async () => {
		process.env.JWT_SECRET = "test-secret";
		process.env.JWT_EXPIRY = "1h";
		process.env.REFRESH_TOKEN_EXPIRY = "7d";
		process.env.DEFAULT_COMMITMENT_FEE_PERCENT = "15";

		resetStores();

		broker = new ServiceBroker({
			logger: false,
			validator: true,
		});

		// Load all mock model services
		const modelNames = [
			"tourPackage.model",
			"packagePricing.model",
			"booking.model",
			"payment.model",
			"paymentPlan.model",
			"milestone.model",
			"contract.model",
			"contractTemplate.model",
			"destination.model",
			"hotelPartner.model",
			"attraction.model",
			"notification.model",
			"template.model",
			"quote.model",
			"tourRequest.model",
			"user.model",
			"review.model",
			"waitlistEntry.model",
		];

		for (const name of modelNames) {
			broker.createService(createMockModel(name));
		}

		// Mock review service
		broker.createService({
			name: "review",
			actions: {
				getStats: { handler() { return { weightedAverageRating: 0, simpleAverageRating: 0, totalReviews: 0, ratingBreakdown: {} }; } },
			},
		});

		// Mock hotelPartner service (non-model, for checkAvailability)
		broker.createService({
			name: "hotelPartner",
			actions: {
				checkAvailability: { handler() { return { available: true, needsConfirmation: false, inventoryModel: "free_sale", hotel: { name: "Test Hotel" } }; } },
				getByDestination: { handler() { return []; } },
			},
		});

		// Load real services
		broker.createService(TourPackageService);
		broker.createService(BookingService);
		broker.createService(PaymentPlanService);
		broker.createService(ContractService);
		broker.createService(NotificationService);

		// Load payment service and capture reference for mocking
		paymentService = broker.createService(PaymentService);

		await broker.start();

		// Track payment call count for unique refs
		paymentCallCount = 0;

		// Mock Paystack methods on the payment service after start
		paymentService.initializeTransaction = jest.fn().mockImplementation((params) => {
			paymentCallCount++;
			return Promise.resolve({
				authorization_url: `https://checkout.paystack.com/test_${paymentCallCount}`,
				access_code: `access_code_${paymentCallCount}`,
				reference: params.reference,
			});
		});
		paymentService.verifyTransaction = jest.fn().mockImplementation((reference) => {
			return Promise.resolve({
				status: "success",
				amount: 15000,
				currency: "GHS",
				reference,
			});
		});

		// Seed prerequisite data
		const dest = await broker.call("destination.model.create", {
			name: "Accra",
			country: "Ghana",
			isActive: true,
		});
		destinationId = dest._id;

		const hotel = await broker.call("hotelPartner.model.create", {
			name: "Test Hotel",
			destinationId,
			isActive: true,
		});
		hotelPartnerId = hotel._id;

		const attr = await broker.call("attraction.model.create", {
			name: "Cape Coast Castle",
			destinationId,
			isActive: true,
		});
		attractionId = attr._id;

		// Seed a user record for the customer
		stores["user.model"].set("cust1", {
			_id: "cust1",
			email: "customer@test.com",
			firstName: "Test",
			lastName: "Customer",
		});

		// Seed the default contract template so generateFromBooking can find it
		await broker.call("contractTemplate.model.create", {
			name: "standard_tour_contract",
			title: "Elysium Tours — Tour Booking Contract for {{customerName}}",
			body: "Contract body for booking {{bookingRef}}, tour {{tourName}}, amount {{currency}} {{totalAmount}}.",
			variables: ["customerName", "bookingRef", "tourName", "totalAmount", "currency", "groupSize", "tourDate", "cancellationPolicy", "today"],
			cancellationClause: "Standard cancellation terms apply.",
			availabilityClause: "",
			isActive: true,
		});
	});

	afterAll(async () => {
		await broker.stop();
	});

	// ========== Step 1: Create a tour package and publish it ==========

	it("1. Create a tour package and publish it", async () => {
		const pkg = await broker.call(
			"tourPackage.create",
			{
				title: "Accra Weekend Tour",
				description: "A 3-day Accra experience",
				destinationId,
				hotelPartnerId,
				attractionIds: [attractionId],
				durationDays: 3,
				sellingMode: "group_buy",
				startDate: "2026-06-01",
				endDate: "2026-06-03",
			},
			{ meta: ADMIN_META }
		);

		expect(pkg._id).toBeDefined();
		expect(pkg.status).toBe("draft");
		packageId = pkg._id;

		// Add pricing tier
		await broker.call(
			"tourPackage.addPricingTier",
			{
				packageId,
				minGroupSize: 1,
				maxGroupSize: 10,
				pricePerPerson: 200,
				label: "Standard",
			},
			{ meta: ADMIN_META }
		);

		// Publish
		const published = await broker.call(
			"tourPackage.publish",
			{ id: packageId },
			{ meta: ADMIN_META }
		);
		expect(published.status).toBe("published");
	});

	// ========== Step 2: Create a booking (packaged) -> pending_payment ==========

	it("2. Create a booking (packaged) -> pending_payment", async () => {
		const result = await broker.call(
			"booking.createBooking",
			{
				packageId,
				groupSize: 4,
				specialRequests: "Extra pillows",
			},
			{ meta: CUSTOMER_META }
		);

		expect(result._id).toBeDefined();
		expect(result.bookingRef).toBeDefined();
		expect(result.status).toBe("pending_payment");
		expect(result.bookingType).toBe("packaged");
		expect(result.totalAmount).toBe(800); // 200 * 4
		expect(result.commitmentFeeAmount).toBe(120); // 15% of 800
		expect(result.customerId).toBe("cust1");

		bookingId = result._id;
		bookingRef = result.bookingRef;
	});

	// ========== Step 3: Payment plan auto-created — verify 3 milestones ==========

	it("3. Payment plan is created with 3 milestones", async () => {
		// Manually call createPlan since event system may not propagate in same-broker tests
		const planResult = await broker.call("paymentPlan.createPlan", {
			bookingId,
			totalAmount: 800,
		});

		expect(planResult.paymentPlan).toBeDefined();
		expect(planResult.paymentPlan.status).toBe("active");
		expect(planResult.paymentPlan.totalAmount).toBe(800);
		expect(planResult.paymentPlan.paidAmount).toBe(0);
		expect(planResult.paymentPlan.numberOfMilestones).toBe(3);
		expect(planResult.milestones).toHaveLength(3);

		planId = planResult.paymentPlan._id;
		milestoneIds = planResult.milestones.map((m) => m._id);
	});

	// ========== Step 4: Verify milestone 1 is commitment fee ==========

	it("4. Milestone 1 is commitment fee with correct amount", async () => {
		const plan = await broker.call(
			"paymentPlan.getPlan",
			{ bookingId },
			{ meta: CUSTOMER_META }
		);

		const milestone1 = plan.milestones.find((m) => m.milestoneNumber === 1);
		expect(milestone1).toBeDefined();
		expect(milestone1.label).toBe("Commitment Fee");
		expect(milestone1.amount).toBe(120); // 15% of 800
		expect(milestone1.status).toBe("pending");
	});

	// ========== Step 5: Generate contract for booking ==========

	it("5. Generate contract for booking — draft status", async () => {
		// The booking.created event may have already auto-generated a contract.
		// Check for an existing one first; if none, generate explicitly.
		const existing = await broker.call("contract.model.find", {
			query: { bookingId },
		});

		let contract;
		if (existing && existing.length > 0) {
			contract = existing[0];
		} else {
			contract = await broker.call("contract.generateFromBooking", {
				bookingId,
			});
		}

		expect(contract).toBeDefined();
		expect(contract._id).toBeDefined();
		expect(contract.status).toBe("draft");
		expect(contract.bookingId).toBe(bookingId);
		expect(contract.signatureToken).toBeDefined();

		contractId = contract._id;
		signatureToken = contract.signatureToken;
	});

	// ========== Step 6: Send contract to customer — transitions to sent ==========

	it("6. Send contract to customer — transitions to sent", async () => {
		const result = await broker.call(
			"contract.sendToCustomer",
			{ contractId },
			{ meta: { user: { id: "admin1", email: "admin@test.com", role: "staff" } } }
		);

		expect(result.status).toBe("sent");
		expect(result.sentAt).toBeDefined();
		expect(result.expiresAt).toBeDefined();
	});

	// ========== Step 7: Customer accepts contract ==========

	it("7. Customer accepts contract — accepted with timestamp", async () => {
		const result = await broker.call(
			"contract.customerAccept",
			{ signatureToken },
			{ meta: CUSTOMER_META }
		);

		expect(result.contract).toBeDefined();
		expect(result.contract.status).toBe("accepted");
		expect(result.contract.acceptedAt).toBeDefined();
		expect(result.message).toBe("Contract accepted successfully.");
	});

	// ========== Step 8: Verify contract acceptance ==========

	it("8. Verify contract acceptance — returns accepted: true", async () => {
		const result = await broker.call("contract.verifyAcceptance", {
			bookingId,
		});

		expect(result.accepted).toBe(true);
		expect(result.contract).toBeDefined();
		expect(result.contract.status).toBe("accepted");
	});

	// ========== Step 9: Initiate payment for commitment fee milestone ==========

	it("9. Initiate payment for commitment fee — returns authorization URL", async () => {
		const result = await broker.call(
			"payment.initiatePayment",
			{
				bookingId,
				paymentType: "commitment_fee",
			},
			{ meta: CUSTOMER_META }
		);

		expect(result.paymentId).toBeDefined();
		expect(result.authorizationUrl).toBeDefined();
		expect(result.authorizationUrl).toMatch(/^https:\/\/checkout\.paystack\.com\//);
		expect(result.transactionRef).toBeDefined();

		transactionRef1 = result.transactionRef;
	});

	// ========== Step 10: Verify payment — booking confirmed, milestone paid ==========

	it("10. Verify payment — booking confirmed, milestone 1 paid, plan paidAmount updated", async () => {
		const result = await broker.call(
			"payment.verifyPayment",
			{ reference: transactionRef1 },
			{ meta: CUSTOMER_META }
		);

		expect(result.payment).toBeDefined();
		expect(result.payment.status).toBe("success");
		expect(result.booking).toBeDefined();
		expect(result.booking.status).toBe("confirmed");
		expect(result.booking.commitmentFeePaid).toBe(true);

		// Now manually trigger the paymentPlan event handler logic:
		// Find the next unpaid milestone and mark it paid
		const paymentId = result.payment._id;
		const milestonesBeforePay = await broker.call(
			"milestone.model.find",
			{ query: { bookingId, status: "pending" } }
		);
		// Sort by milestoneNumber and take the first
		milestonesBeforePay.sort((a, b) => a.milestoneNumber - b.milestoneNumber);
		const nextMilestone = milestonesBeforePay[0];

		const payResult = await broker.call(
			"paymentPlan.payMilestone",
			{
				milestoneId: nextMilestone._id,
				paymentId,
			},
			{ meta: CUSTOMER_META }
		);

		expect(payResult.milestone.status).toBe("paid");
		expect(payResult.milestone.paidAt).toBeDefined();
		expect(payResult.paymentPlan.paidAmount).toBe(120);
		expect(payResult.paymentPlan.status).toBe("active"); // Not yet complete
	});

	// ========== Step 11: Pay second milestone — plan paidAmount increases ==========

	it("11. Pay second milestone — plan paidAmount increases", async () => {
		// Booking is now confirmed. For the second milestone we need to set booking
		// back to pending_payment so payment.initiatePayment works, or call payMilestone directly.
		// We will call payMilestone directly to test the plan logic, simulating a completed payment.
		const plan = await broker.call(
			"paymentPlan.getPlan",
			{ bookingId },
			{ meta: CUSTOMER_META }
		);

		const milestone2 = plan.milestones.find((m) => m.milestoneNumber === 2);
		expect(milestone2).toBeDefined();
		expect(milestone2.status).toBe("pending");

		// Create a mock payment record to reference
		const mockPayment = await broker.call("payment.model.create", {
			bookingId,
			customerId: "cust1",
			amount: milestone2.amount,
			currency: "GHS",
			provider: "paystack",
			paymentType: "milestone",
			transactionRef: "ELY-PAY-MOCK-MS2",
			status: "success",
		});

		const result = await broker.call(
			"paymentPlan.payMilestone",
			{
				milestoneId: milestone2._id,
				paymentId: mockPayment._id,
			},
			{ meta: CUSTOMER_META }
		);

		expect(result.milestone.status).toBe("paid");
		expect(result.paymentPlan.paidAmount).toBe(120 + milestone2.amount);
		expect(result.paymentPlan.status).toBe("active"); // Still not all paid
	});

	// ========== Step 12: Pay final milestone — plan completed ==========

	it("12. Pay final milestone — plan status transitions to completed", async () => {
		const plan = await broker.call(
			"paymentPlan.getPlan",
			{ bookingId },
			{ meta: CUSTOMER_META }
		);

		const milestone3 = plan.milestones.find((m) => m.milestoneNumber === 3);
		expect(milestone3).toBeDefined();
		expect(milestone3.status).toBe("pending");

		// Create a mock payment record
		const mockPayment = await broker.call("payment.model.create", {
			bookingId,
			customerId: "cust1",
			amount: milestone3.amount,
			currency: "GHS",
			provider: "paystack",
			paymentType: "milestone",
			transactionRef: "ELY-PAY-MOCK-MS3",
			status: "success",
		});

		const result = await broker.call(
			"paymentPlan.payMilestone",
			{
				milestoneId: milestone3._id,
				paymentId: mockPayment._id,
			},
			{ meta: CUSTOMER_META }
		);

		expect(result.milestone.status).toBe("paid");
		expect(result.paymentPlan.status).toBe("completed");
		expect(result.paymentPlan.completedAt).toBeDefined();
		expect(result.paymentPlan.paidAmount).toBe(800); // Full amount
		expect(result.paymentPlan.remainingAmount).toBe(0);
	});
});
