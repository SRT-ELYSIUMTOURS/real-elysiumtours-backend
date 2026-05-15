"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, BOOKING_STATUSES, QUOTE_STATUSES, SELLING_MODES } = require("../utils/constants");
const { generateBookingRef } = require("../utils/bookingRef.utils");
const BookingStatusMixin = require("../mixins/booking/bookingStatus.mixin");

const DEFAULT_COMMITMENT_FEE_PERCENT = parseInt(process.env.DEFAULT_COMMITMENT_FEE_PERCENT, 10) || 15;

module.exports = {
	name: "booking",

	dependencies: ["booking.model", "tourPackage.model", "quote.model", "tourRequest.model", "hotelPartner.model"],

	mixins: [BookingStatusMixin],

	actions: {
		/**
		 * Create a new booking (packaged or dynamic).
		 */
		createBooking: {
			auth: "required",
			params: {
				packageId: "string|optional",
				quoteId: "string|optional",
				groupSize: { type: "number", integer: true, positive: true, convert: true },
				tourDate: "string|optional",
				specialRequests: "string|optional",
			},
			async handler(ctx) {
				const { packageId, quoteId, groupSize, tourDate, specialRequests } = ctx.params;
				const customerId = ctx.meta.user.id;

				if (!packageId && !quoteId) {
					throw new MoleculerClientError(
						"Either packageId or quoteId must be provided.",
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{}
					);
				}

				let bookingType;
				let totalAmount;
				let finalGroupSize = groupSize;
				let finalTourDate = tourDate;
				let endDate;
				let linkedPackageId;
				let linkedQuoteId;

				let packageData;

				if (packageId) {
					// ---- Packaged booking ----
					const validation = await ctx.call(
						"tourPackage.validatePackage",
						{ packageId, groupSize },
						{ meta: ctx.meta }
					);

					bookingType = "packaged";
					totalAmount = validation.totalPrice;
					linkedPackageId = packageId;
					packageData = validation.package;

					// Use package dates if not provided
					if (!finalTourDate && validation.package.startDate) {
						finalTourDate = new Date(validation.package.startDate).toISOString();
					}
					if (validation.package.endDate) {
						endDate = new Date(validation.package.endDate).toISOString();
					}

					// Decrement capacity for individual_seats mode
					if (validation.package.sellingMode === SELLING_MODES.INDIVIDUAL_SEATS) {
						try {
							await ctx.call(
								"tourPackage.decrementCapacity",
								{ packageId, seats: groupSize },
								{ meta: ctx.meta }
							);
						} catch (err) {
							if (err.type === ERROR_CODES.INSUFFICIENT_CAPACITY && packageData.waitlistEnabled) {
								// Insufficient capacity but waitlist is enabled — add to waitlist instead
								const waitlistResult = await ctx.call("tourPackage.joinWaitlist", {
									packageId: packageId.toString(),
									groupSize,
									preferredDate: tourDate,
								}, { meta: ctx.meta });
								return { waitlisted: true, ...waitlistResult };
							}
							// If no waitlist or different error, rethrow
							throw err;
						}
					}
				} else {
					// ---- Dynamic booking from accepted quote ----
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

					if (quote.status !== QUOTE_STATUSES.ACCEPTED) {
						throw new MoleculerClientError(
							"Quote must be accepted before creating a booking.",
							422,
							ERROR_CODES.VALIDATION_ERROR,
							{ quoteId, status: quote.status }
						);
					}

					// Fetch tour request to validate ownership and get groupSize
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

					if (requestCustomerId !== customerId) {
						throw new MoleculerClientError(
							"You do not own this tour request.",
							403,
							ERROR_CODES.FORBIDDEN,
							{ quoteId }
						);
					}

					bookingType = "dynamic";
					totalAmount = quote.totalPrice;
					finalGroupSize = tourRequest.groupSize;
					linkedQuoteId = quoteId;

					if (!finalTourDate && tourRequest.preferredStartDate) {
						finalTourDate = new Date(tourRequest.preferredStartDate).toISOString();
					}
				}

				// ── Partner inventory validation ──
				const partnerConfirmations = [];
				const bookingTourDate = tourDate ? new Date(tourDate) : null;

				if (bookingType === "packaged" && packageData) {
					// Check hotel partner
					if (packageData.hotelPartnerId) {
						const hotelCheck = await ctx.call("hotelPartner.checkAvailability", {
							hotelId: packageData.hotelPartnerId.toString(),
							checkInDate: bookingTourDate ? bookingTourDate.toISOString() : new Date().toISOString(),
						}, { meta: ctx.meta }).catch(() => ({ available: true, inventoryModel: "on_request", needsConfirmation: true }));

						if (!hotelCheck.available) {
							// Hotel closed out — still create booking but flag it
							partnerConfirmations.push({
								partnerId: packageData.hotelPartnerId,
								partnerType: "hotel",
								partnerName: hotelCheck.hotel ? hotelCheck.hotel.name : "Unknown Hotel",
								inventoryModel: hotelCheck.inventoryModel,
								status: "pending",
								notes: hotelCheck.reason,
							});
						} else if (hotelCheck.needsConfirmation) {
							// On-request: needs manual confirmation
							partnerConfirmations.push({
								partnerId: packageData.hotelPartnerId,
								partnerType: "hotel",
								partnerName: hotelCheck.hotel ? hotelCheck.hotel.name : "Unknown Hotel",
								inventoryModel: hotelCheck.inventoryModel,
								status: "pending",
							});
						} else {
							// Free-sale with no conflicts: auto-confirmed
							partnerConfirmations.push({
								partnerId: packageData.hotelPartnerId,
								partnerType: "hotel",
								partnerName: hotelCheck.hotel ? hotelCheck.hotel.name : "Unknown Hotel",
								inventoryModel: hotelCheck.inventoryModel,
								status: "auto_confirmed",
								confirmedAt: new Date(),
							});
						}
					}
				}

				// Determine initial status based on partner confirmations
				const hasPendingPartners = partnerConfirmations.some(pc => pc.status === "pending");
				const initialStatus = hasPendingPartners
					? BOOKING_STATUSES.PENDING_PARTNER_CONFIRMATION
					: BOOKING_STATUSES.PENDING_PAYMENT;

				const commitmentFeeAmount = Math.round((totalAmount * DEFAULT_COMMITMENT_FEE_PERCENT) / 100 * 100) / 100;
				const bookingRef = generateBookingRef();

				const bookingData = {
					customerId,
					bookingType,
					bookingRef,
					groupSize: finalGroupSize,
					totalAmount,
					currency: "GHS",
					status: initialStatus,
					commitmentFeeAmount,
					commitmentFeePaid: false,
					specialRequests: specialRequests || undefined,
				};

				if (partnerConfirmations.length > 0) {
					bookingData.partnerConfirmations = partnerConfirmations;
				}

				if (linkedPackageId) bookingData.packageId = linkedPackageId;
				if (linkedQuoteId) bookingData.quoteId = linkedQuoteId;
				if (finalTourDate) bookingData.tourDate = finalTourDate;
				if (endDate) bookingData.endDate = endDate;

				const booking = await ctx.call(
					"booking.model.create",
					bookingData,
					{ meta: ctx.meta }
				);

				ctx.emit("booking.created", {
					bookingId: booking._id,
					bookingRef: booking.bookingRef,
					customerId,
					bookingType,
					totalAmount,
				});

				return booking;
			},
		},

		/**
		 * Get a single booking by ID.
		 */
		getBooking: {
			auth: "required",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const booking = await ctx.call(
					"booking.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!booking) {
					throw new MoleculerClientError(
						"Booking not found.",
						404,
						ERROR_CODES.BOOKING_NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				// If customer, validate ownership
				const user = ctx.meta.user;
				if (user.role === "customer") {
					const bookingCustomerId = booking.customerId?._id
						? booking.customerId._id.toString()
						: booking.customerId.toString();

					if (bookingCustomerId !== user.id) {
						throw new MoleculerClientError(
							"You do not have access to this booking.",
							403,
							ERROR_CODES.FORBIDDEN,
							{ id: ctx.params.id }
						);
					}
				}

				return this.populateBookingPackage(ctx, booking);
			},
		},

		/**
		 * List bookings with optional filters.
		 */
		listBookings: {
			auth: "required",
			params: {
				status: "string|optional",
				bookingType: "string|optional",
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { status, bookingType, page = 1, pageSize = 10 } = ctx.params;
				const user = ctx.meta.user;
				const query = {};

				// Customers can only see their own bookings
				if (user.role === "customer") {
					query.customerId = user.id;
				}

				if (status) query.status = status;
				if (bookingType) query.bookingType = bookingType;

				const total = await ctx.call(
					"booking.model.count",
					{ query },
					{ meta: ctx.meta }
				);

				const bookings = await ctx.call(
					"booking.model.find",
					{
						query,
						sort: "-createdAt",
						offset: (page - 1) * pageSize,
						limit: pageSize,
					},
					{ meta: ctx.meta }
				);

				const populated = await this.populateBookingsPackages(ctx, bookings);
				return { bookings: populated, total, page, pageSize };
			},
		},

		/**
		 * Update booking status (staff only).
		 */
		updateStatus: {
			auth: "required",
			role: "staff",
			params: {
				id: "string",
				status: "string",
			},
			async handler(ctx) {
				const { id, status: newStatus } = ctx.params;

				const booking = await ctx.call(
					"booking.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!booking) {
					throw new MoleculerClientError(
						"Booking not found.",
						404,
						ERROR_CODES.BOOKING_NOT_FOUND,
						{ id }
					);
				}

				const fromStatus = booking.status;
				this.validateBookingTransition(fromStatus, newStatus);

				const updateData = { id, status: newStatus };

				if (newStatus === BOOKING_STATUSES.CONFIRMED) {
					updateData.confirmedAt = new Date().toISOString();
				}

				if (newStatus === BOOKING_STATUSES.CANCELLED || newStatus === BOOKING_STATUSES.CANCELLED_WITH_REFUND) {
					updateData.cancelledAt = new Date().toISOString();
				}

				const updated = await ctx.call(
					"booking.model.update",
					updateData,
					{ meta: ctx.meta }
				);

				ctx.emit("booking.statusChanged", {
					bookingId: id,
					fromStatus,
					toStatus: newStatus,
				});

				return updated;
			},
		},

		/**
		 * Cancel a booking (customer or staff).
		 */
		cancelBooking: {
			auth: "required",
			params: {
				id: "string",
				reason: "string|optional",
			},
			async handler(ctx) {
				const { id, reason } = ctx.params;
				const user = ctx.meta.user;

				const booking = await ctx.call(
					"booking.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!booking) {
					throw new MoleculerClientError(
						"Booking not found.",
						404,
						ERROR_CODES.BOOKING_NOT_FOUND,
						{ id }
					);
				}

				// If customer, validate ownership
				if (user.role === "customer") {
					const bookingCustomerId = booking.customerId?._id
						? booking.customerId._id.toString()
						: booking.customerId.toString();

					if (bookingCustomerId !== user.id) {
						throw new MoleculerClientError(
							"You do not have access to this booking.",
							403,
							ERROR_CODES.FORBIDDEN,
							{ id }
						);
					}
				}

				// Determine the target cancellation status
				const fromStatus = booking.status;
				let toStatus;

				if (fromStatus === BOOKING_STATUSES.PENDING_PARTNER_CONFIRMATION) {
					toStatus = BOOKING_STATUSES.CANCELLED;
				} else if (fromStatus === BOOKING_STATUSES.PENDING_PAYMENT) {
					toStatus = BOOKING_STATUSES.CANCELLED;
				} else if (fromStatus === BOOKING_STATUSES.CONFIRMED) {
					toStatus = BOOKING_STATUSES.CANCELLED_WITH_REFUND;
				} else {
					// Attempt the transition so the mixin throws the proper error
					toStatus = BOOKING_STATUSES.CANCELLED;
				}

				this.validateBookingTransition(fromStatus, toStatus);

				const updated = await ctx.call(
					"booking.model.update",
					{
						id,
						status: toStatus,
						cancellationReason: reason || undefined,
						cancelledAt: new Date().toISOString(),
					},
					{ meta: ctx.meta }
				);

				ctx.emit("booking.cancelled", {
					bookingId: id,
					packageId: booking.packageId ? (booking.packageId._id ? booking.packageId._id.toString() : booking.packageId.toString()) : undefined,
					fromStatus,
					toStatus,
					reason,
				});

				return updated;
			},
		},

		/**
		 * Get a booking by its reference number.
		 */
		getBookingByRef: {
			auth: "required",
			params: {
				bookingRef: "string",
			},
			async handler(ctx) {
				const results = await ctx.call(
					"booking.model.find",
					{ query: { bookingRef: ctx.params.bookingRef } },
					{ meta: ctx.meta }
				);

				if (!results || results.length === 0) {
					throw new MoleculerClientError(
						"Booking not found.",
						404,
						ERROR_CODES.BOOKING_NOT_FOUND,
						{ bookingRef: ctx.params.bookingRef }
					);
				}

				return results[0];
			},
		},

		/**
		 * Get booking statistics (admin only).
		 */
		getBookingStats: {
			auth: "required",
			role: "admin",
			async handler(ctx) {
				const allBookings = await ctx.call(
					"booking.model.find",
					{ query: {} },
					{ meta: ctx.meta }
				);

				// Counts by status
				const countsByStatus = {};
				for (const status of Object.values(BOOKING_STATUSES)) {
					countsByStatus[status] = 0;
				}
				let totalRevenue = 0;
				let bookingsThisMonth = 0;

				const now = new Date();
				const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

				for (const booking of allBookings) {
					if (countsByStatus[booking.status] !== undefined) {
						countsByStatus[booking.status]++;
					}

					// Count revenue from confirmed+ bookings
					if (
						booking.status !== BOOKING_STATUSES.CANCELLED &&
						booking.status !== BOOKING_STATUSES.PENDING_PAYMENT
					) {
						totalRevenue += booking.totalAmount || 0;
					}

					// Bookings created this month
					const createdAt = new Date(booking.createdAt);
					if (createdAt >= startOfMonth) {
						bookingsThisMonth++;
					}
				}

				return {
					countsByStatus,
					totalRevenue,
					bookingsThisMonth,
					totalBookings: allBookings.length,
				};
			},
		},
		/**
		 * Get booking analytics with date range filtering and grouping.
		 */
		getBookingAnalytics: {
			auth: "required",
			role: "admin",
			params: {
				startDate: { type: "string", optional: true },
				endDate: { type: "string", optional: true },
				groupBy: {
					type: "enum",
					values: ["day", "week", "month"],
					optional: true,
					default: "month",
				},
			},
			async handler(ctx) {
				const { startDate, endDate, groupBy = "month" } = ctx.params;

				const query = {};
				if (startDate || endDate) {
					query.createdAt = {};
					if (startDate) query.createdAt.$gte = new Date(startDate).toISOString();
					if (endDate) query.createdAt.$lte = new Date(endDate).toISOString();
				}

				const allBookings = await ctx.call(
					"booking.model.find",
					{ query },
					{ meta: ctx.meta }
				);

				// Count by status
				const byStatus = {};
				for (const status of Object.values(BOOKING_STATUSES)) {
					byStatus[status] = 0;
				}

				// Count by type
				const byType = { packaged: 0, dynamic: 0, interest: 0 };

				let totalGroupSize = 0;
				let groupSizeCount = 0;
				let totalRevenue = 0;

				// Destination counts (packageId -> count)
				const packageCounts = {};
				// Trend buckets
				const trendBuckets = {};

				for (const booking of allBookings) {
					// By status
					if (byStatus[booking.status] !== undefined) {
						byStatus[booking.status]++;
					}

					// By type
					if (byType[booking.bookingType] !== undefined) {
						byType[booking.bookingType]++;
					}

					// Group size average
					if (booking.groupSize) {
						totalGroupSize += booking.groupSize;
						groupSizeCount++;
					}

					// Revenue from confirmed+ bookings (not cancelled, not pending)
					if (
						booking.status !== BOOKING_STATUSES.CANCELLED &&
						booking.status !== BOOKING_STATUSES.CANCELLED_WITH_REFUND &&
						booking.status !== BOOKING_STATUSES.PENDING_PAYMENT
					) {
						totalRevenue += booking.totalAmount || 0;
					}

					// Package counts for popular destinations
					if (booking.packageId) {
						const pkgId = booking.packageId._id
							? booking.packageId._id.toString()
							: booking.packageId.toString();
						packageCounts[pkgId] = (packageCounts[pkgId] || 0) + 1;
					}

					// Trend bucketing
					const createdAt = new Date(booking.createdAt);
					let periodKey;
					if (groupBy === "day") {
						periodKey = createdAt.toISOString().slice(0, 10);
					} else if (groupBy === "week") {
						const dayOfWeek = createdAt.getDay();
						const weekStart = new Date(createdAt);
						weekStart.setDate(weekStart.getDate() - dayOfWeek);
						periodKey = weekStart.toISOString().slice(0, 10);
					} else {
						// month
						periodKey = createdAt.toISOString().slice(0, 7);
					}
					trendBuckets[periodKey] = (trendBuckets[periodKey] || 0) + 1;
				}

				// Popular destinations — top 5 packages by booking count
				const popularDestinations = Object.entries(packageCounts)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 5)
					.map(([packageId, count]) => ({ packageId, bookingCount: count }));

				// Booking trend
				const bookingTrend = Object.entries(trendBuckets)
					.sort((a, b) => a[0].localeCompare(b[0]))
					.map(([period, count]) => ({ period, count }));

				const averageGroupSize = groupSizeCount > 0
					? Math.round((totalGroupSize / groupSizeCount) * 100) / 100
					: 0;

				return {
					totalBookings: allBookings.length,
					byStatus,
					byType,
					averageGroupSize,
					totalRevenue,
					popularDestinations,
					bookingTrend,
				};
			},
		},

		/**
		 * Get top N packages by booking count.
		 */
		getPopularPackages: {
			auth: "required",
			role: "admin",
			params: {
				limit: { type: "number", optional: true, default: 10, convert: true },
			},
			async handler(ctx) {
				const { limit = 10 } = ctx.params;

				const allBookings = await ctx.call(
					"booking.model.find",
					{ query: {} },
					{ meta: ctx.meta }
				);

				// Aggregate by packageId
				const packageMap = {};

				for (const booking of allBookings) {
					if (!booking.packageId) continue;

					const pkgId = booking.packageId._id
						? booking.packageId._id.toString()
						: booking.packageId.toString();

					if (!packageMap[pkgId]) {
						packageMap[pkgId] = {
							packageId: pkgId,
							title: booking.packageId.title || "",
							bookingCount: 0,
							totalRevenue: 0,
							totalGroupSize: 0,
						};
					}

					packageMap[pkgId].bookingCount++;
					packageMap[pkgId].totalRevenue += booking.totalAmount || 0;
					packageMap[pkgId].totalGroupSize += booking.groupSize || 0;
				}

				const results = Object.values(packageMap)
					.sort((a, b) => b.bookingCount - a.bookingCount)
					.slice(0, limit)
					.map((pkg) => ({
						packageId: pkg.packageId,
						title: pkg.title,
						bookingCount: pkg.bookingCount,
						totalRevenue: pkg.totalRevenue,
						averageGroupSize: pkg.bookingCount > 0
							? Math.round((pkg.totalGroupSize / pkg.bookingCount) * 100) / 100
							: 0,
					}));

				return results;
			},
		},

		/**
		 * Get booking analytics with date range filtering and grouping.
		 * Returns counts, revenue, popular destinations, and trends.
		 */
		getAnalytics: {
			auth: "required",
			role: "admin",
			params: {
				startDate: { type: "string", optional: true },
				endDate: { type: "string", optional: true },
				groupBy: {
					type: "enum",
					values: ["day", "week", "month"],
					optional: true,
				},
			},
			async handler(ctx) {
				const { startDate, endDate, groupBy } = ctx.params;

				const query = {};
				if (startDate || endDate) {
					query.createdAt = {};
					if (startDate) query.createdAt.$gte = new Date(startDate).toISOString();
					if (endDate) query.createdAt.$lte = new Date(endDate).toISOString();
				}

				const allBookings = await ctx.call(
					"booking.model.find",
					{ query },
					{ meta: ctx.meta }
				);

				// Count by status
				const bookingsByStatus = {};
				for (const status of Object.values(BOOKING_STATUSES)) {
					bookingsByStatus[status] = 0;
				}

				// Count by type
				const bookingsByType = { packaged: 0, dynamic: 0, interest: 0 };

				let totalGroupSize = 0;
				let groupSizeCount = 0;
				let totalRevenue = 0;

				// Destination/package counts
				const packageCounts = {};

				// Monthly trend buckets (last 6 months)
				const now = new Date();
				const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
				const monthlyBuckets = {};

				for (const booking of allBookings) {
					// By status
					if (bookingsByStatus[booking.status] !== undefined) {
						bookingsByStatus[booking.status]++;
					}

					// By type
					if (bookingsByType[booking.bookingType] !== undefined) {
						bookingsByType[booking.bookingType]++;
					}

					// Group size average
					if (booking.groupSize) {
						totalGroupSize += booking.groupSize;
						groupSizeCount++;
					}

					// Revenue from confirmed+ bookings (not cancelled, not pending)
					if (
						booking.status !== BOOKING_STATUSES.CANCELLED &&
						booking.status !== BOOKING_STATUSES.CANCELLED_WITH_REFUND &&
						booking.status !== BOOKING_STATUSES.PENDING_PAYMENT
					) {
						totalRevenue += booking.totalAmount || 0;
					}

					// Package counts for popular destinations
					if (booking.packageId) {
						const pkgId = booking.packageId._id
							? booking.packageId._id.toString()
							: booking.packageId.toString();
						packageCounts[pkgId] = (packageCounts[pkgId] || 0) + 1;
					}

					// Monthly trend
					const createdAt = new Date(booking.createdAt);
					if (createdAt >= sixMonthsAgo) {
						const monthKey = createdAt.toISOString().slice(0, 7);
						if (!monthlyBuckets[monthKey]) {
							monthlyBuckets[monthKey] = { count: 0, revenue: 0 };
						}
						monthlyBuckets[monthKey].count++;
						if (
							booking.status !== BOOKING_STATUSES.CANCELLED &&
							booking.status !== BOOKING_STATUSES.CANCELLED_WITH_REFUND &&
							booking.status !== BOOKING_STATUSES.PENDING_PAYMENT
						) {
							monthlyBuckets[monthKey].revenue += booking.totalAmount || 0;
						}
					}
				}

				// Popular destinations — top 5 packages by booking count
				const popularDestinations = Object.entries(packageCounts)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 5)
					.map(([packageId, count]) => ({ packageId, bookingCount: count }));

				// Monthly trend array
				const monthlyTrend = Object.entries(monthlyBuckets)
					.sort((a, b) => a[0].localeCompare(b[0]))
					.map(([month, data]) => ({ month, count: data.count, revenue: data.revenue }));

				const totalBookings = allBookings.length;
				const averageGroupSize = groupSizeCount > 0
					? Math.round((totalGroupSize / groupSizeCount) * 100) / 100
					: 0;
				const averageBookingValue = totalBookings > 0
					? Math.round((totalRevenue / totalBookings) * 100) / 100
					: 0;

				return {
					totalBookings,
					bookingsByStatus,
					bookingsByType,
					totalRevenue,
					averageGroupSize,
					averageBookingValue,
					popularDestinations,
					monthlyTrend,
				};
			},
		},

		/**
		 * Get occupancy report for individual_seats packages.
		 * Returns fill rates per package and average fill rate.
		 */
		getOccupancyReport: {
			auth: "required",
			role: "admin",
			params: {
				startDate: { type: "string", optional: true },
				endDate: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { startDate, endDate } = ctx.params;

				// Fetch all individual_seats packages
				const packages = await ctx.call(
					"tourPackage.model.find",
					{ query: { sellingMode: SELLING_MODES.INDIVIDUAL_SEATS } },
					{ meta: ctx.meta }
				);

				const bookingQuery = {};
				if (startDate || endDate) {
					bookingQuery.createdAt = {};
					if (startDate) bookingQuery.createdAt.$gte = new Date(startDate).toISOString();
					if (endDate) bookingQuery.createdAt.$lte = new Date(endDate).toISOString();
				}

				// Fetch bookings that are not cancelled
				const allBookings = await ctx.call(
					"booking.model.find",
					{ query: bookingQuery },
					{ meta: ctx.meta }
				);

				// Aggregate booked seats per package
				const bookedSeatsMap = {};
				for (const booking of allBookings) {
					if (
						booking.status === BOOKING_STATUSES.CANCELLED ||
						booking.status === BOOKING_STATUSES.CANCELLED_WITH_REFUND
					) {
						continue;
					}

					const pkgId = booking.packageId?._id
						? booking.packageId._id.toString()
						: (booking.packageId ? booking.packageId.toString() : null);

					if (pkgId) {
						bookedSeatsMap[pkgId] = (bookedSeatsMap[pkgId] || 0) + (booking.groupSize || 0);
					}
				}

				let totalFillRate = 0;
				let packageCount = 0;

				const packageReports = packages.map((pkg) => {
					const pkgId = pkg._id?.toString ? pkg._id.toString() : pkg._id;
					const totalCapacity = pkg.totalCapacity || pkg.maxCapacity || 0;
					const bookedSeats = bookedSeatsMap[pkgId] || 0;
					const remainingCapacity = Math.max(0, totalCapacity - bookedSeats);
					const fillRate = totalCapacity > 0
						? Math.round((bookedSeats / totalCapacity) * 10000) / 100
						: 0;

					if (totalCapacity > 0) {
						totalFillRate += fillRate;
						packageCount++;
					}

					return {
						packageId: pkgId,
						title: pkg.title || "",
						totalCapacity,
						bookedSeats,
						remainingCapacity,
						fillRate,
					};
				});

				const averageFillRate = packageCount > 0
					? Math.round((totalFillRate / packageCount) * 100) / 100
					: 0;

				return {
					packages: packageReports,
					averageFillRate,
				};
			},
		},

		/**
		 * Confirm a partner for a booking (staff only).
		 */
		confirmPartner: {
			auth: "required",
			role: "staff",
			params: {
				bookingId: "string",
				partnerId: "string",
				notes: "string|optional",
			},
			async handler(ctx) {
				const { bookingId, partnerId, notes } = ctx.params;

				const booking = await ctx.call("booking.model.get", { id: bookingId }, { meta: ctx.meta }).catch(() => null);
				if (!booking) {
					throw new MoleculerClientError("Booking not found.", 404, ERROR_CODES.BOOKING_NOT_FOUND);
				}

				if (booking.status !== BOOKING_STATUSES.PENDING_PARTNER_CONFIRMATION) {
					throw new MoleculerClientError(
						"Booking is not awaiting partner confirmation.",
						422,
						ERROR_CODES.INVALID_BOOKING_TRANSITION,
						{ currentStatus: booking.status }
					);
				}

				// Find and update the partner confirmation
				const confirmations = (booking.partnerConfirmations || []).map(pc => ({ ...pc }));
				const partnerIdx = confirmations.findIndex(
					pc => (pc.partnerId ? pc.partnerId.toString() : pc.partnerId) === partnerId && pc.status === "pending"
				);

				if (partnerIdx === -1) {
					throw new MoleculerClientError("Partner confirmation not found or already resolved.", 404, ERROR_CODES.PARTNER_NOT_FOUND);
				}

				confirmations[partnerIdx].status = "confirmed";
				confirmations[partnerIdx].confirmedAt = new Date();
				confirmations[partnerIdx].confirmedBy = ctx.meta.user.id;
				if (notes) confirmations[partnerIdx].notes = notes;

				// Check if all partners are now confirmed
				const allConfirmed = confirmations.every(pc => pc.status === "confirmed" || pc.status === "auto_confirmed");
				const newStatus = allConfirmed ? BOOKING_STATUSES.PENDING_PAYMENT : booking.status;

				const updated = await ctx.call("booking.model.update", {
					id: bookingId,
					partnerConfirmations: confirmations,
					status: newStatus,
				}, { meta: ctx.meta });

				if (allConfirmed) {
					ctx.emit("booking.allPartnersConfirmed", { bookingId, bookingRef: booking.bookingRef });
				}
				ctx.emit("booking.partnerConfirmed", { bookingId, partnerId, partnerType: confirmations[partnerIdx].partnerType });

				return updated;
			},
		},

		/**
		 * Reject a partner for a booking (staff only).
		 */
		rejectPartner: {
			auth: "required",
			role: "staff",
			params: {
				bookingId: "string",
				partnerId: "string",
				reason: "string|optional",
			},
			async handler(ctx) {
				const { bookingId, partnerId, reason } = ctx.params;

				const booking = await ctx.call("booking.model.get", { id: bookingId }, { meta: ctx.meta }).catch(() => null);
				if (!booking) {
					throw new MoleculerClientError("Booking not found.", 404, ERROR_CODES.BOOKING_NOT_FOUND);
				}

				const confirmations = (booking.partnerConfirmations || []).map(pc => ({ ...pc }));
				const partnerIdx = confirmations.findIndex(
					pc => (pc.partnerId ? pc.partnerId.toString() : pc.partnerId) === partnerId && pc.status === "pending"
				);

				if (partnerIdx === -1) {
					throw new MoleculerClientError("Partner confirmation not found or already resolved.", 404, ERROR_CODES.PARTNER_NOT_FOUND);
				}

				confirmations[partnerIdx].status = "rejected";
				confirmations[partnerIdx].notes = reason || "Partner cannot accommodate";

				await ctx.call("booking.model.update", {
					id: bookingId,
					partnerConfirmations: confirmations,
				}, { meta: ctx.meta });

				ctx.emit("booking.partnerRejected", {
					bookingId,
					partnerId,
					partnerType: confirmations[partnerIdx].partnerType,
					reason,
				});

				return { message: "Partner rejected. Consider suggesting a substitution.", bookingId, partnerId };
			},
		},

		/**
		 * Suggest alternative partners for a rejected/pending partner (staff only).
		 */
		suggestSubstitution: {
			auth: "required",
			role: "staff",
			params: {
				bookingId: "string",
				partnerId: "string",
			},
			async handler(ctx) {
				const { bookingId, partnerId } = ctx.params;

				const booking = await ctx.call("booking.model.get", { id: bookingId }, { meta: ctx.meta }).catch(() => null);
				if (!booking) {
					throw new MoleculerClientError("Booking not found.", 404, ERROR_CODES.BOOKING_NOT_FOUND);
				}

				// Find the rejected/pending partner
				const confirmations = (booking.partnerConfirmations || []).map(pc => ({ ...pc }));
				const partner = confirmations.find(
					pc => (pc.partnerId ? pc.partnerId.toString() : pc.partnerId) === partnerId
				);

				if (!partner) {
					throw new MoleculerClientError("Partner not found in booking.", 404, ERROR_CODES.PARTNER_NOT_FOUND);
				}

				// Get the package to find destinationId
				let destinationId;
				if (booking.packageId) {
					const pkg = await ctx.call("tourPackage.model.get", { id: booking.packageId.toString() }, { meta: ctx.meta }).catch(() => null);
					if (pkg) destinationId = pkg.destinationId;
				}

				if (!destinationId) {
					return { alternatives: [], message: "Could not determine destination for substitution" };
				}

				// Find alternative partners at same destination
				if (partner.partnerType === "hotel") {
					const alternatives = await ctx.call("hotelPartner.getByDestination", {
						destinationId: destinationId.toString(),
					}, { meta: ctx.meta }).catch(() => []);

					// Filter out the rejected partner and unavailable ones
					const filtered = (Array.isArray(alternatives) ? alternatives : []).filter(h => {
						const hId = h._id ? h._id.toString() : h._id;
						return hId !== partnerId && h.isActive && h.availabilityStatus !== "unavailable";
					});

					return { alternatives: filtered, partnerType: "hotel", destinationId };
				}

				return { alternatives: [], partnerType: partner.partnerType };
			},
		},

		/**
		 * Accept a substitution for a partner in a booking (staff only).
		 */
		acceptSubstitution: {
			auth: "required",
			role: "staff",
			params: {
				bookingId: "string",
				oldPartnerId: "string",
				newPartnerId: "string",
			},
			async handler(ctx) {
				const { bookingId, oldPartnerId, newPartnerId } = ctx.params;

				const booking = await ctx.call("booking.model.get", { id: bookingId }, { meta: ctx.meta }).catch(() => null);
				if (!booking) {
					throw new MoleculerClientError("Booking not found.", 404, ERROR_CODES.BOOKING_NOT_FOUND);
				}

				const confirmations = (booking.partnerConfirmations || []).map(pc => ({ ...pc }));
				const oldIdx = confirmations.findIndex(
					pc => (pc.partnerId ? pc.partnerId.toString() : pc.partnerId) === oldPartnerId
				);

				if (oldIdx === -1) {
					throw new MoleculerClientError("Original partner not found in booking.", 404, ERROR_CODES.PARTNER_NOT_FOUND);
				}

				// Check new partner availability
				const tourDateVal = booking.tourDate || new Date();
				let newPartnerCheck;
				if (confirmations[oldIdx].partnerType === "hotel") {
					newPartnerCheck = await ctx.call("hotelPartner.checkAvailability", {
						hotelId: newPartnerId,
						checkInDate: new Date(tourDateVal).toISOString(),
					}, { meta: ctx.meta }).catch(() => ({ available: true, needsConfirmation: true, inventoryModel: "on_request" }));
				}

				// Update the partner confirmation
				confirmations[oldIdx].partnerId = newPartnerId;
				confirmations[oldIdx].partnerName = newPartnerCheck && newPartnerCheck.hotel ? newPartnerCheck.hotel.name : "Substituted Partner";
				confirmations[oldIdx].inventoryModel = newPartnerCheck ? newPartnerCheck.inventoryModel : "on_request";
				confirmations[oldIdx].notes = `Substituted from partner ${oldPartnerId}`;

				if (newPartnerCheck && !newPartnerCheck.needsConfirmation && newPartnerCheck.available) {
					confirmations[oldIdx].status = "auto_confirmed";
					confirmations[oldIdx].confirmedAt = new Date();
				} else {
					confirmations[oldIdx].status = "pending";
				}

				// Check if all partners now confirmed
				const allConfirmed = confirmations.every(pc => pc.status === "confirmed" || pc.status === "auto_confirmed");
				const newStatus = allConfirmed ? BOOKING_STATUSES.PENDING_PAYMENT : booking.status;

				const updated = await ctx.call("booking.model.update", {
					id: bookingId,
					partnerConfirmations: confirmations,
					status: newStatus,
				}, { meta: ctx.meta });

				ctx.emit("booking.partnerSubstituted", { bookingId, oldPartnerId, newPartnerId });

				return updated;
			},
		},
	},

	methods: {
		async populateBookingPackage(ctx, booking) {
			if (!booking.packageId) return booking;
			const pkgId = booking.packageId._id
				? booking.packageId._id.toString()
				: booking.packageId.toString();
			const pkg = await ctx.call(
				"tourPackage.model.get",
				{ id: pkgId },
				{ meta: ctx.meta }
			).catch(() => null);
			if (!pkg) return booking;
			return { ...booking, packageId: { _id: pkg._id, title: pkg.title, slug: pkg.slug, coverImage: pkg.coverImage } };
		},

		async populateBookingsPackages(ctx, bookings) {
			if (!bookings || bookings.length === 0) return bookings;
			const packageIds = [...new Set(
				bookings.filter(b => b.packageId).map(b =>
					b.packageId._id ? b.packageId._id.toString() : b.packageId.toString()
				)
			)];
			if (packageIds.length === 0) return bookings;
			const packages = await ctx.call(
				"tourPackage.model.find",
				{ query: { _id: { $in: packageIds } }, limit: packageIds.length },
				{ meta: ctx.meta }
			).catch(() => []);
			const pkgMap = {};
			for (const pkg of packages) {
				const id = pkg._id?.toString ? pkg._id.toString() : pkg._id;
				if (packageIds.includes(id)) {
					pkgMap[id] = { _id: pkg._id, title: pkg.title, slug: pkg.slug, coverImage: pkg.coverImage };
				}
			}
			return bookings.map(b => {
				if (!b.packageId) return b;
				const id = b.packageId._id ? b.packageId._id.toString() : b.packageId.toString();
				return pkgMap[id] ? { ...b, packageId: pkgMap[id] } : b;
			});
		},
	},

	events: {
		"booking.created"(payload) {
			this.logger.info("Booking created:", payload.bookingRef || payload);
		},
		"booking.statusChanged"(payload) {
			this.logger.info("Booking status changed:", payload.bookingId, payload.fromStatus, "->", payload.toStatus);
		},
		"booking.cancelled"(payload) {
			const { bookingId, packageId } = payload;
			this.logger.info("Booking cancelled:", bookingId || payload);
			if (packageId) {
				this.broker.call("tourPackage.processWaitlist", { packageId: packageId.toString() }, {
					meta: { user: { id: "system", role: "admin" } },
				}).catch(err => this.logger.warn("Failed to process waitlist after cancellation:", err.message));
			}
		},
	},
};
