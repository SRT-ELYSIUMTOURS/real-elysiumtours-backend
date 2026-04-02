"use strict";

require("dotenv").config();

const { ServiceBroker } = require("moleculer");

// ---- In-memory mock model factory ----

/**
 * Creates a minimal mock model service with standard CRUD actions.
 * @param {string} name - The service name (e.g. "booking.model")
 * @returns {Object} Moleculer service schema
 */
function mockModelService(name) {
	const store = new Map();
	let idSeq = 1;

	return {
		name,
		actions: {
			create: {
				handler(ctx) {
					const id = `${name}_${idSeq++}`;
					const doc = { _id: id, ...ctx.params };
					store.set(id, doc);
					return doc;
				},
			},
			find: {
				handler() {
					return Array.from(store.values());
				},
			},
			get: {
				handler(ctx) {
					return store.get(ctx.params.id) || null;
				},
			},
			update: {
				handler(ctx) {
					const { id, ...updates } = ctx.params;
					const doc = store.get(id);
					if (!doc) return null;
					Object.assign(doc, updates);
					return doc;
				},
			},
			remove: {
				handler(ctx) {
					const doc = store.get(ctx.params.id);
					store.delete(ctx.params.id);
					return doc || null;
				},
			},
			count: {
				handler() {
					return store.size;
				},
			},
			getAdapter: {
				handler() {
					return null;
				},
			},
		},
	};
}

// ---- Phase 2 Services ----

const TourPackageService = require("../../services/tourPackage.service");
const DynamicTourService = require("../../services/dynamicTour.service");
const PricingDeskService = require("../../services/pricingDesk.service");
const BookingService = require("../../services/booking.service");
const PaymentService = require("../../services/payment.service");
const InterestService = require("../../services/interest.service");

// ---- Main ----

async function main() {
	console.log("");
	console.log("Phase 2 Gate \u2014 Smoke Test");
	console.log("\u2500".repeat(25));

	const broker = new ServiceBroker({
		logger: {
			type: "Console",
			options: { level: "error" },
		},
		validator: true,
	});

	// Load all mock model services needed by Phase 2
	const modelNames = [
		"tourPackage.model",
		"packagePricing.model",
		"booking.model",
		"payment.model",
		"destination.model",
		"hotelPartner.model",
		"attraction.model",
		"diningPartner.model",
		"vehicle.model",
		"quote.model",
		"tourRequest.model",
		"user.model",
		"interest.model",
	];

	for (const name of modelNames) {
		broker.createService(mockModelService(name));
	}

	// Load real Phase 2 services
	broker.createService(TourPackageService);
	broker.createService(DynamicTourService);
	broker.createService(PricingDeskService);
	broker.createService(BookingService);
	broker.createService(InterestService);

	// Payment service needs Paystack mixin methods — stub them post-creation
	const paymentSvc = broker.createService(PaymentService);

	// Ensure env vars are set
	process.env.JWT_SECRET = process.env.JWT_SECRET || "phase2-smoke-test-secret";
	process.env.JWT_EXPIRY = process.env.JWT_EXPIRY || "1h";
	process.env.REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

	await broker.start();

	// Stub Paystack methods so they don't make real HTTP calls
	paymentSvc.initializeTransaction = async () => ({
		authorization_url: "https://checkout.paystack.com/stub",
		access_code: "stub",
		reference: "stub_ref",
	});
	paymentSvc.verifyTransaction = async () => ({
		status: "success",
		amount: 10000,
		currency: "GHS",
		reference: "stub_ref",
	});

	// ---- Checks ----

	const checks = [
		{ action: "tourPackage.list", label: "tourPackage.list" },
		{ action: "tourPackage.create", label: "tourPackage.create" },
		{ action: "tourPackage.validatePackage", label: "tourPackage.validatePackage" },
		{ action: "dynamicTour.getDestinations", label: "dynamicTour.getDestinations" },
		{ action: "dynamicTour.submitForPricing", label: "dynamicTour.submitForPricing" },
		{ action: "pricingDesk.getQueue", label: "pricingDesk.getQueue" },
		{ action: "pricingDesk.customerAccept", label: "pricingDesk.customerAccept" },
		{ action: "booking.createBooking", label: "booking.createBooking" },
		{ action: "booking.listBookings", label: "booking.listBookings" },
		{ action: "payment.initiatePayment", label: "payment.initiatePayment" },
		{ action: "payment.verifyPayment", label: "payment.verifyPayment" },
		{ action: "interest.submit", label: "interest.submit" },
	];

	let passed = 0;
	let failed = 0;

	for (const check of checks) {
		try {
			const actionName = check.action;
			const actionList = broker.registry.getActionList({});
			const found = actionList.some((entry) => entry.name === actionName);

			if (found) {
				console.log(`\u2713 ${check.label} \u2014 action exists`);
				passed++;
			} else {
				console.log(`\u2717 ${check.label} \u2014 action NOT found`);
				failed++;
			}
		} catch (err) {
			console.log(`\u2717 ${check.label} \u2014 error: ${err.message}`);
			failed++;
		}
	}

	const total = passed + failed;
	console.log("");
	console.log(`Result: ${passed}/${total} checks passed`);

	if (failed === 0) {
		console.log("Phase 2 gate: PASSED");
	} else {
		console.log("Phase 2 gate: FAILED");
	}

	await broker.stop();
	process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error("Phase 2 gate script crashed:", err);
	process.exit(1);
});
