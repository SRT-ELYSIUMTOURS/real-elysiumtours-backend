"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { ServiceBroker } = require("moleculer");

// ---- In-memory mock model factory ----

/**
 * Creates a minimal mock model service with standard CRUD actions.
 * @param {string} name - The service name (e.g. "media.model")
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

// ---- All Services ----

// Phase 1
const AuthService = require("../../services/auth.service");
const UserService = require("../../services/user.service");
const RbacService = require("../../services/rbac.service");
const DestinationService = require("../../services/destination.service");
const HotelPartnerService = require("../../services/hotelPartner.service");
const AttractionService = require("../../services/attraction.service");
const DiningService = require("../../services/dining.service");
const TransportService = require("../../services/transport.service");
const TemplateService = require("../../services/template.service");

// Phase 2
const TourPackageService = require("../../services/tourPackage.service");
const DynamicTourService = require("../../services/dynamicTour.service");
const PricingDeskService = require("../../services/pricingDesk.service");
const BookingService = require("../../services/booking.service");
const PaymentService = require("../../services/payment.service");
const InterestService = require("../../services/interest.service");

// Phase 3
const PaymentPlanService = require("../../services/paymentPlan.service");
const ContractService = require("../../services/contract.service");
const NotificationService = require("../../services/notification.service");

// Phase 4
const MediaService = require("../../services/media.service");

// Email service requires nodemailer config — provide a stub
const MockEmailService = {
	name: "email",
	actions: {
		send: { handler() { return { success: true }; } },
		sendTemplated: { handler() { return { success: true }; } },
		sendBulk: { handler() { return { total: 0, sent: 0, failed: 0, results: [] }; } },
	},
	events: {
		"auth.registered"() {},
		"auth.verified"() {},
		"auth.forgotPassword"() {},
		"auth.resendOTP"() {},
	},
};

// ---- Main ----

async function main() {
	console.log("");
	console.log("Phase 4 Gate \u2014 Final Smoke Test (All Services)");
	console.log("\u2500".repeat(47));

	const broker = new ServiceBroker({
		logger: {
			type: "Console",
			options: { level: "error" },
		},
		validator: true,
	});

	// Load all mock model services across all phases
	const modelNames = [
		// Phase 1 models
		"user.model",
		"template.model",
		"role.model",
		"permission.model",
		"rolePermission.model",
		"destination.model",
		"hotelPartner.model",
		"attraction.model",
		"diningPartner.model",
		"transportProvider.model",
		"vehicle.model",
		// Phase 2 models
		"tourPackage.model",
		"packagePricing.model",
		"booking.model",
		"payment.model",
		"quote.model",
		"tourRequest.model",
		"interest.model",
		// Phase 3 models
		"paymentPlan.model",
		"milestone.model",
		"contract.model",
		"contractTemplate.model",
		"notification.model",
		// Phase 4 models
		"media.model",
	];

	for (const name of modelNames) {
		broker.createService(mockModelService(name));
	}

	// Load all real services

	// Phase 1
	broker.createService(AuthService);
	broker.createService(UserService);
	broker.createService(RbacService);
	broker.createService(DestinationService);
	broker.createService(HotelPartnerService);
	broker.createService(AttractionService);
	broker.createService(DiningService);
	broker.createService(TransportService);
	broker.createService(TemplateService);
	broker.createService(MockEmailService);

	// Phase 2
	broker.createService(TourPackageService);
	broker.createService(DynamicTourService);
	broker.createService(PricingDeskService);
	broker.createService(BookingService);
	broker.createService(InterestService);

	// Phase 3
	broker.createService(PaymentPlanService);
	broker.createService(ContractService);
	broker.createService(NotificationService);

	// Phase 4
	broker.createService(MediaService);

	// Payment service needs Paystack mixin methods — stub them post-creation
	const paymentSvc = broker.createService(PaymentService);

	// Ensure env vars are set
	process.env.JWT_SECRET = process.env.JWT_SECRET || "phase4-smoke-test-secret";
	process.env.JWT_EXPIRY = process.env.JWT_EXPIRY || "1h";
	process.env.REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";
	process.env.DEFAULT_COMMITMENT_FEE_PERCENT = process.env.DEFAULT_COMMITMENT_FEE_PERCENT || "15";
	process.env.DEFAULT_SLA_HOURS = process.env.DEFAULT_SLA_HOURS || "72";

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

	// ---- Action Checks ----

	const phaseChecks = {
		"Phase 1": [
			"auth.register",
			"destination.list",
			"hotelPartner.list",
			"template.getByName",
			"rbac.listRoles",
		],
		"Phase 2": [
			"tourPackage.list",
			"tourPackage.search",
			"dynamicTour.getDestinations",
			"pricingDesk.getQueue",
			"booking.createBooking",
			"payment.initiatePayment",
			"interest.submit",
		],
		"Phase 3": [
			"paymentPlan.createPlan",
			"contract.generateFromBooking",
			"notification.send",
			"notification.getUnreadCount",
		],
		"Phase 4": [
			"media.upload",
			"media.list",
			"booking.getAnalytics",
			"payment.getPaymentAnalytics",
			"pricingDesk.estimateCost",
		],
	};

	const actionList = broker.registry.getActionList({});
	let totalPassed = 0;
	let totalFailed = 0;

	for (const [phase, actions] of Object.entries(phaseChecks)) {
		console.log(`${phase}:`);
		for (const actionName of actions) {
			const found = actionList.some((entry) => entry.name === actionName);
			if (found) {
				console.log(`  \u2713 ${actionName}`);
				totalPassed++;
			} else {
				console.log(`  \u2717 ${actionName}`);
				totalFailed++;
			}
		}
	}

	// ---- Infrastructure Checks ----

	console.log("Infrastructure:");

	const projectRoot = path.resolve(__dirname, "../..");

	const dockerfilePath = path.join(projectRoot, "Dockerfile");
	if (fs.existsSync(dockerfilePath)) {
		console.log("  \u2713 Dockerfile exists");
		totalPassed++;
	} else {
		console.log("  \u2717 Dockerfile missing");
		totalFailed++;
	}

	const composePath = path.join(projectRoot, "docker-compose.yml");
	if (fs.existsSync(composePath)) {
		console.log("  \u2713 docker-compose.yml exists");
		totalPassed++;
	} else {
		console.log("  \u2717 docker-compose.yml missing");
		totalFailed++;
	}

	// ---- Summary ----

	const total = totalPassed + totalFailed;
	console.log("");
	console.log(`Result: ${totalPassed}/${total} checks passed`);

	if (totalFailed === 0) {
		console.log("Phase 4 gate: PASSED \u2014 All services operational");
	} else {
		console.log("Phase 4 gate: FAILED");
	}

	await broker.stop();
	process.exit(totalFailed === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error("Phase 4 gate script crashed:", err);
	process.exit(1);
});
