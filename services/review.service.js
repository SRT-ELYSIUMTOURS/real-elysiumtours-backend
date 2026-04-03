"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, BOOKING_STATUSES } = require("../utils/constants");

module.exports = {
	name: "review",

	dependencies: ["review.model", "tourPackage.model", "booking.model"],

	actions: {
		/**
		 * List all reviews with pagination (admin).
		 * Supports filtering by tourPackageId, rating, isPublished.
		 */
		listAll: {
			auth: "required",
			role: "admin",
			params: {
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
				tourPackageId: { type: "string", optional: true },
				rating: { type: "number", optional: true, convert: true },
				isPublished: { type: "boolean", optional: true, convert: true },
			},
			async handler(ctx) {
				const page = ctx.params.page || 1;
				const pageSize = Math.min(ctx.params.pageSize || 10, 100);
				const query = {};

				if (ctx.params.tourPackageId) query.tourPackageId = ctx.params.tourPackageId;
				if (ctx.params.rating !== undefined) query.rating = ctx.params.rating;
				if (ctx.params.isPublished !== undefined) query.isPublished = ctx.params.isPublished;

				// Tenant scoping
				if (ctx.meta.user.organizationId) {
					query.organizationId = ctx.meta.user.organizationId;
				}

				const [reviews, total] = await Promise.all([
					ctx.call("review.model.find", {
						query,
						sort: "-createdAt",
						limit: pageSize,
						offset: (page - 1) * pageSize,
						populate: ["customerId", "tourPackageId"],
					}),
					ctx.call("review.model.count", { query }),
				]);

				return { data: reviews, total, page, pageSize };
			},
		},

		/**
		 * Get a single review by ID (admin).
		 */
		getById: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const review = await ctx.call("review.model.get", { id: ctx.params.id }).catch(() => null);
				if (!review) {
					throw new MoleculerClientError(
						"Review not found.",
						404,
						ERROR_CODES.REVIEW_NOT_FOUND
					);
				}
				return review;
			},
		},

		/**
		 * List published reviews for a tour package.
		 * Public endpoint — no auth required.
		 */
		listByTour: {
			auth: undefined,
			params: {
				tourPackageId: "string",
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { tourPackageId } = ctx.params;
				const page = ctx.params.page || 1;
				const pageSize = Math.min(ctx.params.pageSize || 10, 50);

				const query = {
					tourPackageId,
					isPublished: true,
				};

				const [reviews, stats] = await Promise.all([
					ctx.call("review.model.find", {
						query,
						sort: "-createdAt",
						limit: pageSize,
						offset: (page - 1) * pageSize,
						populate: ["customerId"],
					}),
					this.computeStats(ctx, tourPackageId),
				]);

				return {
					reviews,
					page,
					pageSize,
					...stats,
				};
			},
		},

		/**
		 * Create a new review.
		 * Requires authentication.
		 */
		create: {
			auth: "required",
			params: {
				tourPackageId: "string",
				bookingId: { type: "string", optional: true },
				rating: { type: "number", min: 1, max: 5 },
				title: { type: "string", optional: true },
				comment: "string",
				images: { type: "array", optional: true },
			},
			async handler(ctx) {
				const { tourPackageId, bookingId, rating, title, comment, images } = ctx.params;
				const customerId = ctx.meta.user.id;

				// Validate tour package exists
				const tourPackage = await ctx.call("tourPackage.model.get", { id: tourPackageId }).catch(() => null);
				if (!tourPackage) {
					throw new MoleculerClientError(
						"Tour package not found.",
						404,
						ERROR_CODES.PACKAGE_NOT_FOUND
					);
				}

				let isVerified = false;

				// If bookingId provided, validate it belongs to user and is completed
				if (bookingId) {
					const booking = await ctx.call("booking.model.get", { id: bookingId }).catch(() => null);
					if (!booking) {
						throw new MoleculerClientError(
							"Booking not found.",
							404,
							ERROR_CODES.BOOKING_NOT_FOUND
						);
					}

					const bookingCustomerId = booking.customerId && booking.customerId.toString
						? booking.customerId.toString()
						: booking.customerId;

					if (bookingCustomerId !== customerId) {
						throw new MoleculerClientError(
							"This booking does not belong to you.",
							403,
							ERROR_CODES.REVIEW_ACCESS_DENIED
						);
					}

					if (booking.status === BOOKING_STATUSES.TOUR_COMPLETED) {
						isVerified = true;
					}
				}

				const reviewData = {
					tourPackageId,
					customerId,
					bookingId: bookingId || undefined,
					rating,
					title: title || undefined,
					comment,
					images: images || [],
					isVerified,
					isPublished: true,
				};

				// Add organizationId if available
				if (ctx.meta.user.organizationId) {
					reviewData.organizationId = ctx.meta.user.organizationId;
				}

				const review = await ctx.call("review.model.create", reviewData);

				ctx.emit("review.created", {
					reviewId: review._id.toString(),
					tourPackageId,
					customerId,
					rating,
				});

				return review;
			},
		},

		/**
		 * Update own review.
		 * Requires authentication.
		 */
		update: {
			auth: "required",
			params: {
				id: "string",
				rating: { type: "number", min: 1, max: 5, optional: true },
				title: { type: "string", optional: true },
				comment: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { id, rating, title, comment } = ctx.params;
				const customerId = ctx.meta.user.id;

				const review = await ctx.call("review.model.get", { id }).catch(() => null);
				if (!review) {
					throw new MoleculerClientError(
						"Review not found.",
						404,
						ERROR_CODES.REVIEW_NOT_FOUND
					);
				}

				const reviewCustomerId = review.customerId && review.customerId.toString
					? review.customerId.toString()
					: review.customerId;

				if (reviewCustomerId !== customerId) {
					throw new MoleculerClientError(
						"You can only update your own reviews.",
						403,
						ERROR_CODES.REVIEW_ACCESS_DENIED
					);
				}

				const updateData = { id };
				if (rating !== undefined) updateData.rating = rating;
				if (title !== undefined) updateData.title = title;
				if (comment !== undefined) updateData.comment = comment;

				const updated = await ctx.call("review.model.update", updateData);

				ctx.emit("review.updated", {
					reviewId: id,
					tourPackageId: review.tourPackageId.toString(),
					rating: updated.rating,
				});

				return updated;
			},
		},

		/**
		 * Delete a review.
		 * Owner or admin can delete.
		 */
		delete: {
			auth: "required",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;
				const customerId = ctx.meta.user.id;
				const userRole = ctx.meta.user.role;

				const review = await ctx.call("review.model.get", { id }).catch(() => null);
				if (!review) {
					throw new MoleculerClientError(
						"Review not found.",
						404,
						ERROR_CODES.REVIEW_NOT_FOUND
					);
				}

				const reviewCustomerId = review.customerId && review.customerId.toString
					? review.customerId.toString()
					: review.customerId;

				if (reviewCustomerId !== customerId && userRole !== "admin" && userRole !== "super_admin") {
					throw new MoleculerClientError(
						"You can only delete your own reviews.",
						403,
						ERROR_CODES.REVIEW_ACCESS_DENIED
					);
				}

				const tourPackageId = review.tourPackageId.toString();
				const result = await ctx.call("review.model.remove", { id });

				ctx.emit("review.deleted", {
					reviewId: id,
					tourPackageId,
				});

				return result;
			},
		},

		/**
		 * Add an admin response to a review.
		 * Admin only.
		 */
		addResponse: {
			auth: "required",
			role: "admin",
			params: {
				reviewId: "string",
				text: "string",
			},
			async handler(ctx) {
				const { reviewId, text } = ctx.params;
				const respondedBy = ctx.meta.user.id;

				const review = await ctx.call("review.model.get", { id: reviewId }).catch(() => null);
				if (!review) {
					throw new MoleculerClientError(
						"Review not found.",
						404,
						ERROR_CODES.REVIEW_NOT_FOUND
					);
				}

				return ctx.call("review.model.update", {
					id: reviewId,
					response: {
						text,
						respondedBy,
						respondedAt: new Date(),
					},
				});
			},
		},

		/**
		 * Get review statistics for a tour package.
		 * Public endpoint.
		 */
		getStats: {
			auth: undefined,
			params: {
				tourPackageId: "string",
			},
			async handler(ctx) {
				return this.computeStats(ctx, ctx.params.tourPackageId);
			},
		},
	},

	methods: {
		/**
		 * Recalculate and cache the average rating on the tour package.
		 * Called by review.created / review.updated / review.deleted events.
		 * @param {String} tourPackageId
		 */
		async recalculateRating(tourPackageId) {
			const reviews = await this.broker.call("review.model.find", {
				query: { tourPackageId, isPublished: true },
			});

			const count = reviews.length;
			const avg = count > 0
				? reviews.reduce((sum, r) => sum + r.rating, 0) / count
				: 0;

			// Update the tour package with cached rating
			await this.broker.call("tourPackage.model.update", {
				id: tourPackageId.toString(),
				rating: Math.round(avg * 10) / 10,
				reviewCount: count,
			}).catch(err => this.logger.error("Failed to update tour rating:", err));
		},

		/**
		 * Calculate time-based weight for a review.
		 * Recent reviews are weighted higher (Booking.com pattern).
		 * @param {Date|string} createdAt
		 * @returns {number} weight multiplier
		 */
		getReviewWeight(createdAt) {
			const daysOld = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
			if (daysOld <= 90) return 3.0;    // Last 3 months: 3x weight
			if (daysOld <= 365) return 1.0;   // 3-12 months: normal weight
			if (daysOld <= 730) return 0.5;   // 1-2 years: half weight
			return 0.2;                        // 2+ years: minimal weight
		},

		/**
		 * Compute review statistics for a tour package.
		 *
		 * @param {Context} ctx
		 * @param {String} tourPackageId
		 * @returns {Promise<Object>} stats object with weighted and simple averages
		 */
		async computeStats(ctx, tourPackageId) {
			const allReviews = await ctx.call("review.model.find", {
				query: { tourPackageId, isPublished: true },
			});

			const totalReviews = allReviews.length;
			const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

			let ratingSum = 0;
			let weightedRatingSum = 0;
			let weightSum = 0;
			let recentWeightedSum = 0;
			let recentWeightTotal = 0;
			let recentReviewCount = 0;
			let verifiedReviewCount = 0;

			const now = Date.now();
			const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

			for (const review of allReviews) {
				ratingSum += review.rating;
				ratingBreakdown[review.rating] = (ratingBreakdown[review.rating] || 0) + 1;

				const weight = this.getReviewWeight(review.createdAt);
				weightedRatingSum += review.rating * weight;
				weightSum += weight;

				if (review.createdAt && (now - new Date(review.createdAt).getTime()) <= ninetyDaysMs) {
					recentReviewCount++;
					recentWeightedSum += review.rating * weight;
					recentWeightTotal += weight;
				}

				if (review.isVerified) {
					verifiedReviewCount++;
				}
			}

			// Simple average (backwards compat — kept as "averageRating" for existing consumers)
			const averageRating = totalReviews > 0
				? Math.round((ratingSum / totalReviews) * 10) / 10
				: 0;

			// Weighted average
			const weightedAverageRating = weightSum > 0
				? Math.round((weightedRatingSum / weightSum) * 10) / 10
				: 0;

			// Trend indicator
			let trendIndicator = "stable";
			if (recentReviewCount > 0 && weightSum > 0) {
				const recentWeightedAvg = recentWeightedSum / recentWeightTotal;
				const overallWeightedAvg = weightedRatingSum / weightSum;
				if (recentWeightedAvg > overallWeightedAvg + 0.3) {
					trendIndicator = "improving";
				} else if (recentWeightedAvg < overallWeightedAvg - 0.3) {
					trendIndicator = "declining";
				}
			}

			return {
				weightedAverageRating,
				simpleAverageRating: averageRating,
				averageRating, // backwards compat alias
				totalReviews,
				recentReviewCount,
				verifiedReviewCount,
				trendIndicator,
				ratingBreakdown,
			};
		},
	},

	events: {
		"review.created": {
			async handler(ctx) {
				await this.recalculateRating(ctx.params.tourPackageId);
			},
		},
		"review.updated": {
			async handler(ctx) {
				await this.recalculateRating(ctx.params.tourPackageId);
			},
		},
		"review.deleted": {
			async handler(ctx) {
				await this.recalculateRating(ctx.params.tourPackageId);
			},
		},
	},
};
