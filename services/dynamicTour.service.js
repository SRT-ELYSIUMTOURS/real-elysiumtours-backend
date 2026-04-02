"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const crypto = require("crypto");
const { ERROR_CODES, TOUR_REQUEST_STATUSES, QUOTE_STATUSES } = require("../utils/constants");
const { TOUR_REQUEST_TRANSITIONS, QUOTE_TRANSITIONS, isValidTransition } = require("../config/bookingStates.config");

/** Statuses from which a customer may cancel a tour request */
const CANCELLABLE_STATUSES = [
	TOUR_REQUEST_STATUSES.DRAFT,
	TOUR_REQUEST_STATUSES.SUBMITTED,
	TOUR_REQUEST_STATUSES.IN_QUEUE,
];

module.exports = {
	name: "dynamicTour",

	dependencies: [
		"tourRequest.model",
		"quote.model",
		"destination.model",
		"hotelPartner.model",
		"attraction.model",
		"diningPartner.model",
		"vehicle.model",
	],

	actions: {
		/**
		 * List all active destinations for the Build-Your-Own tour picker.
		 * Public action.
		 */
		getDestinations: {
			auth: undefined,
			async handler(ctx) {
				return ctx.call(
					"destination.model.find",
					{ query: { isActive: true } },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Get hotel, attraction and dining options for a destination.
		 * Public action.
		 */
		getOptions: {
			auth: undefined,
			params: {
				destinationId: "string",
			},
			async handler(ctx) {
				const { destinationId } = ctx.params;

				const [hotels, attractions, dining] = await Promise.all([
					ctx.call(
						"hotelPartner.model.find",
						{ query: { destinationId, isActive: true } },
						{ meta: ctx.meta }
					),
					ctx.call(
						"attraction.model.find",
						{ query: { destinationId, isActive: true } },
						{ meta: ctx.meta }
					),
					ctx.call(
						"diningPartner.model.find",
						{ query: { destinationId, isActive: true } },
						{ meta: ctx.meta }
					),
				]);

				return { hotels, attractions, dining };
			},
		},

		/**
		 * Build (create) a new tour request in draft status.
		 * Requires authentication.
		 */
		buildTourRequest: {
			auth: "required",
			params: {
				destinations: {
					type: "array",
					items: {
						type: "object",
						props: {
							destinationId: "string",
							nightsStay: { type: "number", integer: true, positive: true, optional: true, convert: true },
							hotelPreference: "string|optional",
							selectedAttractions: "array|optional",
							diningPreferences: "array|optional",
						},
					},
				},
				groupSize: { type: "number", integer: true, positive: true, convert: true },
				transportPreference: "string|optional",
				preferredStartDate: "string|optional",
				durationDays: { type: "number", integer: true, positive: true, convert: true },
				specialRequests: "string|optional",
			},
			async handler(ctx) {
				const {
					destinations,
					groupSize,
					transportPreference,
					preferredStartDate,
					durationDays,
					specialRequests,
				} = ctx.params;

				const customerId = ctx.meta.user.id;

				// Validate every destinationId
				await this.validateDestinations(ctx, destinations);

				// Attach ordering
				const orderedDestinations = destinations.map((d, idx) => ({
					...d,
					order: idx + 1,
				}));

				const referenceNumber = this.generateReferenceNumber();

				const tourRequest = await ctx.call(
					"tourRequest.model.create",
					{
						customerId,
						destinations: orderedDestinations,
						groupSize,
						transportPreference,
						preferredStartDate,
						durationDays,
						specialRequests,
						status: TOUR_REQUEST_STATUSES.DRAFT,
						referenceNumber,
					},
					{ meta: ctx.meta }
				);

				return tourRequest;
			},
		},

		/**
		 * Submit a draft tour request for pricing.
		 * Transitions: draft -> submitted_for_pricing -> in_pricing_queue.
		 * Creates an associated Quote record.
		 */
		submitForPricing: {
			auth: "required",
			params: {
				tourRequestId: "string",
			},
			async handler(ctx) {
				const { tourRequestId } = ctx.params;
				const userId = ctx.meta.user.id;

				// Fetch tour request
				const tourRequest = await ctx.call(
					"tourRequest.model.get",
					{ id: tourRequestId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!tourRequest) {
					throw new MoleculerClientError(
						"Tour request not found.",
						404,
						ERROR_CODES.TOUR_REQUEST_NOT_FOUND,
						{ tourRequestId }
					);
				}

				// Ownership check
				const requestCustomerId = tourRequest.customerId?._id
					? tourRequest.customerId._id.toString()
					: tourRequest.customerId.toString();

				if (requestCustomerId !== userId) {
					throw new MoleculerClientError(
						"You do not own this tour request.",
						403,
						ERROR_CODES.FORBIDDEN,
						{ tourRequestId }
					);
				}

				// Validate transition: draft -> submitted_for_pricing
				if (
					!isValidTransition(
						TOUR_REQUEST_TRANSITIONS,
						tourRequest.status,
						TOUR_REQUEST_STATUSES.SUBMITTED
					)
				) {
					throw new MoleculerClientError(
						`Cannot transition from "${tourRequest.status}" to "${TOUR_REQUEST_STATUSES.SUBMITTED}".`,
						422,
						ERROR_CODES.INVALID_BOOKING_TRANSITION,
						{ from: tourRequest.status, to: TOUR_REQUEST_STATUSES.SUBMITTED }
					);
				}

				const now = new Date();

				// Transition to submitted_for_pricing
				await ctx.call(
					"tourRequest.model.update",
					{
						id: tourRequestId,
						status: TOUR_REQUEST_STATUSES.SUBMITTED,
						submittedAt: now.toISOString(),
					},
					{ meta: ctx.meta }
				);

				// Then immediately move to in_pricing_queue
				const updatedRequest = await ctx.call(
					"tourRequest.model.update",
					{
						id: tourRequestId,
						status: TOUR_REQUEST_STATUSES.IN_QUEUE,
					},
					{ meta: ctx.meta }
				);

				// Calculate SLA deadline
				const slaHours = parseInt(process.env.SLA_HOURS, 10) || 72;
				const slaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

				// Create quote
				const quote = await ctx.call(
					"quote.model.create",
					{
						tourRequestId,
						totalPrice: 0,
						pricePerPerson: 0,
						status: QUOTE_STATUSES.PENDING,
						slaDeadline: slaDeadline.toISOString(),
					},
					{ meta: ctx.meta }
				);

				// Emit event for staff notification
				ctx.emit("dynamicTour.submittedForPricing", {
					tourRequestId,
					referenceNumber: updatedRequest.referenceNumber,
					customerId: userId,
				});

				return {
					tourRequest: updatedRequest,
					quote,
					message:
						"Your request has been submitted. You'll receive a quote within 2-3 business days.",
				};
			},
		},

		/**
		 * Get all tour requests belonging to the authenticated customer,
		 * each paired with its associated quote (if any).
		 */
		getMyRequests: {
			auth: "required",
			async handler(ctx) {
				const userId = ctx.meta.user.id;

				const requests = await ctx.call(
					"tourRequest.model.find",
					{ query: { customerId: userId } },
					{ meta: ctx.meta }
				);

				const results = await Promise.all(
					requests.map(async (req) => {
						const quotes = await ctx.call(
							"quote.model.find",
							{ query: { tourRequestId: req._id.toString ? req._id.toString() : req._id } },
							{ meta: ctx.meta }
						);
						return {
							tourRequest: req,
							quote: quotes.length > 0 ? quotes[0] : null,
						};
					})
				);

				return results;
			},
		},

		/**
		 * Get full details of a single tour request including its quote.
		 * Owner or staff/admin may view.
		 */
		getRequestDetail: {
			auth: "required",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;
				const userId = ctx.meta.user.id;
				const userRole = ctx.meta.user.role;

				const tourRequest = await ctx.call(
					"tourRequest.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!tourRequest) {
					throw new MoleculerClientError(
						"Tour request not found.",
						404,
						ERROR_CODES.TOUR_REQUEST_NOT_FOUND,
						{ id }
					);
				}

				// Ownership / role check
				const requestCustomerId = tourRequest.customerId?._id
					? tourRequest.customerId._id.toString()
					: tourRequest.customerId.toString();

				if (requestCustomerId !== userId && userRole !== "staff" && userRole !== "admin") {
					throw new MoleculerClientError(
						"You do not have permission to view this request.",
						403,
						ERROR_CODES.FORBIDDEN,
						{ id }
					);
				}

				const quotes = await ctx.call(
					"quote.model.find",
					{ query: { tourRequestId: id } },
					{ meta: ctx.meta }
				);

				return {
					tourRequest,
					quote: quotes.length > 0 ? quotes[0] : null,
				};
			},
		},

		/**
		 * Cancel a tour request (and its associated quote, if any).
		 * Only allowed from cancellable statuses.
		 */
		cancelRequest: {
			auth: "required",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;
				const userId = ctx.meta.user.id;

				const tourRequest = await ctx.call(
					"tourRequest.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!tourRequest) {
					throw new MoleculerClientError(
						"Tour request not found.",
						404,
						ERROR_CODES.TOUR_REQUEST_NOT_FOUND,
						{ id }
					);
				}

				// Ownership check
				const requestCustomerId = tourRequest.customerId?._id
					? tourRequest.customerId._id.toString()
					: tourRequest.customerId.toString();

				if (requestCustomerId !== userId) {
					throw new MoleculerClientError(
						"You do not own this tour request.",
						403,
						ERROR_CODES.FORBIDDEN,
						{ id }
					);
				}

				// Check transition is valid
				if (!isValidTransition(TOUR_REQUEST_TRANSITIONS, tourRequest.status, TOUR_REQUEST_STATUSES.CANCELLED)) {
					throw new MoleculerClientError(
						`Cannot cancel a tour request in "${tourRequest.status}" status.`,
						422,
						ERROR_CODES.INVALID_BOOKING_TRANSITION,
						{ from: tourRequest.status, to: TOUR_REQUEST_STATUSES.CANCELLED }
					);
				}

				// Cancel tour request
				const updatedRequest = await ctx.call(
					"tourRequest.model.update",
					{ id, status: TOUR_REQUEST_STATUSES.CANCELLED },
					{ meta: ctx.meta }
				);

				// Cancel associated quote if exists
				const quotes = await ctx.call(
					"quote.model.find",
					{ query: { tourRequestId: id } },
					{ meta: ctx.meta }
				);

				if (quotes.length > 0) {
					await ctx.call(
						"quote.model.update",
						{ id: quotes[0]._id.toString ? quotes[0]._id.toString() : quotes[0]._id, status: QUOTE_STATUSES.EXPIRED },
						{ meta: ctx.meta }
					);
				}

				ctx.emit("dynamicTour.cancelled", {
					tourRequestId: id,
					referenceNumber: tourRequest.referenceNumber,
					customerId: userId,
				});

				return updatedRequest;
			},
		},
	},

	methods: {
		/**
		 * Generate a reference number in the format DYN-YYYYMMDD-XXXX.
		 * @returns {string}
		 */
		generateReferenceNumber() {
			const now = new Date();
			const y = now.getFullYear();
			const m = String(now.getMonth() + 1).padStart(2, "0");
			const d = String(now.getDate()).padStart(2, "0");
			const hex = crypto.randomBytes(2).toString("hex").toUpperCase();
			return `DYN-${y}${m}${d}-${hex}`;
		},

		/**
		 * Validate that every destinationId in the array exists in the DB.
		 * @param {Context} ctx
		 * @param {Array} destinations
		 */
		async validateDestinations(ctx, destinations) {
			for (const dest of destinations) {
				const found = await ctx.call(
					"destination.model.get",
					{ id: dest.destinationId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!found) {
					throw new MoleculerClientError(
						"Destination not found.",
						404,
						ERROR_CODES.DESTINATION_NOT_FOUND,
						{ destinationId: dest.destinationId }
					);
				}
			}
		},
	},

	events: {
		"dynamicTour.submittedForPricing"(payload) {
			this.logger.info("Tour request submitted for pricing:", payload.referenceNumber || payload);
		},
		"dynamicTour.cancelled"(payload) {
			this.logger.info("Tour request cancelled:", payload.referenceNumber || payload);
		},
	},
};
