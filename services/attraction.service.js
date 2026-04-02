"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "attraction",

	dependencies: ["attraction.model", "destination.model"],

	actions: {
		/**
		 * Find nearby attractions using geospatial query.
		 * Public action.
		 */
		findNearby: {
			auth: undefined,
			params: {
				lat: "number",
				lng: "number",
				maxDistanceKm: { type: "number", optional: true, default: 10 },
				limit: { type: "number", optional: true, default: 20 },
			},
			async handler(ctx) {
				const { lat, lng, maxDistanceKm, limit } = ctx.params;
				const { kmToMeters } = require("../utils/geo.utils");
				const results = await ctx.call("attraction.model.findByLocation", {
					lng, lat, maxDistanceMeters: kmToMeters(maxDistanceKm), limit,
				}, { meta: ctx.meta });
				return results.map(r => ({ ...r, distanceKm: r.distance ? (r.distance / 1000).toFixed(2) : null }));
			},
		},

		/**
		 * List attractions with optional filters.
		 * Public action.
		 */
		list: {
			auth: undefined,
			params: {
				destinationId: "string|optional",
				category: "string|optional",
				isActive: "boolean|optional",
				page: "number|integer|positive|optional",
				pageSize: "number|integer|positive|optional",
			},
			async handler(ctx) {
				const { destinationId, category, isActive, page, pageSize } = ctx.params;
				const query = {};

				if (destinationId) query.destinationId = destinationId;
				if (category) query.category = category;
				if (typeof isActive === "boolean") query.isActive = isActive;

				const params = { query };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("attraction.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get a single attraction by ID.
		 * Public action.
		 */
		get: {
			auth: undefined,
			params: {
				id: "string",
			},
			async handler(ctx) {
				const attraction = await ctx.call(
					"attraction.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!attraction) {
					throw new MoleculerClientError(
						"Attraction not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return attraction;
			},
		},

		/**
		 * Get all active attractions for a destination.
		 * Public action.
		 */
		getByDestination: {
			auth: undefined,
			params: {
				destinationId: "string",
			},
			async handler(ctx) {
				return ctx.call(
					"attraction.model.find",
					{ query: { destinationId: ctx.params.destinationId, isActive: true } },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Create a new attraction.
		 * Requires admin role.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				destinationId: "string",
				category: "string|optional",
				entryFee: "number|optional",
				description: "string|optional",
				images: "array|optional",
				operatingHours: "object|optional",
				contactInfo: "object|optional",
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
					"attraction.model.create",
					{ destinationId, ...rest },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Update an attraction.
		 * Requires admin role.
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				name: "string|optional",
				destinationId: "string|optional",
				category: "string|optional",
				entryFee: "number|optional",
				description: "string|optional",
				images: "array|optional",
				isActive: "boolean|optional",
				operatingHours: "object|optional",
				contactInfo: "object|optional",
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"attraction.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Attraction not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"attraction.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Toggle the isActive field of an attraction.
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
					"attraction.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Attraction not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"attraction.model.update",
					{ id, isActive: !existing.isActive },
					{ meta: ctx.meta }
				);
			},
		},
	},
};
