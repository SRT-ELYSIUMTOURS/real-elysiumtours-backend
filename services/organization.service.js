"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const slugify = require("slugify");
const { ERROR_CODES, ORG_STATUSES } = require("../utils/constants");

// ---- Dot-notation path helpers (no lodash) ----

function getNestedValue(obj, path) {
	return path.split(".").reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}

function setNestedValue(obj, path, value) {
	const keys = path.split(".");
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
			current[keys[i]] = {};
		}
		current = current[keys[i]];
	}
	current[keys[keys.length - 1]] = value;
	return obj;
}

function deleteNestedKey(obj, path) {
	const keys = path.split(".");
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		if (!current[keys[i]]) return obj;
		current = current[keys[i]];
	}
	delete current[keys[keys.length - 1]];
	return obj;
}

// ---- Default org config ----

const DEFAULT_CONFIG = {
	payment: {
		defaultCommitmentFeePercent: 15,
		gracePeriodDays: 5,
		paymentReminderDaysBefore: [7, 3, 1],
	},
	comms: {
		smsProvider: "hubtel",
		whatsappEnabled: false,
	},
	operations: {
		defaultSlaHours: 72,
		maxGroupSize: 50,
		supportedCurrencies: ["GHS"],
	},
	custom: {},
};

function deepMerge(target, source) {
	const result = { ...target };
	for (const key of Object.keys(source)) {
		if (
			source[key] &&
			typeof source[key] === "object" &&
			!Array.isArray(source[key]) &&
			target[key] &&
			typeof target[key] === "object" &&
			!Array.isArray(target[key])
		) {
			result[key] = deepMerge(target[key], source[key]);
		} else {
			result[key] = source[key];
		}
	}
	return result;
}

module.exports = {
	name: "organization",

	dependencies: ["organization.model"],

	actions: {
		/**
		 * Create a new organization.
		 * Requires super_admin role.
		 */
		create: {
			auth: "required",
			role: "super_admin",
			params: {
				name: "string",
				contactEmail: "email|optional",
				contactPhone: "string|optional",
				domain: "string|optional",
				subscription: "object|optional",
				config: "object|optional",
			},
			async handler(ctx) {
				const { name, contactEmail, contactPhone, domain, subscription, config } = ctx.params;

				const slug = slugify(name, { lower: true, strict: true });

				// Check for duplicate slug
				const existing = await ctx.call(
					"organization.model.find",
					{ query: { slug } },
					{ meta: ctx.meta }
				);

				if (existing && existing.length > 0) {
					throw new MoleculerClientError(
						"Organization with this slug already exists.",
						409,
						ERROR_CODES.ORG_SLUG_EXISTS,
						{ slug }
					);
				}

				const orgConfig = config ? deepMerge(DEFAULT_CONFIG, config) : { ...DEFAULT_CONFIG };

				const orgData = {
					name,
					slug,
					contactEmail,
					contactPhone,
					domain,
					config: orgConfig,
					status: ORG_STATUSES.TRIAL,
				};

				if (subscription) {
					orgData.subscription = subscription;
				}

				if (ctx.meta.user && ctx.meta.user.id) {
					orgData.createdBy = ctx.meta.user.id;
				}

				const org = await ctx.call(
					"organization.model.create",
					orgData,
					{ meta: ctx.meta }
				);

				this.broker.broadcast("organization.created", { organization: org });

				return org;
			},
		},

		/**
		 * Get a single organization by ID.
		 * Requires super_admin role.
		 */
		get: {
			auth: "required",
			role: "super_admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const org = await ctx.call(
					"organization.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!org) {
					throw new MoleculerClientError(
						"Organization not found.",
						404,
						ERROR_CODES.ORG_NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return org;
			},
		},

		/**
		 * List organizations with optional filters.
		 * Requires super_admin role.
		 */
		list: {
			auth: "required",
			role: "super_admin",
			params: {
				status: "string|optional",
				plan: "string|optional",
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { status, plan, page, pageSize } = ctx.params;
				const query = {};

				if (status) query.status = status;
				if (plan) query["subscription.plan"] = plan;

				const params = { query };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("organization.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Update an organization.
		 * Requires super_admin role.
		 */
		update: {
			auth: "required",
			role: "super_admin",
			params: {
				id: "string",
				name: "string|optional",
				contactEmail: "string|optional",
				contactPhone: "string|optional",
				domain: "string|optional",
				branding: "object|optional",
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"organization.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Organization not found.",
						404,
						ERROR_CODES.ORG_NOT_FOUND,
						{ id }
					);
				}

				if (updateFields.name) {
					updateFields.slug = slugify(updateFields.name, { lower: true, strict: true });
				}

				return ctx.call(
					"organization.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Suspend an organization.
		 * Requires super_admin role.
		 */
		suspend: {
			auth: "required",
			role: "super_admin",
			params: {
				id: "string",
				reason: "string|optional",
			},
			async handler(ctx) {
				const { id, reason } = ctx.params;

				const existing = await ctx.call(
					"organization.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Organization not found.",
						404,
						ERROR_CODES.ORG_NOT_FOUND,
						{ id }
					);
				}

				const updated = await ctx.call(
					"organization.model.update",
					{ id, status: ORG_STATUSES.SUSPENDED },
					{ meta: ctx.meta }
				);

				this.broker.broadcast("organization.suspended", {
					organization: updated,
					reason: reason || null,
				});

				return updated;
			},
		},

		/**
		 * Activate an organization.
		 * Requires super_admin role.
		 */
		activate: {
			auth: "required",
			role: "super_admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const existing = await ctx.call(
					"organization.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Organization not found.",
						404,
						ERROR_CODES.ORG_NOT_FOUND,
						{ id }
					);
				}

				const updated = await ctx.call(
					"organization.model.update",
					{ id, status: ORG_STATUSES.ACTIVE },
					{ meta: ctx.meta }
				);

				this.broker.broadcast("organization.activated", { organization: updated });

				return updated;
			},
		},

		/**
		 * Get an organization's config object.
		 * Requires admin role.
		 */
		getConfig: {
			auth: "required",
			role: "admin",
			params: {
				organizationId: "string|optional",
				id: "string|optional",
			},
			async handler(ctx) {
				const orgId = ctx.params.organizationId || ctx.params.id;
				const org = await ctx.call(
					"organization.model.get",
					{ id: orgId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!org) {
					throw new MoleculerClientError(
						"Organization not found.",
						404,
						ERROR_CODES.ORG_NOT_FOUND,
						{ id: ctx.params.organizationId }
					);
				}

				return org.config || {};
			},
		},

		/**
		 * Set a nested config value using dot notation path.
		 * Requires super_admin role.
		 */
		setConfig: {
			auth: "required",
			role: "super_admin",
			params: {
				organizationId: "string",
				path: "string",
				value: "any",
			},
			async handler(ctx) {
				const { organizationId, path, value } = ctx.params;

				const org = await ctx.call(
					"organization.model.get",
					{ id: organizationId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!org) {
					throw new MoleculerClientError(
						"Organization not found.",
						404,
						ERROR_CODES.ORG_NOT_FOUND,
						{ id: organizationId }
					);
				}

				const config = org.config ? { ...org.config } : {};
				setNestedValue(config, path, value);

				return ctx.call(
					"organization.model.update",
					{ id: organizationId, config },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Deep merge a config object into existing config.
		 * Requires super_admin role.
		 */
		mergeConfig: {
			auth: "required",
			role: "super_admin",
			params: {
				organizationId: "string",
				config: "object",
			},
			async handler(ctx) {
				const { organizationId, config: newConfig } = ctx.params;

				const org = await ctx.call(
					"organization.model.get",
					{ id: organizationId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!org) {
					throw new MoleculerClientError(
						"Organization not found.",
						404,
						ERROR_CODES.ORG_NOT_FOUND,
						{ id: organizationId }
					);
				}

				const existingConfig = org.config || {};
				const mergedConfig = deepMerge(existingConfig, newConfig);

				return ctx.call(
					"organization.model.update",
					{ id: organizationId, config: mergedConfig },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Delete a key at the dot-notation path from config.
		 * Requires super_admin role.
		 */
		deleteConfigKey: {
			auth: "required",
			role: "super_admin",
			params: {
				organizationId: "string",
				path: "string",
			},
			async handler(ctx) {
				const { organizationId, path } = ctx.params;

				const org = await ctx.call(
					"organization.model.get",
					{ id: organizationId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!org) {
					throw new MoleculerClientError(
						"Organization not found.",
						404,
						ERROR_CODES.ORG_NOT_FOUND,
						{ id: organizationId }
					);
				}

				const config = org.config ? { ...org.config } : {};
				deleteNestedKey(config, path);

				return ctx.call(
					"organization.model.update",
					{ id: organizationId, config },
					{ meta: ctx.meta }
				);
			},
		},
	},

	events: {
		"organization.created"(payload) {
			this.logger.info("Organization created:", payload.organization?.name || payload);
		},
		"organization.suspended"(payload) {
			this.logger.info("Organization suspended:", payload.organization?.name || payload);
		},
		"organization.activated"(payload) {
			this.logger.info("Organization activated:", payload.organization?.name || payload);
		},
	},
};
