"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, USER_ROLES } = require("../utils/constants");

module.exports = {
	name: "superAdmin",

	dependencies: ["organization.model", "user.model", "booking.model", "payment.model"],

	actions: {
		/**
		 * List all organizations with optional filters and per-org stats.
		 */
		listOrganizations: {
			auth: "required",
			role: "super_admin",
			params: {
				status: { type: "string", optional: true },
				plan: { type: "string", optional: true },
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { status, plan, page, pageSize } = ctx.params;
				const query = {};

				if (status) query.status = status;
				if (plan) query["subscription.plan"] = plan;

				const findParams = { query };
				if (page) findParams.page = page;
				if (pageSize) findParams.pageSize = pageSize;

				const organizations = await ctx.call(
					"organization.model.find",
					findParams,
					{ meta: ctx.meta }
				);

				// Get total count (unfiltered by page for pagination)
				const allMatching = await ctx.call(
					"organization.model.find",
					{ query },
					{ meta: ctx.meta }
				);
				const total = allMatching.length;

				// Enrich each org with user count and booking count
				const enriched = await Promise.all(
					organizations.map(async (org) => {
						const orgId = org._id ? org._id.toString() : org._id;

						const users = await ctx.call(
							"user.model.find",
							{ query: { organizationId: orgId } },
							{ meta: ctx.meta }
						);

						const bookings = await ctx.call(
							"booking.model.find",
							{ query: { organizationId: orgId } },
							{ meta: ctx.meta }
						);

						return {
							...org,
							userCount: users.length,
							bookingCount: bookings.length,
						};
					})
				);

				return { organizations: enriched, total };
			},
		},

		/**
		 * Get a single organization with stats (userCount, bookingCount, revenue).
		 */
		getOrganization: {
			auth: "required",
			role: "super_admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const org = await ctx.call(
					"organization.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!org) {
					throw new MoleculerClientError(
						"Organization not found.",
						404,
						ERROR_CODES.ORG_NOT_FOUND,
						{ id }
					);
				}

				const orgId = org._id ? org._id.toString() : org._id;

				const [users, bookings, payments] = await Promise.all([
					ctx.call("user.model.find", { query: { organizationId: orgId } }, { meta: ctx.meta }),
					ctx.call("booking.model.find", { query: { organizationId: orgId } }, { meta: ctx.meta }),
					ctx.call("payment.model.find", { query: { organizationId: orgId, status: "success" } }, { meta: ctx.meta }),
				]);

				const revenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

				return {
					...org,
					userCount: users.length,
					bookingCount: bookings.length,
					revenue,
				};
			},
		},

		/**
		 * Create an organization and its first admin user.
		 */
		createOrganization: {
			auth: "required",
			role: "super_admin",
			params: {
				name: "string",
				contactEmail: "email",
				contactPhone: { type: "string", optional: true },
				domain: { type: "string", optional: true },
				plan: { type: "enum", values: ["free", "basic", "professional", "enterprise"], optional: true },
				subscriptionStatus: { type: "enum", values: ["active", "trial", "expired", "cancelled"], optional: true },
				branding: { type: "object", optional: true },
				adminEmail: "email",
				adminPassword: "string",
				adminFirstName: "string",
				adminLastName: "string",
				config: { type: "object", optional: true },
			},
			async handler(ctx) {
				const {
					name,
					contactEmail,
					contactPhone,
					domain,
					plan,
					subscriptionStatus,
					branding,
					adminEmail,
					adminPassword,
					adminFirstName,
					adminLastName,
					config,
				} = ctx.params;

				// Create the organization via the organization service
				const createParams = { name, contactEmail };
				if (contactPhone) createParams.contactPhone = contactPhone;
				if (domain) createParams.domain = domain;
				if (branding) createParams.branding = branding;
				if (plan || subscriptionStatus) {
					createParams.subscription = {
						plan: plan || "free",
						status: subscriptionStatus || (plan === "free" ? "active" : "trial"),
						startDate: new Date(),
					};
				}
				if (config) createParams.config = config;

				const organization = await ctx.call(
					"organization.create",
					createParams,
					{ meta: ctx.meta }
				);

				const orgId = organization._id ? organization._id.toString() : organization._id;

				// Create admin user for this org (hash password first)
				const bcrypt = require("bcrypt");
				const hashedPassword = await bcrypt.hash(adminPassword, 12);
				const adminUser = await ctx.call(
					"user.model.create",
					{
						email: adminEmail,
						password: hashedPassword,
						firstName: adminFirstName,
						lastName: adminLastName,
						role: USER_ROLES.ADMIN,
						organizationId: orgId,
						isVerified: true,
						status: "active",
					},
					{ meta: ctx.meta }
				);

				return {
					organization,
					adminUser: {
						email: adminUser.email,
						role: adminUser.role,
					},
				};
			},
		},

		/**
		 * Suspend an organization.
		 */
		suspendOrganization: {
			auth: "required",
			role: "super_admin",
			params: {
				id: "string",
				reason: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { id, reason } = ctx.params;

				const params = { id };
				if (reason) params.reason = reason;

				return ctx.call("organization.suspend", params, { meta: ctx.meta });
			},
		},

		/**
		 * Activate an organization.
		 */
		activateOrganization: {
			auth: "required",
			role: "super_admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				return ctx.call("organization.activate", { id: ctx.params.id }, { meta: ctx.meta });
			},
		},

		/**
		 * Delete an organization and all its associated data.
		 * Only super_admin can perform this action.
		 */
		deleteOrganization: {
			auth: "required",
			role: "super_admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const org = await ctx.call(
					"organization.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!org) {
					throw new MoleculerClientError(
						"Organization not found.",
						404,
						ERROR_CODES.ORG_NOT_FOUND,
						{ id }
					);
				}

				// Remove all users belonging to this org
				const users = await ctx.call(
					"user.model.find",
					{ query: { organizationId: id } },
					{ meta: ctx.meta }
				);
				for (const user of users) {
					await ctx.call("user.model.remove", { id: user._id.toString() }, { meta: ctx.meta }).catch(() => null);
				}

				// Remove the organization
				await ctx.call("organization.model.remove", { id }, { meta: ctx.meta });

				return { deleted: true, orgId: id, usersRemoved: users.length };
			},
		},

		/**
		 * Get platform-wide health metrics.
		 */
		getPlatformHealth: {
			auth: "required",
			role: "super_admin",
			params: {},
			async handler(ctx) {
				const [allOrgs, activeOrgs, allUsers, allBookings] = await Promise.all([
					ctx.call("organization.model.find", { query: {} }, { meta: ctx.meta }),
					ctx.call("organization.model.find", { query: { status: "active" } }, { meta: ctx.meta }),
					ctx.call("user.model.find", { query: {} }, { meta: ctx.meta }),
					ctx.call("booking.model.find", { query: {} }, { meta: ctx.meta }),
				]);

				// Get list of registered services from broker
				const serviceList = this.broker.registry
					? this.broker.registry.getServiceList({ withActions: false })
					: [];
				const servicesRunning = serviceList.map((s) => s.name);

				return {
					totalOrganizations: allOrgs.length,
					activeOrganizations: activeOrgs.length,
					totalUsers: allUsers.length,
					totalBookings: allBookings.length,
					servicesRunning,
				};
			},
		},

		/**
		 * Aggregate revenue across all organizations.
		 */
		getCrossOrgRevenue: {
			auth: "required",
			role: "super_admin",
			params: {
				startDate: { type: "string", optional: true },
				endDate: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { startDate, endDate } = ctx.params;

				const paymentQuery = { status: "success" };
				if (startDate || endDate) {
					paymentQuery.createdAt = {};
					if (startDate) paymentQuery.createdAt.$gte = new Date(startDate).toISOString();
					if (endDate) paymentQuery.createdAt.$lte = new Date(endDate).toISOString();
				}

				const payments = await ctx.call(
					"payment.model.find",
					{ query: paymentQuery },
					{ meta: ctx.meta }
				);

				// Get all orgs for name lookup
				const orgs = await ctx.call(
					"organization.model.find",
					{ query: {} },
					{ meta: ctx.meta }
				);
				const orgMap = {};
				for (const org of orgs) {
					const id = org._id ? org._id.toString() : org._id;
					orgMap[id] = org.name;
				}

				// Aggregate by org
				const revenueByOrg = {};
				let totalRevenue = 0;

				for (const payment of payments) {
					const orgId = payment.organizationId
						? payment.organizationId.toString()
						: "unknown";
					if (!revenueByOrg[orgId]) {
						revenueByOrg[orgId] = 0;
					}
					revenueByOrg[orgId] += payment.amount || 0;
					totalRevenue += payment.amount || 0;
				}

				const orgBreakdown = Object.entries(revenueByOrg).map(([orgId, revenue]) => ({
					orgId,
					orgName: orgMap[orgId] || "Unknown",
					revenue,
				}));

				return { totalRevenue, orgBreakdown };
			},
		},

		/**
		 * Cross-org analytics: bookings and users per organization.
		 */
		getCrossOrgAnalytics: {
			auth: "required",
			role: "super_admin",
			params: {
				startDate: { type: "string", optional: true },
				endDate: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { startDate, endDate } = ctx.params;

				const dateQuery = {};
				if (startDate || endDate) {
					dateQuery.createdAt = {};
					if (startDate) dateQuery.createdAt.$gte = new Date(startDate).toISOString();
					if (endDate) dateQuery.createdAt.$lte = new Date(endDate).toISOString();
				}

				const [bookings, users, orgs] = await Promise.all([
					ctx.call("booking.model.find", { query: { ...dateQuery } }, { meta: ctx.meta }),
					ctx.call("user.model.find", { query: { ...dateQuery } }, { meta: ctx.meta }),
					ctx.call("organization.model.find", { query: {} }, { meta: ctx.meta }),
				]);

				const orgMap = {};
				for (const org of orgs) {
					const id = org._id ? org._id.toString() : org._id;
					orgMap[id] = org.name;
				}

				// Aggregate bookings by org
				const bookingsByOrg = {};
				for (const booking of bookings) {
					const orgId = booking.organizationId
						? booking.organizationId.toString()
						: "unknown";
					if (!bookingsByOrg[orgId]) bookingsByOrg[orgId] = 0;
					bookingsByOrg[orgId]++;
				}

				// Aggregate users by org
				const usersByOrg = {};
				for (const user of users) {
					const orgId = user.organizationId
						? user.organizationId.toString()
						: "unknown";
					if (!usersByOrg[orgId]) usersByOrg[orgId] = 0;
					usersByOrg[orgId]++;
				}

				// Combine into breakdown
				const allOrgIds = new Set([
					...Object.keys(bookingsByOrg),
					...Object.keys(usersByOrg),
				]);

				const orgBreakdown = Array.from(allOrgIds).map((orgId) => ({
					orgId,
					orgName: orgMap[orgId] || "Unknown",
					bookings: bookingsByOrg[orgId] || 0,
					users: usersByOrg[orgId] || 0,
				}));

				return {
					totalBookings: bookings.length,
					totalUsers: users.length,
					orgBreakdown,
				};
			},
		},
	},

	events: {},

	methods: {},
};
