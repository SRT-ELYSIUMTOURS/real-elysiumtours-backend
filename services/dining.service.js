"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "dining",

	dependencies: ["diningPartner.model", "destination.model"],

	actions: {
		/**
		 * Find nearby dining partners using geospatial query.
		 * Public action.
		 */
		findNearby: {
			auth: undefined,
			params: {
				lat: "number",
				lng: "number",
				maxDistanceKm: { type: "number", optional: true, default: 10, convert: true },
				limit: { type: "number", optional: true, default: 20, convert: true },
			},
			async handler(ctx) {
				const { lat, lng, maxDistanceKm, limit } = ctx.params;
				const { kmToMeters } = require("../utils/geo.utils");
				const results = await ctx.call("diningPartner.model.findByLocation", {
					lng, lat, maxDistanceMeters: kmToMeters(maxDistanceKm), limit,
				}, { meta: ctx.meta });
				return results.map(r => ({ ...r, distanceKm: r.distance ? (r.distance / 1000).toFixed(2) : null }));
			},
		},

		/**
		 * List dining partners with optional filters.
		 * Public action.
		 */
		list: {
			auth: undefined,
			params: {
				destinationId: "string|optional",
				cuisineType: "string|optional",
				isActive: "boolean|optional",
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { destinationId, cuisineType, isActive, page, pageSize } = ctx.params;
				const query = {};

				if (destinationId) query.destinationId = destinationId;
				if (cuisineType) query.cuisineType = cuisineType;
				if (typeof isActive === "boolean") query.isActive = isActive;

				const params = { query };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("diningPartner.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get a single dining partner by ID.
		 * Public action.
		 */
		get: {
			auth: undefined,
			params: {
				id: "string",
			},
			async handler(ctx) {
				const partner = await ctx.call(
					"diningPartner.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!partner) {
					throw new MoleculerClientError(
						"Partner not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return partner;
			},
		},

		/**
		 * Get all active dining partners for a destination.
		 * Public action.
		 */
		getByDestination: {
			auth: undefined,
			params: {
				destinationId: "string",
			},
			async handler(ctx) {
				return ctx.call(
					"diningPartner.model.find",
					{ query: { destinationId: ctx.params.destinationId, isActive: true } },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Create a new dining partner.
		 * Requires admin role.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				destinationId: "string",
				cuisineType: "string|optional",
				tier: "string|optional",
				commissionRate: { type: "number", optional: true, convert: true },
				contactInfo: "object|optional",
				menuOptions: "array|optional",
				images: "array|optional",
			},
			async handler(ctx) {
				const { destinationId, ...rest } = ctx.params;

				// Validate destination exists
				const destination = await ctx.call(
					"destination.model.get",
					{ id: destinationId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!destination) {
					throw new MoleculerClientError(
						"Destination not found.",
						404,
						ERROR_CODES.DESTINATION_NOT_FOUND,
						{ destinationId }
					);
				}

				return ctx.call(
					"diningPartner.model.create",
					{ destinationId, ...rest },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Update a dining partner.
		 * Requires admin role.
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				name: "string|optional",
				destinationId: "string|optional",
				cuisineType: "string|optional",
				tier: "string|optional",
				commissionRate: { type: "number", optional: true, convert: true },
				contactInfo: "object|optional",
				menuOptions: "array|optional",
				images: "array|optional",
				isActive: "boolean|optional",
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"diningPartner.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Partner not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"diningPartner.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Set the commission rate for a dining partner.
		 * Requires admin role.
		 */
		setCommission: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				commissionRate: "number",
			},
			async handler(ctx) {
				const { id, commissionRate } = ctx.params;

				const existing = await ctx.call(
					"diningPartner.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Partner not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"diningPartner.model.update",
					{ id, commissionRate },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Toggle the isActive field of a dining partner.
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
					"diningPartner.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Partner not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"diningPartner.model.update",
					{ id, isActive: !existing.isActive },
					{ meta: ctx.meta }
				);
			},
		},
	},
};
