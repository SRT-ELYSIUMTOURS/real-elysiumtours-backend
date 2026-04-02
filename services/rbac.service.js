"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "rbac",

	dependencies: ["role.model", "permission.model", "rolePermission.model"],

	actions: {
		/**
		 * Create a new role.
		 * Requires admin role.
		 */
		createRole: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				description: "string|optional",
				isDefault: "boolean|optional",
			},
			async handler(ctx) {
				const { name, description, isDefault } = ctx.params;

				// Check if role already exists
				const existing = await ctx.call("role.model.find", {
					query: { name },
				});
				if (existing && existing.length > 0) {
					throw new MoleculerClientError(
						`Role "${name}" already exists.`,
						409,
						ERROR_CODES.VALIDATION_ERROR,
						{ name }
					);
				}

				const role = await ctx.call("role.model.create", {
					name,
					description,
					isDefault: isDefault || false,
				});

				this.broker.broadcast("rbac.roleCreated", { role });
				return role;
			},
		},

		/**
		 * List all roles.
		 * Requires admin role.
		 */
		listRoles: {
			auth: "required",
			role: "admin",
			async handler(ctx) {
				return ctx.call("role.model.find", {});
			},
		},

		/**
		 * Create a new permission.
		 * Requires admin role.
		 */
		createPermission: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				description: "string|optional",
				resource: "string|optional",
				action: "string|optional",
			},
			async handler(ctx) {
				const { name, description, resource, action } = ctx.params;

				const existing = await ctx.call("permission.model.find", {
					query: { name },
				});
				if (existing && existing.length > 0) {
					throw new MoleculerClientError(
						`Permission "${name}" already exists.`,
						409,
						ERROR_CODES.VALIDATION_ERROR,
						{ name }
					);
				}

				const permission = await ctx.call("permission.model.create", {
					name,
					description,
					resource,
					action,
				});

				return permission;
			},
		},

		/**
		 * List all permissions.
		 * Requires admin role.
		 */
		listPermissions: {
			auth: "required",
			role: "admin",
			async handler(ctx) {
				return ctx.call("permission.model.find", {});
			},
		},

		/**
		 * Assign a permission to a role.
		 * Requires admin role.
		 */
		assignPermission: {
			auth: "required",
			role: "admin",
			params: {
				roleId: "string",
				permissionId: "string",
			},
			async handler(ctx) {
				const { roleId, permissionId } = ctx.params;

				// Check for duplicate assignment
				const existing = await ctx.call("rolePermission.model.find", {
					query: { roleId, permissionId },
				});
				if (existing && existing.length > 0) {
					throw new MoleculerClientError(
						"Permission is already assigned to this role.",
						409,
						ERROR_CODES.VALIDATION_ERROR,
						{ roleId, permissionId }
					);
				}

				const rolePermission = await ctx.call("rolePermission.model.create", {
					roleId,
					permissionId,
				});

				this.broker.broadcast("rbac.permissionAssigned", { roleId, permissionId });
				return rolePermission;
			},
		},

		/**
		 * Revoke a permission from a role.
		 * Requires admin role.
		 */
		revokePermission: {
			auth: "required",
			role: "admin",
			params: {
				roleId: "string",
				permissionId: "string",
			},
			async handler(ctx) {
				const { roleId, permissionId } = ctx.params;

				const entries = await ctx.call("rolePermission.model.find", {
					query: { roleId, permissionId },
				});

				if (!entries || entries.length === 0) {
					throw new MoleculerClientError(
						"Role-permission mapping not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ roleId, permissionId }
					);
				}

				await ctx.call("rolePermission.model.remove", { id: entries[0]._id });
				return { success: true };
			},
		},

		/**
		 * Get all permissions for a given role.
		 * Requires admin role.
		 */
		getRolePermissions: {
			auth: "required",
			role: "admin",
			params: {
				roleId: "string",
			},
			async handler(ctx) {
				const { roleId } = ctx.params;
				const permissionNames = await this.getPermissionsForRole(roleId);
				return permissionNames;
			},
		},

		/**
		 * Check if a user has a specific permission.
		 * Internal use — no auth required.
		 */
		checkAccess: {
			auth: undefined,
			params: {
				userId: "string",
				permission: "string",
			},
			async handler(ctx) {
				const { userId, permission } = ctx.params;

				// Get the user to find their role
				const user = await ctx.call("users.get", { id: userId }).catch(() => null);
				if (!user) {
					return false;
				}

				// Find the role document by name
				const roles = await ctx.call("role.model.find", {
					query: { name: user.role },
				});
				if (!roles || roles.length === 0) {
					return false;
				}

				const roleId = roles[0]._id.toString();
				const permissions = await this.getPermissionsForRole(roleId);

				return permissions.includes(permission);
			},
		},
	},

	methods: {
		/**
		 * Helper: get all permission names for a given roleId.
		 *
		 * @param {String} roleId - The role's _id
		 * @returns {Promise<String[]>} Array of permission name strings
		 */
		async getPermissionsForRole(roleId) {
			const mappings = await this.broker.call("rolePermission.model.find", {
				query: { roleId },
			});

			if (!mappings || mappings.length === 0) {
				return [];
			}

			const permissionIds = mappings.map((m) => m.permissionId);

			const permissions = await Promise.all(
				permissionIds.map((id) =>
					this.broker.call("permission.model.get", { id: id.toString() }).catch(() => null)
				)
			);

			return permissions.filter(Boolean).map((p) => p.name);
		},
	},

	events: {
		"rbac.roleCreated"(payload) {
			this.logger.info("Role created:", payload.role?.name || payload);
		},

		"rbac.permissionAssigned"(payload) {
			this.logger.info(
				`Permission assigned — roleId: ${payload.roleId}, permissionId: ${payload.permissionId}`
			);
		},
	},
};
