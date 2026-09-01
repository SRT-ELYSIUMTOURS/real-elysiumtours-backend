"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, ATTRACTION_CATEGORIES } = require("../utils/constants");
const { locationPatchFromGpsCoords } = require("../utils/geo.utils");
const { publicCache, TTL } = require("../config/cache.config");
const CacheInvalidation = require("../mixins/cacheInvalidation.mixin");

module.exports = {
	name: "attraction",

	// Writes must clear the cached catalogue reads below.
	mixins: [
		CacheInvalidation({
			actions: ["create", "update", "toggleActive"],
			patterns: ["attraction.**"],
		}),
	],

	dependencies: ["attraction.model", "destination.model"],

	actions: {
		/**
		 * Return the canonical attraction-category vocabulary.
		 * Admin pickers should use this to keep tagging consistent across the catalogue.
		 * Public — no auth required since the list is non-sensitive.
		 */
		listCategories: {
			auth: undefined,
			cache: publicCache([], TTL.STATIC),
			async handler() {
				return Object.values(ATTRACTION_CATEGORIES).map((value) => ({
					value,
					label: value
						.split("_")
						.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
						.join(" "),
				}));
			},
		},

		/**
		 * Find nearby attractions using geospatial query.
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
			cache: publicCache(["destinationId","category","isActive","sort","page","pageSize"]),
			params: {
				destinationId: "string|optional",
				category: "string|optional",
				isActive: { type: "boolean", optional: true, convert: true },
				sort: "string|optional",
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { destinationId, category, isActive, sort, page, pageSize } = ctx.params;
				const query = {};

				if (destinationId) query.destinationId = destinationId;
				if (category) query.category = category;
				if (typeof isActive === "boolean") query.isActive = isActive;

				const SORT_MAP = {
					rating_desc: "-rating",
					rating_asc: "rating",
					name_asc: "name",
					name_desc: "-name",
					price_asc: "entryFee",
					price_desc: "-entryFee",
				};

				const params = { query };
				if (sort && SORT_MAP[sort]) params.sort = SORT_MAP[sort];
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
			cache: publicCache(["destinationId"]),
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
			// $$strict:"remove" makes this whitelist authoritative — see
			// hotelPartner.service.js create for the full rationale.
			//
			// `category` stays a loose string: ATTRACTION_CATEGORIES is a soft enum
			// (see utils/constants.js) so legacy free-form values aren't rejected.
			// The admin picker enforces the vocabulary; the API does not.
			//
			// Server-controlled: rating, reviewCount, organizationId, location.
			params: {
				$$strict: "remove",
				name: "string",
				destinationId: "string",
				category: "string|optional",
				entryFee: { type: "number", optional: true, convert: true },
				description: "string|optional",
				images: "array|optional",
				coverImage: "string|optional",
				duration: "string|optional",
				suitableFor: "array|optional",
				operatingHours: "object|optional",
				contactInfo: "object|optional",
				gpsCoords: "object|optional",
				isActive: { type: "boolean", optional: true, convert: true },
			},
			async handler(ctx) {
				const { destinationId, gpsCoords, ...rest } = ctx.params;

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
					{
						destinationId,
						...rest,
						...locationPatchFromGpsCoords(gpsCoords),
					},
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
			// See create above. organizationId is not accepted: *.model.update is
			// not tenant-scoped by tenantScope.middleware.
			params: {
				$$strict: "remove",
				id: "string",
				name: "string|optional",
				destinationId: "string|optional",
				category: "string|optional",
				entryFee: { type: "number", optional: true, convert: true },
				description: "string|optional",
				images: "array|optional",
				coverImage: "string|optional",
				duration: "string|optional",
				suitableFor: "array|optional",
				isActive: { type: "boolean", optional: true, convert: true },
				operatingHours: "object|optional",
				contactInfo: "object|optional",
				gpsCoords: "object|optional",
			},
			async handler(ctx) {
				const { id, gpsCoords, ...updateFields } = ctx.params;

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
					{
						id,
						...updateFields,
						...locationPatchFromGpsCoords(gpsCoords),
					},
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
