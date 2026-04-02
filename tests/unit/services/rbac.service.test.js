"use strict";

const { ServiceBroker } = require("moleculer");
const RbacService = require("../../../services/rbac.service");

describe("rbac.service", () => {
	let broker;

	// Stub data stores
	const roles = [];
	const permissions = [];
	const rolePermissions = [];
	let idCounter = 1;

	function makeId() {
		return String(idCounter++);
	}

	beforeAll(async () => {
		broker = new ServiceBroker({ logger: false });

		// ---- Stub: role.model ----
		broker.createService({
			name: "role.model",
			actions: {
				create(ctx) {
					const role = { _id: makeId(), ...ctx.params, createdAt: new Date() };
					roles.push(role);
					return role;
				},
				find(ctx) {
					const query = ctx.params.query || {};
					return roles.filter((r) => {
						return Object.keys(query).every((k) => r[k] === query[k]);
					});
				},
				get(ctx) {
					return roles.find((r) => r._id === ctx.params.id) || null;
				},
			},
		});

		// ---- Stub: permission.model ----
		broker.createService({
			name: "permission.model",
			actions: {
				create(ctx) {
					const perm = { _id: makeId(), ...ctx.params, createdAt: new Date() };
					permissions.push(perm);
					return perm;
				},
				find(ctx) {
					const query = ctx.params.query || {};
					return permissions.filter((p) => {
						return Object.keys(query).every((k) => p[k] === query[k]);
					});
				},
				get(ctx) {
					return permissions.find((p) => p._id === ctx.params.id) || null;
				},
			},
		});

		// ---- Stub: rolePermission.model ----
		broker.createService({
			name: "rolePermission.model",
			actions: {
				create(ctx) {
					const rp = { _id: makeId(), ...ctx.params, createdAt: new Date() };
					rolePermissions.push(rp);
					return rp;
				},
				find(ctx) {
					const query = ctx.params.query || {};
					return rolePermissions.filter((rp) => {
						return Object.keys(query).every((k) => String(rp[k]) === String(query[k]));
					});
				},
				remove(ctx) {
					const idx = rolePermissions.findIndex((rp) => String(rp._id) === String(ctx.params.id));
					if (idx !== -1) rolePermissions.splice(idx, 1);
					return { success: true };
				},
			},
		});

		// ---- Stub: users ----
		broker.createService({
			name: "users",
			actions: {
				get(ctx) {
					if (ctx.params.id === "user-admin") {
						return { _id: "user-admin", role: "admin" };
					}
					if (ctx.params.id === "user-customer") {
						return { _id: "user-customer", role: "customer" };
					}
					return null;
				},
			},
		});

		// ---- Load the real RBAC service ----
		broker.createService(RbacService);

		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		// Clear stub stores between tests
		roles.length = 0;
		permissions.length = 0;
		rolePermissions.length = 0;
	});

	// ---- createRole ----

	describe("createRole", () => {
		it("should create a role and return it", async () => {
			const result = await broker.call("rbac.createRole", {
				name: "admin",
				description: "Full access",
			});

			expect(result).toBeDefined();
			expect(result.name).toBe("admin");
			expect(result.description).toBe("Full access");
			expect(result._id).toBeDefined();
		});

		it("should throw on duplicate role name", async () => {
			await broker.call("rbac.createRole", { name: "staff" });

			await expect(
				broker.call("rbac.createRole", { name: "staff" })
			).rejects.toThrow(/already exists/);
		});
	});

	// ---- listRoles ----

	describe("listRoles", () => {
		it("should return an array of roles", async () => {
			await broker.call("rbac.createRole", { name: "customer" });
			await broker.call("rbac.createRole", { name: "admin" });

			const result = await broker.call("rbac.listRoles");

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
		});
	});

	// ---- assignPermission ----

	describe("assignPermission", () => {
		it("should assign a permission to a role", async () => {
			const role = await broker.call("rbac.createRole", { name: "admin" });
			const perm = await broker.call("rbac.createPermission", { name: "user.list" });

			const result = await broker.call("rbac.assignPermission", {
				roleId: role._id,
				permissionId: perm._id,
			});

			expect(result).toBeDefined();
			expect(result.roleId).toBe(role._id);
			expect(result.permissionId).toBe(perm._id);
		});

		it("should throw on duplicate assignment", async () => {
			const role = await broker.call("rbac.createRole", { name: "admin" });
			const perm = await broker.call("rbac.createPermission", { name: "user.list" });

			await broker.call("rbac.assignPermission", {
				roleId: role._id,
				permissionId: perm._id,
			});

			await expect(
				broker.call("rbac.assignPermission", {
					roleId: role._id,
					permissionId: perm._id,
				})
			).rejects.toThrow(/already assigned/);
		});
	});

	// ---- checkAccess ----

	describe("checkAccess", () => {
		it("should return true when user has the permission", async () => {
			// Set up role + permission + mapping
			const role = await broker.call("rbac.createRole", { name: "admin" });
			const perm = await broker.call("rbac.createPermission", { name: "admin.dashboard" });

			await broker.call("rbac.assignPermission", {
				roleId: role._id,
				permissionId: perm._id,
			});

			const result = await broker.call("rbac.checkAccess", {
				userId: "user-admin",
				permission: "admin.dashboard",
			});

			expect(result).toBe(true);
		});

		it("should return false when user lacks the permission", async () => {
			// Create the customer role but don't assign the permission
			await broker.call("rbac.createRole", { name: "customer" });

			const result = await broker.call("rbac.checkAccess", {
				userId: "user-customer",
				permission: "admin.dashboard",
			});

			expect(result).toBe(false);
		});
	});
});
