"use strict";

const { ServiceBroker } = require("moleculer");
const OrganizationService = require("../../../services/organization.service");
const { ERROR_CODES } = require("../../../utils/constants");

// ---- Test data ----

const mockOrg = {
	_id: "org-1",
	name: "Elysium Tours Ghana",
	slug: "elysium-tours-ghana",
	domain: "elysium.gh",
	contactEmail: "info@elysium.gh",
	contactPhone: "+233200000000",
	status: "trial",
	branding: { logoUrl: null, brandColor: "#2c3e50", faviconUrl: null },
	subscription: { plan: "free", status: "trial" },
	config: {
		payment: {
			defaultCommitmentFeePercent: 15,
			gracePeriodDays: 5,
			paymentReminderDaysBefore: [7, 3, 1],
		},
		comms: { smsProvider: "hubtel", whatsappEnabled: false },
		operations: { defaultSlaHours: 72, maxGroupSize: 50, supportedCurrencies: ["GHS"] },
		custom: {},
	},
};

const mockOrg2 = {
	_id: "org-2",
	name: "Cape Coast Adventures",
	slug: "cape-coast-adventures",
	status: "active",
	subscription: { plan: "professional", status: "active" },
	config: { ...mockOrg.config },
};

// Model call results — keyed by action name
let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock organization.model service
	broker.createService({
		name: "organization.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["organization.model.find"] === "function"
						? modelCallResults["organization.model.find"](ctx.params)
						: modelCallResults["organization.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["organization.model.get"] === "function") {
						return modelCallResults["organization.model.get"](ctx.params);
					}
					return modelCallResults["organization.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["organization.model.create"] === "function"
						? modelCallResults["organization.model.create"](ctx.params)
						: modelCallResults["organization.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["organization.model.update"] === "function"
						? modelCallResults["organization.model.update"](ctx.params)
						: modelCallResults["organization.model.update"] || {};
				},
			},
		},
	});

	// Load real organization service
	broker.createService(OrganizationService);

	return broker;
}

// ---- Tests ----

describe("Organization Service", () => {
	let broker;

	beforeAll(async () => {
		broker = createBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		modelCallResults = {};
	});

	// ========== create ==========

	describe("create", () => {
		it("should create org with default config and slug", async () => {
			modelCallResults["organization.model.find"] = () => [];
			modelCallResults["organization.model.create"] = (params) => ({
				_id: "new-org",
				...params,
			});

			const result = await broker.call("organization.create", {
				name: "Elysium Tours Ghana",
				contactEmail: "info@elysium.gh",
			});

			expect(result._id).toBe("new-org");
			expect(result.name).toBe("Elysium Tours Ghana");
			expect(result.slug).toBe("elysium-tours-ghana");
			expect(result.status).toBe("trial");
			expect(result.config).toBeDefined();
			expect(result.config.payment.defaultCommitmentFeePercent).toBe(15);
			expect(result.config.comms.smsProvider).toBe("hubtel");
			expect(result.config.operations.defaultSlaHours).toBe(72);
			expect(result.config.custom).toEqual({});
		});

		it("should throw error for duplicate slug", async () => {
			modelCallResults["organization.model.find"] = (params) => {
				if (params.query && params.query.slug === "elysium-tours-ghana") {
					return [mockOrg];
				}
				return [];
			};

			await expect(
				broker.call("organization.create", {
					name: "Elysium Tours Ghana",
				})
			).rejects.toMatchObject({
				code: 409,
				type: ERROR_CODES.ORG_SLUG_EXISTS,
			});
		});

		it("should throw validation error when name is missing", async () => {
			await expect(
				broker.call("organization.create", {})
			).rejects.toThrow();
		});
	});

	// ========== list ==========

	describe("list", () => {
		it("should return orgs with filters", async () => {
			modelCallResults["organization.model.find"] = (params) => {
				if (params.query && params.query.status === "active") {
					return [mockOrg2];
				}
				return [mockOrg, mockOrg2];
			};

			const result = await broker.call("organization.list", { status: "active" });

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(1);
			expect(result[0].status).toBe("active");
		});

		it("should return all orgs without filters", async () => {
			modelCallResults["organization.model.find"] = () => [mockOrg, mockOrg2];

			const result = await broker.call("organization.list", {});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
		});
	});

	// ========== get ==========

	describe("get", () => {
		it("should return org by id", async () => {
			modelCallResults["organization.model.get"] = () => mockOrg;

			const result = await broker.call("organization.get", { id: "org-1" });

			expect(result).toBeDefined();
			expect(result._id).toBe("org-1");
			expect(result.name).toBe("Elysium Tours Ghana");
		});

		it("should throw ORG_NOT_FOUND for invalid id", async () => {
			modelCallResults["organization.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("organization.get", { id: "invalid-id" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.ORG_NOT_FOUND,
			});
		});
	});

	// ========== suspend ==========

	describe("suspend", () => {
		it("should set status to suspended", async () => {
			modelCallResults["organization.model.get"] = () => ({ ...mockOrg });
			modelCallResults["organization.model.update"] = (params) => ({
				...mockOrg,
				status: params.status,
			});

			const result = await broker.call("organization.suspend", {
				id: "org-1",
				reason: "Non-payment",
			});

			expect(result.status).toBe("suspended");
		});

		it("should throw ORG_NOT_FOUND for invalid id", async () => {
			modelCallResults["organization.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("organization.suspend", { id: "invalid-id" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.ORG_NOT_FOUND,
			});
		});
	});

	// ========== activate ==========

	describe("activate", () => {
		it("should set status to active", async () => {
			modelCallResults["organization.model.get"] = () => ({
				...mockOrg,
				status: "suspended",
			});
			modelCallResults["organization.model.update"] = (params) => ({
				...mockOrg,
				status: params.status,
			});

			const result = await broker.call("organization.activate", { id: "org-1" });

			expect(result.status).toBe("active");
		});

		it("should throw ORG_NOT_FOUND for invalid id", async () => {
			modelCallResults["organization.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("organization.activate", { id: "invalid-id" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.ORG_NOT_FOUND,
			});
		});
	});

	// ========== getConfig ==========

	describe("getConfig", () => {
		it("should return org config", async () => {
			modelCallResults["organization.model.get"] = () => mockOrg;

			const result = await broker.call("organization.getConfig", {
				organizationId: "org-1",
			});

			expect(result).toBeDefined();
			expect(result.payment.defaultCommitmentFeePercent).toBe(15);
			expect(result.comms.smsProvider).toBe("hubtel");
			expect(result.operations.defaultSlaHours).toBe(72);
		});

		it("should return empty object if config is missing", async () => {
			modelCallResults["organization.model.get"] = () => ({
				...mockOrg,
				config: undefined,
			});

			const result = await broker.call("organization.getConfig", {
				organizationId: "org-1",
			});

			expect(result).toEqual({});
		});

		it("should throw ORG_NOT_FOUND for invalid id", async () => {
			modelCallResults["organization.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("organization.getConfig", { organizationId: "invalid-id" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.ORG_NOT_FOUND,
			});
		});
	});

	// ========== setConfig ==========

	describe("setConfig", () => {
		it("should set nested value via dot notation", async () => {
			modelCallResults["organization.model.get"] = () => ({
				...mockOrg,
				config: { ...mockOrg.config, custom: {} },
			});
			modelCallResults["organization.model.update"] = (params) => ({
				...mockOrg,
				config: params.config,
			});

			const result = await broker.call("organization.setConfig", {
				organizationId: "org-1",
				path: "custom.featureFlags.enableWhatsApp",
				value: true,
			});

			expect(result.config.custom.featureFlags.enableWhatsApp).toBe(true);
		});

		it("should set a top-level config value", async () => {
			modelCallResults["organization.model.get"] = () => ({
				...mockOrg,
				config: { ...mockOrg.config },
			});
			modelCallResults["organization.model.update"] = (params) => ({
				...mockOrg,
				config: params.config,
			});

			const result = await broker.call("organization.setConfig", {
				organizationId: "org-1",
				path: "payment.gracePeriodDays",
				value: 7,
			});

			expect(result.config.payment.gracePeriodDays).toBe(7);
		});

		it("should throw ORG_NOT_FOUND for invalid id", async () => {
			modelCallResults["organization.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("organization.setConfig", {
					organizationId: "invalid-id",
					path: "custom.key",
					value: "test",
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.ORG_NOT_FOUND,
			});
		});
	});

	// ========== mergeConfig ==========

	describe("mergeConfig", () => {
		it("should deep merge config", async () => {
			modelCallResults["organization.model.get"] = () => ({
				...mockOrg,
				config: {
					payment: { defaultCommitmentFeePercent: 15, gracePeriodDays: 5 },
					comms: { smsProvider: "hubtel", whatsappEnabled: false },
					custom: {},
				},
			});
			modelCallResults["organization.model.update"] = (params) => ({
				...mockOrg,
				config: params.config,
			});

			const result = await broker.call("organization.mergeConfig", {
				organizationId: "org-1",
				config: {
					comms: { whatsappEnabled: true },
					custom: { newFeature: true },
				},
			});

			// Merged values
			expect(result.config.comms.whatsappEnabled).toBe(true);
			expect(result.config.custom.newFeature).toBe(true);
			// Preserved values
			expect(result.config.comms.smsProvider).toBe("hubtel");
			expect(result.config.payment.defaultCommitmentFeePercent).toBe(15);
		});

		it("should throw ORG_NOT_FOUND for invalid id", async () => {
			modelCallResults["organization.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("organization.mergeConfig", {
					organizationId: "invalid-id",
					config: { custom: {} },
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.ORG_NOT_FOUND,
			});
		});
	});

	// ========== deleteConfigKey ==========

	describe("deleteConfigKey", () => {
		it("should remove nested key", async () => {
			modelCallResults["organization.model.get"] = () => ({
				...mockOrg,
				config: {
					payment: { defaultCommitmentFeePercent: 15, gracePeriodDays: 5 },
					custom: { featureFlags: { enableWhatsApp: true, enableSMS: true } },
				},
			});
			modelCallResults["organization.model.update"] = (params) => ({
				...mockOrg,
				config: params.config,
			});

			const result = await broker.call("organization.deleteConfigKey", {
				organizationId: "org-1",
				path: "custom.featureFlags.enableWhatsApp",
			});

			expect(result.config.custom.featureFlags.enableWhatsApp).toBeUndefined();
			expect(result.config.custom.featureFlags.enableSMS).toBe(true);
			expect(result.config.payment.defaultCommitmentFeePercent).toBe(15);
		});

		it("should handle non-existent path gracefully", async () => {
			modelCallResults["organization.model.get"] = () => ({
				...mockOrg,
				config: { payment: { gracePeriodDays: 5 } },
			});
			modelCallResults["organization.model.update"] = (params) => ({
				...mockOrg,
				config: params.config,
			});

			const result = await broker.call("organization.deleteConfigKey", {
				organizationId: "org-1",
				path: "nonexistent.deep.key",
			});

			// Should not throw, config should remain intact
			expect(result.config.payment.gracePeriodDays).toBe(5);
		});

		it("should throw ORG_NOT_FOUND for invalid id", async () => {
			modelCallResults["organization.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("organization.deleteConfigKey", {
					organizationId: "invalid-id",
					path: "custom.key",
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.ORG_NOT_FOUND,
			});
		});
	});
});
