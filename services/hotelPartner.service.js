"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "hotelPartner",

	dependencies: ["hotelPartner.model", "destination.model"],

	actions: {
		/**
		 * Find nearby hotel partners using geospatial query.
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
				const results = await ctx.call("hotelPartner.model.findByLocation", {
					lng, lat, maxDistanceMeters: kmToMeters(maxDistanceKm), limit,
				}, { meta: ctx.meta });
				return results.map(r => ({ ...r, distanceKm: r.distance ? (r.distance / 1000).toFixed(2) : null }));
			},
		},

		/**
		 * List hotel partners with optional filters.
		 * Public action.
		 */
		list: {
			auth: undefined,
			params: {
				destinationId: "string|optional",
				tier: "string|optional",
				isActive: "boolean|optional",
				page: "number|integer|positive|optional",
				pageSize: "number|integer|positive|optional",
			},
			async handler(ctx) {
				const { destinationId, tier, isActive, page, pageSize } = ctx.params;
				const query = {};

				if (destinationId) query.destinationId = destinationId;
				if (tier) query.tier = tier;
				if (typeof isActive === "boolean") query.isActive = isActive;

				const params = { query };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("hotelPartner.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get a single hotel partner by ID.
		 * Public action.
		 */
		get: {
			auth: undefined,
			params: {
				id: "string",
			},
			async handler(ctx) {
				const partner = await ctx.call(
					"hotelPartner.model.get",
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
		 * Check hotel availability for a given date range.
		 * Internal action used by booking service.
		 */
		checkAvailability: {
			auth: undefined,
			params: {
				hotelId: "string",
				checkInDate: "string",
				checkOutDate: "string|optional",
			},
			async handler(ctx) {
				const { hotelId, checkInDate, checkOutDate } = ctx.params;

				const hotel = await ctx.call("hotelPartner.model.get", { id: hotelId }, { meta: ctx.meta }).catch(() => null);
				if (!hotel) {
					return { available: false, inventoryModel: "on_request", reason: "Hotel partner not found" };
				}

				// Check if hotel is active
				if (!hotel.isActive) {
					return { available: false, inventoryModel: hotel.inventoryModel, reason: "Hotel partner is inactive" };
				}

				// Check availability status
				if (hotel.availabilityStatus === "unavailable") {
					return { available: false, inventoryModel: hotel.inventoryModel, reason: "Hotel marked as unavailable" };
				}

				// Check close-out dates
				const checkIn = new Date(checkInDate);
				const checkOut = checkOutDate ? new Date(checkOutDate) : new Date(checkIn.getTime() + 86400000); // default 1 night

				if (hotel.closeOutDates && hotel.closeOutDates.length > 0) {
					for (const closeOut of hotel.closeOutDates) {
						const coStart = new Date(closeOut.startDate);
						const coEnd = new Date(closeOut.endDate);
						// Overlap check: checkIn < coEnd AND checkOut > coStart
						if (checkIn < coEnd && checkOut > coStart) {
							return {
								available: false,
								inventoryModel: hotel.inventoryModel,
								reason: `Hotel closed out from ${closeOut.startDate} to ${closeOut.endDate}: ${closeOut.reason || "No reason given"}`,
							};
						}
					}
				}

				// For free_sale with no close-out conflicts: auto-available
				// For on_request: available but needs manual confirmation
				return {
					available: true,
					inventoryModel: hotel.inventoryModel || "on_request",
					hotel: { _id: hotel._id, name: hotel.name, tier: hotel.tier },
					needsConfirmation: hotel.inventoryModel === "on_request" || !hotel.inventoryModel,
				};
			},
		},

		/**
		 * Get all active hotels for a destination.
		 * Public action.
		 */
		getByDestination: {
			auth: undefined,
			params: {
				destinationId: "string",
			},
			async handler(ctx) {
				return ctx.call(
					"hotelPartner.model.find",
					{ query: { destinationId: ctx.params.destinationId, isActive: true } },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Create a new hotel partner.
		 * Requires admin role.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				destinationId: "string",
				tier: "string",
				commissionRate: "number|optional",
				contactInfo: "object|optional",
				inventoryModel: "string|optional",
				contractStatus: "string|optional",
				rateData: "object|optional",
				availabilityStatus: "string|optional",
				closeOutDates: "array|optional",
				amenities: "array|optional",
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

				const partner = await ctx.call(
					"hotelPartner.model.create",
					{ destinationId, ...rest },
					{ meta: ctx.meta }
				);

				this.broker.broadcast("partner.hotelCreated", { partner });
				return partner;
			},
		},

		/**
		 * Update a hotel partner.
		 * Requires admin role.
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				name: "string|optional",
				destinationId: "string|optional",
				tier: "string|optional",
				commissionRate: "number|optional",
				contactInfo: "object|optional",
				inventoryModel: "string|optional",
				contractStatus: "string|optional",
				rateData: "object|optional",
				availabilityStatus: "string|optional",
				closeOutDates: "array|optional",
				amenities: "array|optional",
				images: "array|optional",
				isActive: "boolean|optional",
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"hotelPartner.model.get",
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
					"hotelPartner.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Set the commission rate for a hotel partner.
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
					"hotelPartner.model.get",
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
					"hotelPartner.model.update",
					{ id, commissionRate },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Update availability status for a hotel partner.
		 * Requires admin role.
		 */
		updateAvailability: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				availabilityStatus: "string",
			},
			async handler(ctx) {
				const { id, availabilityStatus } = ctx.params;

				const existing = await ctx.call(
					"hotelPartner.model.get",
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
					"hotelPartner.model.update",
					{ id, availabilityStatus },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Add close-out dates to a hotel partner.
		 * Requires admin role.
		 */
		addCloseOutDates: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				startDate: "string",
				endDate: "string",
				reason: "string|optional",
			},
			async handler(ctx) {
				const { id, startDate, endDate, reason } = ctx.params;

				const existing = await ctx.call(
					"hotelPartner.model.get",
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

				const closeOutDates = existing.closeOutDates || [];
				closeOutDates.push({
					startDate: new Date(startDate),
					endDate: new Date(endDate),
					reason: reason || "",
				});

				return ctx.call(
					"hotelPartner.model.update",
					{ id, closeOutDates },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Toggle the isActive field of a hotel partner.
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
					"hotelPartner.model.get",
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
					"hotelPartner.model.update",
					{ id, isActive: !existing.isActive },
					{ meta: ctx.meta }
				);
			},
		},
	},

	events: {
		"partner.hotelCreated"(payload) {
			this.logger.info("Hotel partner created:", payload.partner?.name || payload);
		},
	},
};
