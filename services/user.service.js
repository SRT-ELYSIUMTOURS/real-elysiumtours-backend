"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const bcrypt = require("bcrypt");
const { ERROR_CODES } = require("../utils/constants");

const SALT_ROUNDS = 12;

module.exports = {
	name: "user",
	dependencies: ["user.model"],

	actions: {
		/**
		 * Create a staff or admin user (admin only).
		 */
		createStaffUser: {
			auth: "required",
			role: "admin",
			params: {
				email: "email",
				password: "string",
				firstName: "string",
				lastName: "string",
				phone: { type: "string", optional: true },
				role: { type: "enum", values: ["staff", "admin"], optional: true },
			},
			async handler(ctx) {
				const { email, password, firstName, lastName, phone, role: userRole } = ctx.params;

				// Check if email already exists
				const existing = await ctx.call("user.model.find", { query: { email: email.toLowerCase() } });
				if (existing && existing.length > 0) {
					throw new MoleculerClientError(
						"A user with this email already exists.",
						409,
						"EMAIL_ALREADY_EXISTS"
					);
				}

				const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

				const createParams = {
					email: email.toLowerCase(),
					password: hashedPassword,
					firstName,
					lastName,
					phone: phone || undefined,
					role: userRole || "staff",
					isVerified: true,
					status: "active",
				};

				// If caller has an orgId, assign user to that org
				if (ctx.meta.organizationId) {
					createParams.organizationId = ctx.meta.organizationId.toString();
				}

				const user = await ctx.call("user.model.create", createParams, { meta: ctx.meta });

				// Return without sensitive fields
				return {
					id: user._id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					role: user.role,
					status: user.status,
					organizationId: user.organizationId,
				};
			},
		},

		/**
		 * Get the authenticated user's profile.
		 */
		getProfile: {
			auth: "required",
			async handler(ctx) {
				const userId = ctx.meta.user.id;

				const user = await ctx.call("user.model.get", { id: userId });
				if (!user) {
					throw new MoleculerClientError(
						"User not found.",
						404,
						ERROR_CODES.USER_NOT_FOUND
					);
				}

				return user;
			},
		},

		/**
		 * Update the authenticated user's profile.
		 * Cannot update email, role, or password through this endpoint.
		 */
		updateProfile: {
			auth: "required",
			params: {
				firstName: "string|optional",
				lastName: "string|optional",
				phone: "string|optional",
			},
			async handler(ctx) {
				const userId = ctx.meta.user.id;
				const { firstName, lastName, phone } = ctx.params;

				const updateData = { id: userId };
				if (firstName !== undefined) updateData.firstName = firstName;
				if (lastName !== undefined) updateData.lastName = lastName;
				if (phone !== undefined) updateData.phone = phone;

				const updated = await ctx.call("user.model.update", updateData);
				return updated;
			},
		},

		/**
		 * List users with optional filters (admin only).
		 */
		listUsers: {
			auth: "required",
			role: "admin",
			params: {
				page: { type: "number", optional: true, integer: true, positive: true, convert: true },
				pageSize: { type: "number", optional: true, integer: true, positive: true, max: 100, convert: true },
				role: "string|optional",
				status: "string|optional",
			},
			async handler(ctx) {
				const { page = 1, pageSize = 10, role, status } = ctx.params;

				const query = {};
				if (role) query.role = role;
				if (status) query.status = status;

				// Org-scoped admins only see users in their org; super_admin sees all
				if (ctx.meta.user.role !== "super_admin" && ctx.meta.organizationId) {
					query.organizationId = ctx.meta.organizationId.toString();
				}

				// Never expose super_admin accounts to org admins
				if (ctx.meta.user.role !== "super_admin") {
					query.role = query.role || { $ne: "super_admin" };
				}

				const result = await ctx.call("user.model.list", {
					page,
					pageSize,
					query,
				});

				return result;
			},
		},

		/**
		 * Get a specific user by ID (admin only).
		 */
		getUserById: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const user = await ctx.call("user.model.get", { id });
				if (!user) {
					throw new MoleculerClientError(
						"User not found.",
						404,
						ERROR_CODES.USER_NOT_FOUND
					);
				}

				// Prevent org admins from viewing super_admin accounts
				if (user.role === "super_admin" && ctx.meta.user.role !== "super_admin") {
					throw new MoleculerClientError(
						"User not found.",
						404,
						ERROR_CODES.USER_NOT_FOUND
					);
				}

				// Prevent org admins from viewing users outside their org
				if (ctx.meta.user.role !== "super_admin" && ctx.meta.organizationId) {
					const targetOrgId = user.organizationId ? user.organizationId.toString() : null;
					if (targetOrgId !== ctx.meta.organizationId.toString()) {
						throw new MoleculerClientError(
							"User not found.",
							404,
							ERROR_CODES.USER_NOT_FOUND
						);
					}
				}

				return user;
			},
		},

		/**
		 * Update user status (admin only).
		 */
		updateUserStatus: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				status: { type: "enum", values: ["active", "inactive", "suspended"] },
			},
			async handler(ctx) {
				const { id, status } = ctx.params;
				const callerRole = ctx.meta.user.role;

				const user = await ctx.call("user.model.get", { id });
				if (!user) {
					throw new MoleculerClientError(
						"User not found.",
						404,
						ERROR_CODES.USER_NOT_FOUND
					);
				}

				// Prevent admin from modifying super_admin accounts
				if (user.role === "super_admin" && callerRole !== "super_admin") {
					throw new MoleculerClientError(
						"Cannot modify a super admin account.",
						403,
						ERROR_CODES.FORBIDDEN
					);
				}

				// Prevent admin from modifying users outside their org (unless super_admin)
				if (callerRole !== "super_admin" && ctx.meta.organizationId) {
					const targetOrgId = user.organizationId ? user.organizationId.toString() : null;
					if (targetOrgId !== ctx.meta.organizationId.toString()) {
						throw new MoleculerClientError(
							"Cannot modify users outside your organization.",
							403,
							ERROR_CODES.FORBIDDEN
						);
					}
				}

				const updated = await ctx.call("user.model.update", { id, status });
				return updated;
			},
		},

		/**
		 * Change the authenticated user's password.
		 */
		changePassword: {
			auth: "required",
			params: {
				currentPassword: "string",
				newPassword: "string|min:8",
			},
			async handler(ctx) {
				const userId = ctx.meta.user.id;

				// Get user with password via direct Mongoose access
				const svc = this.broker.getLocalService("user.model");
				if (!svc || !svc.adapter || !svc.adapter.model) {
					throw new MoleculerClientError(
						"Internal error.",
						500,
						ERROR_CODES.INTERNAL_ERROR
					);
				}

				const user = await svc.adapter.model.findById(userId).lean();
				if (!user) {
					throw new MoleculerClientError(
						"User not found.",
						404,
						ERROR_CODES.USER_NOT_FOUND
					);
				}

				const isMatch = await bcrypt.compare(ctx.params.currentPassword, user.password);
				if (!isMatch) {
					throw new MoleculerClientError(
						"Current password is incorrect.",
						401,
						ERROR_CODES.INVALID_CREDENTIALS
					);
				}

				const hashedPassword = await bcrypt.hash(ctx.params.newPassword, SALT_ROUNDS);

				await ctx.call("user.model.update", {
					id: userId,
					password: hashedPassword,
					refreshToken: null, // Invalidate existing sessions
				});

				return { message: "Password changed successfully." };
			},
		},
	},
};
