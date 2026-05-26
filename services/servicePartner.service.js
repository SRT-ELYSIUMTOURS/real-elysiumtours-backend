"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "servicePartner",

	dependencies: ["servicePartner.model"],

	actions: {
		/**
		 * List service partners with optional filters.
		 * Public action.
		 */
		list: {
			auth: undefined,
			params: {
				isActive: { type: "boolean", optional: true, convert: true },
				serviceType: "string|optional",
				sort: "string|optional",
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { isActive, serviceType, sort, page, pageSize } = ctx.params;
				const query = {};

				if (typeof isActive === "boolean") query.isActive = isActive;
				if (serviceType) query.serviceType = serviceType;

				const SORT_MAP = {
					rating_desc: "-rating",
					rating_asc: "rating",
					name_asc: "name",
					name_desc: "-name",
				};

				const params = { query };
				if (sort && SORT_MAP[sort]) params.sort = SORT_MAP[sort];
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("servicePartner.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get a single service partner by ID.
		 * Public action.
		 */
		get: {
			auth: undefined,
			params: {
				id: "string",
			},
			async handler(ctx) {
				const partner = await ctx.call(
					"servicePartner.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!partner) {
					throw new MoleculerClientError(
						"Service partner not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return partner;
			},
		},

		/**
		 * Create a new service partner.
		 * Requires admin role.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				serviceType: "string|optional",
				description: "string|optional",
				coverImage: "string|optional",
				images: "array|optional",
				priceRange: "string|optional",
				isActive: { type: "boolean", optional: true, convert: true },
				contactInfo: "object|optional",
			},
			async handler(ctx) {
				return ctx.call(
					"servicePartner.model.create",
					ctx.params,
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Update a service partner.
		 * Requires admin role.
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				name: "string|optional",
				serviceType: "string|optional",
				description: "string|optional",
				coverImage: "string|optional",
				images: "array|optional",
				priceRange: "string|optional",
				isActive: { type: "boolean", optional: true, convert: true },
				contactInfo: "object|optional",
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"servicePartner.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Service partner not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"servicePartner.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Toggle the isActive field of a service partner.
		 * Requires admin role.
		 */
		toggleActive: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const existing = await ctx.call(
					"servicePartner.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Service partner not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"servicePartner.model.update",
					{ id, isActive: !existing.isActive },
					{ meta: ctx.meta }
				);
			},
		},
	},
};
