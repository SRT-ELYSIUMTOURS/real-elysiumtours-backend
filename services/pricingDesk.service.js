"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, QUOTE_STATUSES, TOUR_REQUEST_STATUSES } = require("../utils/constants");
const { QUOTE_TRANSITIONS, TOUR_REQUEST_TRANSITIONS, isValidTransition } = require("../config/bookingStates.config");

module.exports = {
	name: "pricingDesk",

	dependencies: [
		"quote.model",
		"tourRequest.model",
		"hotelPartner.model",
		"vehicle.model",
		"attraction.model",
		"diningPartner.model",
	],

	actions: {
		/**
		 * Get the pricing desk queue — pending/calculating quotes ordered by SLA urgency.
		 */
		getQueue: {
			auth: "required",
			role: "staff",
			params: {
				status: { type: "string", optional: true },
				assignedToMe: { type: "boolean", optional: true },
				page: { type: "number", optional: true },
				pageSize: { type: "number", optional: true },
			},
			async handler(ctx) {
				const { status, assignedToMe, page = 1, pageSize = 20 } = ctx.params;

				const query = {};

				if (status) {
					query.status = status;
				} else {
					query.status = { $in: [QUOTE_STATUSES.PENDING, QUOTE_STATUSES.CALCULATING] };
				}

				if (assignedToMe) {
					query.assignedStaffId = ctx.meta.user.id;
				}

				const total = await ctx.call(
					"quote.model.count",
					{ query },
					{ meta: ctx.meta }
				);

				const quotes = await ctx.call(
					"quote.model.find",
					{
						query,
						sort: "slaDeadline",
						offset: (page - 1) * pageSize,
						limit: pageSize,
					},
					{ meta: ctx.meta }
				);

				// Attach tourRequest details for each quote
				const enrichedQuotes = await Promise.all(
					quotes.map(async (quote) => {
						const tourRequestId = quote.tourRequestId?._id
							? quote.tourRequestId._id.toString()
							: quote.tourRequestId.toString();

						const tourRequest = await ctx.call(
							"tourRequest.model.get",
							{ id: tourRequestId },
							{ meta: ctx.meta }
						).catch(() => null);

						return { ...quote, tourRequest };
					})
				);

				return { quotes: enrichedQuotes, total, page, pageSize };
			},
		},

		/**
		 * Get full details of a quote including its tour request data.
		 */
		getQuoteDetail: {
			auth: "required",
			role: "staff",
			params: {
				quoteId: "string",
			},
			async handler(ctx) {
				const { quoteId } = ctx.params;

				const quote = await ctx.call(
					"quote.model.get",
					{ id: quoteId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!quote) {
					throw new MoleculerClientError(
						"Quote not found.",
						404,
						ERROR_CODES.QUOTE_NOT_FOUND,
						{ quoteId }
					);
				}

				const tourRequestId = quote.tourRequestId?._id
					? quote.tourRequestId._id.toString()
					: quote.tourRequestId.toString();

				const tourRequest = await ctx.call(
					"tourRequest.model.get",
					{ id: tourRequestId },
					{ meta: ctx.meta }
				).catch(() => null);

				return { quote, tourRequest };
			},
		},

		/**
		 * Assign a pending quote to the current staff member.
		 * Transitions: quote pending -> calculating, tourRequest in_pricing_queue -> assigned_to_staff.
		 */
		assignQuote: {
			auth: "required",
			role: "staff",
			params: {
				quoteId: "string",
			},
			async handler(ctx) {
				const { quoteId } = ctx.params;
				const staffId = ctx.meta.user.id;

				const quote = await ctx.call(
					"quote.model.get",
					{ id: quoteId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!quote) {
					throw new MoleculerClientError(
						"Quote not found.",
						404,
						ERROR_CODES.QUOTE_NOT_FOUND,
						{ quoteId }
					);
				}

				// Validate quote transition: pending -> calculating
				if (
					!isValidTransition(
						QUOTE_TRANSITIONS,
						quote.status,
						QUOTE_STATUSES.CALCULATING
					)
				) {
					throw new MoleculerClientError(
						`Cannot transition quote from "${quote.status}" to "${QUOTE_STATUSES.CALCULATING}".`,
						422,
						ERROR_CODES.INVALID_BOOKING_TRANSITION,
						{ from: quote.status, to: QUOTE_STATUSES.CALCULATING }
					);
				}

				// Update quote
				const updatedQuote = await ctx.call(
					"quote.model.update",
					{
						id: quoteId,
						assignedStaffId: staffId,
						status: QUOTE_STATUSES.CALCULATING,
					},
					{ meta: ctx.meta }
				);

				// Update tour request status
				const tourRequestId = quote.tourRequestId?._id
					? quote.tourRequestId._id.toString()
					: quote.tourRequestId.toString();

				await ctx.call(
					"tourRequest.model.update",
					{
						id: tourRequestId,
						status: TOUR_REQUEST_STATUSES.ASSIGNED,
					},
					{ meta: ctx.meta }
				);

				ctx.emit("pricingDesk.quoteAssigned", {
					quoteId,
					staffId,
					tourRequestId,
				});

				return updatedQuote;
			},
		},

		/**
		 * Submit a completed quote with cost breakdown and pricing.
		 * Transitions: quote calculating -> sent, tourRequest assigned_to_staff -> quote_sent.
		 */
		submitQuote: {
			auth: "required",
			role: "staff",
			params: {
				quoteId: "string",
				costBreakdown: "object",
				totalPrice: "number",
				pricePerPerson: "number",
				marginPercent: { type: "number", optional: true },
				validUntil: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { quoteId, costBreakdown, totalPrice, pricePerPerson, marginPercent, validUntil } = ctx.params;
				const staffId = ctx.meta.user.id;

				const quote = await ctx.call(
					"quote.model.get",
					{ id: quoteId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!quote) {
					throw new MoleculerClientError(
						"Quote not found.",
						404,
						ERROR_CODES.QUOTE_NOT_FOUND,
						{ quoteId }
					);
				}

				// Validate quote is in calculating status
				if (
					!isValidTransition(
						QUOTE_TRANSITIONS,
						quote.status,
						QUOTE_STATUSES.SENT
					)
				) {
					throw new MoleculerClientError(
						`Cannot transition quote from "${quote.status}" to "${QUOTE_STATUSES.SENT}".`,
						422,
						ERROR_CODES.INVALID_BOOKING_TRANSITION,
						{ from: quote.status, to: QUOTE_STATUSES.SENT }
					);
				}

				// Validate the assigned staff is the current user
				const assignedId = quote.assignedStaffId?._id
					? quote.assignedStaffId._id.toString()
					: quote.assignedStaffId?.toString();

				if (assignedId !== staffId) {
					throw new MoleculerClientError(
						"You are not the assigned staff for this quote.",
						403,
						ERROR_CODES.FORBIDDEN,
						{ quoteId }
					);
				}

				const now = new Date();
				const defaultValidUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

				const updatedQuote = await ctx.call(
					"quote.model.update",
					{
						id: quoteId,
						costBreakdown,
						totalPrice,
						pricePerPerson,
						marginPercent: marginPercent || undefined,
						status: QUOTE_STATUSES.SENT,
						sentAt: now.toISOString(),
						validUntil: validUntil || defaultValidUntil.toISOString(),
					},
					{ meta: ctx.meta }
				);

				// Update tour request status
				const tourRequestId = quote.tourRequestId?._id
					? quote.tourRequestId._id.toString()
					: quote.tourRequestId.toString();

				await ctx.call(
					"tourRequest.model.update",
					{
						id: tourRequestId,
						status: TOUR_REQUEST_STATUSES.QUOTE_SENT,
					},
					{ meta: ctx.meta }
				);

				ctx.emit("pricingDesk.quoteSent", {
					quoteId,
					tourRequestId,
					totalPrice,
				});

				return updatedQuote;
			},
		},

		/**
		 * Customer accepts a sent quote.
		 * Transitions: quote sent -> accepted, tourRequest quote_sent -> quote_accepted.
		 */
		customerAccept: {
			auth: "required",
			params: {
				quoteId: "string",
			},
			async handler(ctx) {
				const { quoteId } = ctx.params;
				const userId = ctx.meta.user.id;

				const quote = await ctx.call(
					"quote.model.get",
					{ id: quoteId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!quote) {
					throw new MoleculerClientError(
						"Quote not found.",
						404,
						ERROR_CODES.QUOTE_NOT_FOUND,
						{ quoteId }
					);
				}

				// Validate quote status is sent
				if (
					!isValidTransition(
						QUOTE_TRANSITIONS,
						quote.status,
						QUOTE_STATUSES.ACCEPTED
					)
				) {
					throw new MoleculerClientError(
						`Cannot transition quote from "${quote.status}" to "${QUOTE_STATUSES.ACCEPTED}".`,
						422,
						ERROR_CODES.INVALID_BOOKING_TRANSITION,
						{ from: quote.status, to: QUOTE_STATUSES.ACCEPTED }
					);
				}

				// Validate ownership via tour request
				const tourRequestId = quote.tourRequestId?._id
					? quote.tourRequestId._id.toString()
					: quote.tourRequestId.toString();

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

				const requestCustomerId = tourRequest.customerId?._id
					? tourRequest.customerId._id.toString()
					: tourRequest.customerId.toString();

				if (requestCustomerId !== userId) {
					throw new MoleculerClientError(
						"You do not own this tour request.",
						403,
						ERROR_CODES.FORBIDDEN,
						{ quoteId }
					);
				}

				// Validate quote hasn't expired
				if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
					throw new MoleculerClientError(
						"This quote has expired.",
						422,
						ERROR_CODES.QUOTE_EXPIRED,
						{ quoteId, validUntil: quote.validUntil }
					);
				}

				const now = new Date();

				const updatedQuote = await ctx.call(
					"quote.model.update",
					{
						id: quoteId,
						status: QUOTE_STATUSES.ACCEPTED,
						respondedAt: now.toISOString(),
					},
					{ meta: ctx.meta }
				);

				await ctx.call(
					"tourRequest.model.update",
					{
						id: tourRequestId,
						status: TOUR_REQUEST_STATUSES.QUOTE_ACCEPTED,
					},
					{ meta: ctx.meta }
				);

				ctx.emit("pricingDesk.quoteAccepted", {
					quoteId,
					tourRequestId,
					customerId: userId,
				});

				return {
					quote: updatedQuote,
					message: "Quote accepted. Your booking will be created shortly.",
				};
			},
		},

		/**
		 * Customer rejects a sent quote.
		 * Transitions: quote sent -> rejected, tourRequest quote_sent -> quote_rejected.
		 */
		customerReject: {
			auth: "required",
			params: {
				quoteId: "string",
				reason: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { quoteId, reason } = ctx.params;
				const userId = ctx.meta.user.id;

				const quote = await ctx.call(
					"quote.model.get",
					{ id: quoteId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!quote) {
					throw new MoleculerClientError(
						"Quote not found.",
						404,
						ERROR_CODES.QUOTE_NOT_FOUND,
						{ quoteId }
					);
				}

				// Validate quote status is sent
				if (
					!isValidTransition(
						QUOTE_TRANSITIONS,
						quote.status,
						QUOTE_STATUSES.REJECTED
					)
				) {
					throw new MoleculerClientError(
						`Cannot transition quote from "${quote.status}" to "${QUOTE_STATUSES.REJECTED}".`,
						422,
						ERROR_CODES.INVALID_BOOKING_TRANSITION,
						{ from: quote.status, to: QUOTE_STATUSES.REJECTED }
					);
				}

				// Validate ownership via tour request
				const tourRequestId = quote.tourRequestId?._id
					? quote.tourRequestId._id.toString()
					: quote.tourRequestId.toString();

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

				const requestCustomerId = tourRequest.customerId?._id
					? tourRequest.customerId._id.toString()
					: tourRequest.customerId.toString();

				if (requestCustomerId !== userId) {
					throw new MoleculerClientError(
						"You do not own this tour request.",
						403,
						ERROR_CODES.FORBIDDEN,
						{ quoteId }
					);
				}

				const now = new Date();

				const updatedQuote = await ctx.call(
					"quote.model.update",
					{
						id: quoteId,
						status: QUOTE_STATUSES.REJECTED,
						respondedAt: now.toISOString(),
						customerResponse: reason || undefined,
					},
					{ meta: ctx.meta }
				);

				await ctx.call(
					"tourRequest.model.update",
					{
						id: tourRequestId,
						status: TOUR_REQUEST_STATUSES.QUOTE_REJECTED,
					},
					{ meta: ctx.meta }
				);

				ctx.emit("pricingDesk.quoteRejected", {
					quoteId,
					tourRequestId,
					reason,
				});

				return {
					quote: updatedQuote,
					message: "Quote rejected.",
				};
			},
		},

		/**
		 * Revise a rejected quote — creates a new revision for the same tour request.
		 * Transitions: original quote rejected -> revised, tourRequest quote_rejected -> assigned_to_staff.
		 */
		reviseQuote: {
			auth: "required",
			role: "staff",
			params: {
				quoteId: "string",
			},
			async handler(ctx) {
				const { quoteId } = ctx.params;

				const quote = await ctx.call(
					"quote.model.get",
					{ id: quoteId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!quote) {
					throw new MoleculerClientError(
						"Quote not found.",
						404,
						ERROR_CODES.QUOTE_NOT_FOUND,
						{ quoteId }
					);
				}

				// Validate quote is in rejected status
				if (
					!isValidTransition(
						QUOTE_TRANSITIONS,
						quote.status,
						QUOTE_STATUSES.REVISED
					)
				) {
					throw new MoleculerClientError(
						`Cannot transition quote from "${quote.status}" to "${QUOTE_STATUSES.REVISED}".`,
						422,
						ERROR_CODES.INVALID_BOOKING_TRANSITION,
						{ from: quote.status, to: QUOTE_STATUSES.REVISED }
					);
				}

				// Mark original as revised
				await ctx.call(
					"quote.model.update",
					{
						id: quoteId,
						status: QUOTE_STATUSES.REVISED,
					},
					{ meta: ctx.meta }
				);

				// Create new quote revision
				const tourRequestId = quote.tourRequestId?._id
					? quote.tourRequestId._id.toString()
					: quote.tourRequestId.toString();

				const slaHours = parseInt(process.env.SLA_HOURS, 10) || 72;
				const now = new Date();
				const slaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

				const newQuote = await ctx.call(
					"quote.model.create",
					{
						tourRequestId,
						assignedStaffId: ctx.meta.user.id,
						totalPrice: 0,
						pricePerPerson: 0,
						status: QUOTE_STATUSES.CALCULATING,
						slaDeadline: slaDeadline.toISOString(),
						revisionNumber: (quote.revisionNumber || 1) + 1,
					},
					{ meta: ctx.meta }
				);

				// Reset tour request to assigned_to_staff
				await ctx.call(
					"tourRequest.model.update",
					{
						id: tourRequestId,
						status: TOUR_REQUEST_STATUSES.ASSIGNED,
					},
					{ meta: ctx.meta }
				);

				return newQuote;
			},
		},

		/**
		 * Auto-estimate a cost breakdown for a tour request.
		 * Gives staff a suggested quote they can verify/adjust.
		 */
		estimateCost: {
			auth: "required",
			role: "staff",
			params: {
				tourRequestId: "string",
				marginPercent: { type: "number", optional: true, default: 20 },
			},
			async handler(ctx) {
				const { tourRequestId, marginPercent } = ctx.params;

				// 1. Fetch the tour request
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

				const { groupSize, durationDays, destinations } = tourRequest;

				let totalHotelCost = 0;
				let totalAttractionsCost = 0;
				let totalDiningCost = 0;
				const hotelDescParts = [];
				const attractionNames = [];
				const diningDescParts = [];

				// 2. For each destination, look up hotels, attractions, dining
				for (const dest of (destinations || [])) {
					const destId = dest.destinationId?._id
						? dest.destinationId._id.toString()
						: dest.destinationId.toString();
					const nightsStay = dest.nightsStay || 0;

					// 2a. Hotel cost
					if (dest.hotelPreference) {
						const hotels = await ctx.call(
							"hotelPartner.model.find",
							{
								query: {
									destinationId: destId,
									tier: dest.hotelPreference,
									isActive: true,
								},
							},
							{ meta: ctx.meta }
						);

						if (hotels && hotels.length > 0) {
							const hotel = hotels[0];
							const standardRate = hotel.rateData?.standardRate || 0;
							const rooms = Math.ceil(groupSize / 2);
							const hotelCost = standardRate * nightsStay * rooms;
							totalHotelCost += hotelCost;
							hotelDescParts.push(
								`${hotel.tier.charAt(0).toUpperCase() + hotel.tier.slice(1)} hotel x ${nightsStay} nights x ${rooms} rooms`
							);
						}
					}

					// 2b. Attractions cost
					if (dest.selectedAttractions && dest.selectedAttractions.length > 0) {
						for (const attractionRef of dest.selectedAttractions) {
							const attractionId = attractionRef?._id
								? attractionRef._id.toString()
								: attractionRef.toString();

							const attraction = await ctx.call(
								"attraction.model.get",
								{ id: attractionId },
								{ meta: ctx.meta }
							).catch(() => null);

							if (attraction) {
								totalAttractionsCost += (attraction.entryFee || 0) * groupSize;
								attractionNames.push(attraction.name);
							}
						}
					}

					// 2c. Dining cost
					if (dest.diningPreferences && dest.diningPreferences.length > 0) {
						for (const diningRef of dest.diningPreferences) {
							const diningId = diningRef?._id
								? diningRef._id.toString()
								: diningRef.toString();

							const diningPartner = await ctx.call(
								"diningPartner.model.get",
								{ id: diningId },
								{ meta: ctx.meta }
							).catch(() => null);

							if (diningPartner && diningPartner.menuOptions && diningPartner.menuOptions.length > 0) {
								const avgPrice =
									diningPartner.menuOptions.reduce((sum, opt) => sum + (opt.pricePerPerson || 0), 0) /
									diningPartner.menuOptions.length;
								totalDiningCost += avgPrice * groupSize * nightsStay;
								diningDescParts.push(diningPartner.name);
							}
						}
					} else {
						// Default dining estimate: 50 GHS per person per day
						const defaultRate = 50;
						totalDiningCost += defaultRate * groupSize * nightsStay;
						diningDescParts.push(`Standard dining x ${groupSize} people x ${nightsStay} days`);
					}
				}

				// 3. Estimate transport
				const transportResult = await ctx.call(
					"transport.estimateTransportCost",
					{ groupSize, days: durationDays },
					{ meta: ctx.meta }
				);
				const transportCost = transportResult.totalCost;

				// 4. Calculate totals
				const subtotal = totalHotelCost + totalAttractionsCost + totalDiningCost + transportCost;
				const platformFee = subtotal * (marginPercent / 100);
				const totalPrice = subtotal + platformFee;
				const pricePerPerson = totalPrice / groupSize;

				// 5. Build transport description
				const transportDesc = transportResult.vehicle
					? `${transportResult.vehicle.capacity}-seater ${transportResult.vehicle.type} x ${durationDays} days`
					: `Transport x ${durationDays} days`;

				return {
					costBreakdown: {
						transport: { description: transportDesc, amount: transportCost },
						accommodation: {
							description: hotelDescParts.join(", ") || "No accommodation selected",
							amount: totalHotelCost,
						},
						attractions: {
							description: attractionNames.join(", ") || "No attractions selected",
							amount: totalAttractionsCost,
						},
						dining: {
							description: diningDescParts.join(", ") || "No dining selected",
							amount: totalDiningCost,
						},
						platformFee: {
							description: `${marginPercent}% platform fee`,
							amount: platformFee,
						},
						subtotal,
						margin: platformFee,
						marginPercent,
					},
					totalPrice,
					pricePerPerson,
					currency: "GHS",
					groupSize: tourRequest.groupSize,
					durationDays: tourRequest.durationDays,
					note: "This is an automated estimate. Please verify rates and adjust before sending to customer.",
				};
			},
		},

		/**
		 * Get SLA compliance metrics (admin only).
		 */
		getSLAMetrics: {
			auth: "required",
			role: "admin",
			async handler(ctx) {
				const allQuotes = await ctx.call(
					"quote.model.find",
					{ query: {} },
					{ meta: ctx.meta }
				);

				const now = new Date();
				const totalQuotes = allQuotes.length;
				let withinSLA = 0;
				let breachedSLA = 0;
				let totalResponseMs = 0;
				let respondedCount = 0;

				for (const quote of allQuotes) {
					const slaDeadline = quote.slaDeadline ? new Date(quote.slaDeadline) : null;

					if (quote.sentAt && slaDeadline) {
						const sentAt = new Date(quote.sentAt);
						if (sentAt <= slaDeadline) {
							withinSLA++;
						} else {
							breachedSLA++;
						}
					} else if (
						(quote.status === QUOTE_STATUSES.PENDING || quote.status === QUOTE_STATUSES.CALCULATING) &&
						slaDeadline &&
						slaDeadline < now
					) {
						breachedSLA++;
					} else {
						withinSLA++;
					}

					if (quote.sentAt && quote.createdAt) {
						totalResponseMs += new Date(quote.sentAt).getTime() - new Date(quote.createdAt).getTime();
						respondedCount++;
					}
				}

				const complianceRate = totalQuotes > 0
					? Math.round((withinSLA / totalQuotes) * 100 * 100) / 100
					: 100;

				const averageResponseTime = respondedCount > 0
					? Math.round((totalResponseMs / respondedCount / (1000 * 60 * 60)) * 100) / 100
					: 0;

				return {
					totalQuotes,
					withinSLA,
					breachedSLA,
					complianceRate,
					averageResponseTime,
				};
			},
		},
	},

	methods: {
		/**
		 * Check whether a quote has breached its SLA deadline.
		 * @param {Object} quote
		 * @returns {boolean}
		 */
		checkSLABreach(quote) {
			if (!quote.slaDeadline) return false;
			const slaDeadline = new Date(quote.slaDeadline);
			if (quote.sentAt) {
				return new Date(quote.sentAt) > slaDeadline;
			}
			return new Date() > slaDeadline;
		},
	},

	events: {
		"pricingDesk.quoteSent"(payload) {
			this.logger.info("Quote sent to customer:", payload.quoteId || payload);
		},
		"pricingDesk.quoteAccepted"(payload) {
			this.logger.info("Quote accepted by customer:", payload.quoteId || payload);
		},
	},
};
