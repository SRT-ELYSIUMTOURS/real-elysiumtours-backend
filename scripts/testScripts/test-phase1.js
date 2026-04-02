"use strict";

require("dotenv").config();

const { ServiceBroker } = require("moleculer");

// ---- In-memory mock model factory ----

/**
 * Creates a minimal mock model service with standard CRUD actions.
 * @param {string} name - The service name (e.g. "user.model")
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
			getAdapter: {
				handler() {
					return null;
				},
			},
		},
	};
}

// ---- Phase 1 Services ----

const AuthService = require("../../services/auth.service");
const UserService = require("../../services/user.service");
const RbacService = require("../../services/rbac.service");
const DestinationService = require("../../services/destination.service");
const HotelPartnerService = require("../../services/hotelPartner.service");
const AttractionService = require("../../services/attraction.service");
const DiningService = require("../../services/dining.service");
const TransportService = require("../../services/transport.service");
const TemplateService = require("../../services/template.service");

// Email service requires nodemailer config — provide a stub instead
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
	console.log("Phase 1 Gate \u2014 Smoke Test");
	console.log("\u2500".repeat(25));

	const broker = new ServiceBroker({
		logger: {
			type: "Console",
			options: { level: "error" },
		},
		validator: true,
	});

	// Load all mock model services
	const modelNames = [
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
	];

	for (const name of modelNames) {
		broker.createService(mockModelService(name));
	}

	// Load real Phase 1 services
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

	// Ensure JWT env vars are set for auth service
	process.env.JWT_SECRET = process.env.JWT_SECRET || "phase1-smoke-test-secret";
	process.env.JWT_EXPIRY = process.env.JWT_EXPIRY || "1h";
	process.env.REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

	await broker.start();

	// ---- Checks ----

	const checks = [
		{ action: "auth.register", label: "auth.register" },
		{ action: "destination.list", label: "destination.list" },
		{ action: "hotelPartner.list", label: "hotelPartner.list" },
		{ action: "template.getByName", label: "template.getByName" },
		{ action: "rbac.listRoles", label: "rbac.listRoles" },
	];

	let passed = 0;
	let failed = 0;

	for (const check of checks) {
		try {
			// Verify the action exists on the broker
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
		console.log("Phase 1 gate: PASSED");
	} else {
		console.log("Phase 1 gate: FAILED");
	}

	await broker.stop();
	process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error("Phase 1 gate script crashed:", err);
	process.exit(1);
});
