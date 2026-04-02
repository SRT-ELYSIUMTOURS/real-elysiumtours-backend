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

// ---- Phase 3 Services ----

const TourPackageService = require("../../services/tourPackage.service");
const BookingService = require("../../services/booking.service");
const PaymentService = require("../../services/payment.service");
const PaymentPlanService = require("../../services/paymentPlan.service");
const ContractService = require("../../services/contract.service");
const NotificationService = require("../../services/notification.service");

// ---- Main ----

async function main() {
	console.log("");
	console.log("Phase 3 Gate \u2014 Smoke Test");
	console.log("\u2500".repeat(25));

	const broker = new ServiceBroker({
		logger: {
			type: "Console",
			options: { level: "error" },
		},
		validator: true,
	});

	// Load all mock model services needed by Phase 3
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
	];

	for (const name of modelNames) {
		broker.createService(mockModelService(name));
	}

	// Load real Phase 3 services (plus supporting services)
	broker.createService(TourPackageService);
	broker.createService(BookingService);
	broker.createService(PaymentPlanService);
	broker.createService(ContractService);
	broker.createService(NotificationService);

	// Payment service needs Paystack mixin methods — stub them post-creation
	const paymentSvc = broker.createService(PaymentService);

	// Ensure env vars are set
	process.env.JWT_SECRET = process.env.JWT_SECRET || "phase3-smoke-test-secret";
	process.env.JWT_EXPIRY = process.env.JWT_EXPIRY || "1h";
	process.env.REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";
	process.env.DEFAULT_COMMITMENT_FEE_PERCENT = process.env.DEFAULT_COMMITMENT_FEE_PERCENT || "15";

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
		{ action: "paymentPlan.createPlan", label: "paymentPlan.createPlan" },
		{ action: "paymentPlan.getPlan", label: "paymentPlan.getPlan" },
		{ action: "paymentPlan.payMilestone", label: "paymentPlan.payMilestone" },
		{ action: "paymentPlan.getNextDueMilestone", label: "paymentPlan.getNextDueMilestone" },
		{ action: "paymentPlan.checkOverdue", label: "paymentPlan.checkOverdue" },
		{ action: "paymentPlan.sendReminders", label: "paymentPlan.sendReminders" },
		{ action: "contract.generateFromBooking", label: "contract.generateFromBooking" },
		{ action: "contract.sendToCustomer", label: "contract.sendToCustomer" },
		{ action: "contract.customerAccept", label: "contract.customerAccept" },
		{ action: "contract.verifyAcceptance", label: "contract.verifyAcceptance" },
		{ action: "contract.listContracts", label: "contract.listContracts" },
		{ action: "contract.seedDefaultTemplates", label: "contract.seedDefaultTemplates" },
		{ action: "notification.send", label: "notification.send" },
		{ action: "notification.listForUser", label: "notification.listForUser" },
		{ action: "notification.markRead", label: "notification.markRead" },
		{ action: "notification.getUnreadCount", label: "notification.getUnreadCount" },
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
		console.log("Phase 3 gate: PASSED");
	} else {
		console.log("Phase 3 gate: FAILED");
	}

	await broker.stop();
	process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error("Phase 3 gate script crashed:", err);
	process.exit(1);
});
