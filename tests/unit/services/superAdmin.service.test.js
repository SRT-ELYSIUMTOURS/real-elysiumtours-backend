"use strict";

const { ServiceBroker } = require("moleculer");
const SuperAdminService = require("../../../services/superAdmin.service");
const { ERROR_CODES, USER_ROLES } = require("../../../utils/constants");

// ---- Test data ----

const mockOrg1 = {
	_id: "org-1",
	name: "Elysium Tours Ghana",
	slug: "elysium-tours-ghana",
	status: "active",
	subscription: { plan: "professional", status: "active" },
	config: {},
};

const mockOrg2 = {
	_id: "org-2",
	name: "Cape Coast Adventures",
	slug: "cape-coast-adventures",
	status: "trial",
	subscription: { plan: "free", status: "trial" },
	config: {},
};

const mockUsers = [
	{ _id: "u-1", email: "admin@elysium.gh", role: "admin", organizationId: "org-1" },
	{ _id: "u-2", email: "staff@elysium.gh", role: "staff", organizationId: "org-1" },
	{ _id: "u-3", email: "admin@cape.gh", role: "admin", organizationId: "org-2" },
];

const mockBookings = [
	{ _id: "b-1", organizationId: "org-1", status: "confirmed", totalAmount: 500 },
	{ _id: "b-2", organizationId: "org-1", status: "pending_payment", totalAmount: 300 },
	{ _id: "b-3", organizationId: "org-2", status: "confirmed", totalAmount: 200 },
];

const mockPayments = [
	{ _id: "p-1", organizationId: "org-1", amount: 500, status: "success", createdAt: "2026-01-15T00:00:00.000Z" },
	{ _id: "p-2", organizationId: "org-1", amount: 300, status: "success", createdAt: "2026-02-10T00:00:00.000Z" },
	{ _id: "p-3", organizationId: "org-2", amount: 200, status: "success", createdAt: "2026-03-05T00:00:00.000Z" },
];

const superAdminMeta = {
	meta: {
		user: { id: "sa-1", role: USER_ROLES.SUPER_ADMIN },
	},
};

// ---- Model call results store ----

let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock organization.model
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

	// Mock user.model
	broker.createService({
		name: "user.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["user.model.find"] === "function"
						? modelCallResults["user.model.find"](ctx.params)
						: modelCallResults["user.model.find"] || [];
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["user.model.create"] === "function"
						? modelCallResults["user.model.create"](ctx.params)
						: modelCallResults["user.model.create"] || {};
				},
			},
		},
	});

	// Mock booking.model
	broker.createService({
		name: "booking.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.find"] === "function"
						? modelCallResults["booking.model.find"](ctx.params)
						: modelCallResults["booking.model.find"] || [];
				},
			},
		},
	});

	// Mock payment.model
	broker.createService({
		name: "payment.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["payment.model.find"] === "function"
						? modelCallResults["payment.model.find"](ctx.params)
						: modelCallResults["payment.model.find"] || [];
				},
			},
		},
	});

	// Mock organization service (for create/suspend/activate delegation)
	broker.createService({
		name: "organization",
		actions: {
			create: {
				handler(ctx) {
					return typeof modelCallResults["organization.create"] === "function"
						? modelCallResults["organization.create"](ctx.params)
						: modelCallResults["organization.create"] || {};
				},
			},
			suspend: {
				handler(ctx) {
					return typeof modelCallResults["organization.suspend"] === "function"
						? modelCallResults["organization.suspend"](ctx.params)
						: modelCallResults["organization.suspend"] || {};
				},
			},
			activate: {
				handler(ctx) {
					return typeof modelCallResults["organization.activate"] === "function"
						? modelCallResults["organization.activate"](ctx.params)
						: modelCallResults["organization.activate"] || {};
				},
			},
		},
	});

	// Load the real superAdmin service
	broker.createService(SuperAdminService);

	return broker;
}

// ---- Tests ----

describe("SuperAdmin Service", () => {
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

	// ========== listOrganizations ==========

	describe("listOrganizations", () => {
		it("should return organizations with user and booking counts", async () => {
			modelCallResults["organization.model.find"] = () => [mockOrg1, mockOrg2];
			modelCallResults["user.model.find"] = (params) => {
				const orgId = params.query && params.query.organizationId;
				return mockUsers.filter((u) => u.organizationId === orgId);
			};
			modelCallResults["booking.model.find"] = (params) => {
				const orgId = params.query && params.query.organizationId;
				if (orgId) return mockBookings.filter((b) => b.organizationId === orgId);
				return mockBookings;
			};

			const result = await broker.call(
				"superAdmin.listOrganizations",
				{},
				superAdminMeta
			);

			expect(result.organizations).toHaveLength(2);
			expect(result.total).toBe(2);

			const org1 = result.organizations.find((o) => o._id === "org-1");
			expect(org1.userCount).toBe(2);
			expect(org1.bookingCount).toBe(2);

			const org2 = result.organizations.find((o) => o._id === "org-2");
			expect(org2.userCount).toBe(1);
			expect(org2.bookingCount).toBe(1);
		});

		it("should filter by status", async () => {
			modelCallResults["organization.model.find"] = (params) => {
				if (params.query && params.query.status === "active") return [mockOrg1];
				return [mockOrg1, mockOrg2];
			};
			modelCallResults["user.model.find"] = () => [];
			modelCallResults["booking.model.find"] = () => [];

			const result = await broker.call(
				"superAdmin.listOrganizations",
				{ status: "active" },
				superAdminMeta
			);

			expect(result.organizations).toHaveLength(1);
			expect(result.organizations[0]._id).toBe("org-1");
		});
	});

	// ========== getOrganization ==========

	describe("getOrganization", () => {
		it("should return a single org with userCount, bookingCount, and revenue", async () => {
			modelCallResults["organization.model.get"] = () => mockOrg1;
			modelCallResults["user.model.find"] = () =>
				mockUsers.filter((u) => u.organizationId === "org-1");
			modelCallResults["booking.model.find"] = () =>
				mockBookings.filter((b) => b.organizationId === "org-1");
			modelCallResults["payment.model.find"] = () =>
				mockPayments.filter((p) => p.organizationId === "org-1" && p.status === "success");

			const result = await broker.call(
				"superAdmin.getOrganization",
				{ id: "org-1" },
				superAdminMeta
			);

			expect(result._id).toBe("org-1");
			expect(result.userCount).toBe(2);
			expect(result.bookingCount).toBe(2);
			expect(result.revenue).toBe(800);
		});

		it("should throw ORG_NOT_FOUND for invalid id", async () => {
			modelCallResults["organization.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call(
					"superAdmin.getOrganization",
					{ id: "invalid-id" },
					superAdminMeta
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.ORG_NOT_FOUND,
			});
		});
	});

	// ========== createOrganization ==========

	describe("createOrganization", () => {
		it("should create org and admin user", async () => {
			modelCallResults["organization.create"] = (params) => ({
				_id: "new-org",
				name: params.name,
				slug: "new-tours",
				status: "trial",
			});
			modelCallResults["user.model.create"] = (params) => ({
				_id: "new-user",
				email: params.email,
				role: params.role,
				firstName: params.firstName,
				lastName: params.lastName,
				organizationId: params.organizationId,
			});

			const result = await broker.call(
				"superAdmin.createOrganization",
				{
					name: "New Tours",
					contactEmail: "info@newtours.gh",
					adminEmail: "admin@newtours.gh",
					adminPassword: "SecurePass123!",
					adminFirstName: "John",
					adminLastName: "Doe",
				},
				superAdminMeta
			);

			expect(result.organization._id).toBe("new-org");
			expect(result.organization.name).toBe("New Tours");
			expect(result.adminUser.email).toBe("admin@newtours.gh");
			expect(result.adminUser.role).toBe(USER_ROLES.ADMIN);
		});
	});

	// ========== suspendOrganization ==========

	describe("suspendOrganization", () => {
		it("should delegate to organization.suspend", async () => {
			modelCallResults["organization.suspend"] = (params) => ({
				...mockOrg1,
				status: "suspended",
			});

			const result = await broker.call(
				"superAdmin.suspendOrganization",
				{ id: "org-1", reason: "Non-payment" },
				superAdminMeta
			);

			expect(result.status).toBe("suspended");
		});
	});

	// ========== activateOrganization ==========

	describe("activateOrganization", () => {
		it("should delegate to organization.activate", async () => {
			modelCallResults["organization.activate"] = () => ({
				...mockOrg2,
				status: "active",
			});

			const result = await broker.call(
				"superAdmin.activateOrganization",
				{ id: "org-2" },
				superAdminMeta
			);

			expect(result.status).toBe("active");
		});
	});

	// ========== getPlatformHealth ==========

	describe("getPlatformHealth", () => {
		it("should return platform-wide health stats", async () => {
			modelCallResults["organization.model.find"] = (params) => {
				if (params.query && params.query.status === "active") return [mockOrg1];
				return [mockOrg1, mockOrg2];
			};
			modelCallResults["user.model.find"] = () => mockUsers;
			modelCallResults["booking.model.find"] = () => mockBookings;

			const result = await broker.call(
				"superAdmin.getPlatformHealth",
				{},
				superAdminMeta
			);

			expect(result.totalOrganizations).toBe(2);
			expect(result.activeOrganizations).toBe(1);
			expect(result.totalUsers).toBe(3);
			expect(result.totalBookings).toBe(3);
			expect(Array.isArray(result.servicesRunning)).toBe(true);
		});
	});

	// ========== getCrossOrgRevenue ==========

	describe("getCrossOrgRevenue", () => {
		it("should aggregate revenue across all orgs", async () => {
			modelCallResults["payment.model.find"] = () => mockPayments;
			modelCallResults["organization.model.find"] = () => [mockOrg1, mockOrg2];

			const result = await broker.call(
				"superAdmin.getCrossOrgRevenue",
				{},
				superAdminMeta
			);

			expect(result.totalRevenue).toBe(1000);
			expect(result.orgBreakdown).toHaveLength(2);

			const org1Revenue = result.orgBreakdown.find((o) => o.orgId === "org-1");
			expect(org1Revenue.revenue).toBe(800);
			expect(org1Revenue.orgName).toBe("Elysium Tours Ghana");

			const org2Revenue = result.orgBreakdown.find((o) => o.orgId === "org-2");
			expect(org2Revenue.revenue).toBe(200);
			expect(org2Revenue.orgName).toBe("Cape Coast Adventures");
		});

		it("should filter by date range", async () => {
			modelCallResults["payment.model.find"] = (params) => {
				if (params.query && params.query.createdAt) {
					return mockPayments.filter((p) => {
						const d = new Date(p.createdAt);
						if (params.query.createdAt.$gte && d < new Date(params.query.createdAt.$gte)) return false;
						if (params.query.createdAt.$lte && d > new Date(params.query.createdAt.$lte)) return false;
						return true;
					});
				}
				return mockPayments;
			};
			modelCallResults["organization.model.find"] = () => [mockOrg1, mockOrg2];

			const result = await broker.call(
				"superAdmin.getCrossOrgRevenue",
				{ startDate: "2026-02-01", endDate: "2026-02-28" },
				superAdminMeta
			);

			expect(result.totalRevenue).toBe(300);
			expect(result.orgBreakdown).toHaveLength(1);
		});
	});

	// ========== getCrossOrgAnalytics ==========

	describe("getCrossOrgAnalytics", () => {
		it("should return cross-org booking and user stats", async () => {
			modelCallResults["booking.model.find"] = () => mockBookings;
			modelCallResults["user.model.find"] = () => mockUsers;
			modelCallResults["organization.model.find"] = () => [mockOrg1, mockOrg2];

			const result = await broker.call(
				"superAdmin.getCrossOrgAnalytics",
				{},
				superAdminMeta
			);

			expect(result.totalBookings).toBe(3);
			expect(result.totalUsers).toBe(3);
			expect(result.orgBreakdown).toHaveLength(2);

			const org1Stats = result.orgBreakdown.find((o) => o.orgId === "org-1");
			expect(org1Stats.bookings).toBe(2);
			expect(org1Stats.users).toBe(2);
			expect(org1Stats.orgName).toBe("Elysium Tours Ghana");

			const org2Stats = result.orgBreakdown.find((o) => o.orgId === "org-2");
			expect(org2Stats.bookings).toBe(1);
			expect(org2Stats.users).toBe(1);
		});
	});
});
