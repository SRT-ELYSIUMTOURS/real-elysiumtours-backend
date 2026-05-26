"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const slugify = require("slugify");
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "destination",

	dependencies: ["destination.model", "hotelPartner.model", "attraction.model", "diningPartner.model"],

	actions: {
		/**
		 * Find all nearby partners (hotels, attractions, dining) for a destination.
		 * Public action.
		 */
		findNearbyPartners: {
			auth: undefined,
			params: {
				destinationId: "string",
				maxDistanceKm: { type: "number", optional: true, default: 15, convert: true },
			},
			async handler(ctx) {
				const dest = await ctx.call("destination.model.get", { id: ctx.params.destinationId }, { meta: ctx.meta }).catch(() => null);
				if (!dest) {
					throw new MoleculerClientError("Destination not found.", 404, ERROR_CODES.DESTINATION_NOT_FOUND);
				}

				// Get coordinates from location GeoJSON or gpsCoords
				let lat, lng;
				if (dest.location && dest.location.coordinates) {
					lng = dest.location.coordinates[0];
					lat = dest.location.coordinates[1];
				} else if (dest.gpsCoords) {
					lat = dest.gpsCoords.lat;
					lng = dest.gpsCoords.lng;
				} else {
					return { hotels: [], attractions: [], dining: [], message: "Destination has no coordinates" };
				}

				const { kmToMeters } = require("../utils/geo.utils");
				const maxDist = kmToMeters(ctx.params.maxDistanceKm);

				// Fetch all partner types in parallel
				const [hotels, attractions, dining] = await Promise.all([
					ctx.call("hotelPartner.model.findByLocation", { lng, lat, maxDistanceMeters: maxDist }, { meta: ctx.meta }).catch(() => []),
					ctx.call("attraction.model.findByLocation", { lng, lat, maxDistanceMeters: maxDist }, { meta: ctx.meta }).catch(() => []),
					ctx.call("diningPartner.model.findByLocation", { lng, lat, maxDistanceMeters: maxDist }, { meta: ctx.meta }).catch(() => []),
				]);

				return {
					hotels: hotels.map(h => ({ ...h, distanceKm: h.distance ? (h.distance / 1000).toFixed(2) : null })),
					attractions: attractions.map(a => ({ ...a, distanceKm: a.distance ? (a.distance / 1000).toFixed(2) : null })),
					dining: dining.map(d => ({ ...d, distanceKm: d.distance ? (d.distance / 1000).toFixed(2) : null })),
				};
			},
		},

		/**
		 * Search destinations using text search with optional filters.
		 * Public action.
		 */
		search: {
			auth: undefined,
			params: {
				query: "string",
				region: "string|optional",
				page: { type: "number", optional: true, convert: true },
				pageSize: { type: "number", optional: true, convert: true },
			},
			async handler(ctx) {
				const { query, region, page = 1, pageSize = 10 } = ctx.params;

				const filter = {
					isActive: true,
				};

				if (query) {
					filter.$text = { $search: query };
				}
				if (region) {
					filter.region = region;
				}

				const destinations = await ctx.call(
					"destination.model.find",
					{ query: filter },
					{ meta: ctx.meta }
				);

				// Paginate
				const total = destinations.length;
				const offset = (page - 1) * pageSize;
				const results = destinations.slice(offset, offset + pageSize);

				return {
					results,
					total,
					page,
					pageSize,
				};
			},
		},

		/**
		 * List destinations with optional filters.
		 * Public action.
		 */
		list: {
			auth: undefined,
			params: {
				region: "string|optional",
				isActive: { type: "boolean", optional: true, convert: true },
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { region, isActive, page, pageSize } = ctx.params;
				const query = {};

				if (region) query.region = region;
				if (typeof isActive === "boolean") query.isActive = isActive;

				const params = { query };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("destination.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get a single destination by ID.
		 * Public action.
		 */
		get: {
			auth: undefined,
			params: {
				id: "string",
			},
			async handler(ctx) {
				const destination = await ctx.call(
					"destination.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!destination) {
					throw new MoleculerClientError(
						"Destination not found.",
						404,
						ERROR_CODES.DESTINATION_NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return destination;
			},
		},

		/**
		 * Get a destination by slug.
		 * Public action.
		 */
		getBySlug: {
			auth: undefined,
			params: {
				slug: "string",
			},
			async handler(ctx) {
				const results = await ctx.call(
					"destination.model.find",
					{ query: { slug: ctx.params.slug } },
					{ meta: ctx.meta }
				);

				if (!results || results.length === 0) {
					throw new MoleculerClientError(
						"Destination not found.",
						404,
						ERROR_CODES.DESTINATION_NOT_FOUND,
						{ slug: ctx.params.slug }
					);
				}

				return results[0];
			},
		},

		/**
		 * Create a new destination.
		 * Requires admin role.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				region: "string",
				description: "string|optional",
				gpsCoords: "object|optional",
				images: "array|optional",
				highlights: "array|optional",
			},
			async handler(ctx) {
				const { name, region, description, gpsCoords, images, highlights } = ctx.params;

				const slug = slugify(name, { lower: true, strict: true });

				const destination = await ctx.call(
					"destination.model.create",
					{
						name,
						slug,
						region,
						description,
						gpsCoords,
						images: images || [],
						highlights: highlights || [],
					},
					{ meta: ctx.meta }
				);

				this.broker.broadcast("destination.created", { destination });
				return destination;
			},
		},

		/**
		 * Update a destination.
		 * Requires admin role.
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				name: "string|optional",
				region: "string|optional",
				description: "string|optional",
				gpsCoords: "object|optional",
				images: "array|optional",
				highlights: "array|optional",
				isActive: { type: "boolean", optional: true, convert: true },
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				// Verify destination exists
				const existing = await ctx.call(
					"destination.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Destination not found.",
						404,
						ERROR_CODES.DESTINATION_NOT_FOUND,
						{ id }
					);
				}

				// Re-generate slug if name changes
				if (updateFields.name) {
					updateFields.slug = slugify(updateFields.name, { lower: true, strict: true });
				}

				return ctx.call(
					"destination.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * List all active destinations in a specific region.
		 * Public action.
		 */
		listByRegion: {
			auth: undefined,
			params: {
				region: "string",
			},
			async handler(ctx) {
				return ctx.call(
					"destination.model.find",
					{ query: { region: ctx.params.region, isActive: true } },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Toggle the isActive field of a destination.
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
					"destination.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Destination not found.",
						404,
						ERROR_CODES.DESTINATION_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"destination.model.update",
					{ id, isActive: !existing.isActive },
					{ meta: ctx.meta }
				);
			},
		},
	},

	events: {
		"destination.created"(payload) {
			this.logger.info("Destination created:", payload.destination?.name || payload);
		},
	},
};
