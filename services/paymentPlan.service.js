"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, PAYMENT_PLAN_STATUSES, MILESTONE_STATUSES } = require("../utils/constants");
const { PAYMENT_PLAN_TRANSITIONS, isValidTransition } = require("../config/bookingStates.config");

const DEFAULT_COMMITMENT_FEE_PERCENT = parseInt(process.env.DEFAULT_COMMITMENT_FEE_PERCENT, 10) || 15;

/**
 * Generate milestone labels based on number and position.
 * @param {number} index - 0-based index
 * @param {number} total - total number of milestones
 * @returns {string}
 */
function getMilestoneLabel(index, total) {
	if (index === 0) return "Commitment Fee";
	if (index === total - 1) return "Final Payment";

	const ordinals = [
		"Second", "Third", "Fourth", "Fifth", "Sixth",
		"Seventh", "Eighth", "Ninth", "Tenth",
	];
	const label = ordinals[index - 1] || `Payment ${index + 1}`;
	return `${label} Payment`;
}

module.exports = {
	name: "paymentPlan",

	dependencies: ["paymentPlan.model", "milestone.model", "booking.model", "payment.model"],

	actions: {
		/**
		 * Create a payment plan with auto-generated milestones.
		 * Internal action -- called after booking is confirmed.
		 */
		createPlan: {
			auth: undefined,
			params: {
				bookingId: "string",
				totalAmount: "number",
				commitmentFeePercent: { type: "number", optional: true },
				numberOfMilestones: { type: "number", optional: true },
			},
			async handler(ctx) {
				const {
					bookingId,
					totalAmount,
					commitmentFeePercent = DEFAULT_COMMITMENT_FEE_PERCENT,
					numberOfMilestones = 3,
				} = ctx.params;

				// Fetch booking to get customerId
				const booking = await ctx.call(
					"booking.model.get",
					{ id: bookingId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!booking) {
					throw new MoleculerClientError(
						"Booking not found.",
						404,
						ERROR_CODES.BOOKING_NOT_FOUND,
						{ bookingId }
					);
				}

				const customerId = booking.customerId?._id
					? booking.customerId._id.toString()
					: booking.customerId.toString();

				const commitmentFeeAmount = Math.round((totalAmount * commitmentFeePercent) / 100 * 100) / 100;
				const remainingAmount = totalAmount - commitmentFeeAmount;

				// Create payment plan record
				const paymentPlan = await ctx.call(
					"paymentPlan.model.create",
					{
						bookingId,
						customerId,
						totalAmount,
						paidAmount: 0,
						remainingAmount: totalAmount,
						currency: "GHS",
						commitmentFeePercent,
						commitmentFeeAmount,
						numberOfMilestones,
						status: PAYMENT_PLAN_STATUSES.ACTIVE,
					},
					{ meta: ctx.meta }
				);

				const planId = paymentPlan._id?.toString ? paymentPlan._id.toString() : paymentPlan._id;
				const now = new Date();

				// Build milestones
				const milestones = [];
				for (let i = 0; i < numberOfMilestones; i++) {
					let amount;
					let dueDate;

					if (i === 0) {
						// Commitment fee -- due immediately
						amount = commitmentFeeAmount;
						dueDate = now.toISOString();
					} else {
						// Split remaining amount evenly among remaining milestones
						const perMilestone = Math.round((remainingAmount / (numberOfMilestones - 1)) * 100) / 100;
						amount = perMilestone;
						dueDate = new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000).toISOString();
					}

					const milestone = await ctx.call(
						"milestone.model.create",
						{
							paymentPlanId: planId,
							bookingId,
							milestoneNumber: i + 1,
							label: getMilestoneLabel(i, numberOfMilestones),
							amount,
							currency: "GHS",
							dueDate,
							status: MILESTONE_STATUSES.PENDING,
							isOverdue: false,
						},
						{ meta: ctx.meta }
					);

					milestones.push(milestone);
				}

				return { paymentPlan, milestones };
			},
		},

		/**
		 * Get a payment plan by bookingId, with all milestones.
		 */
		getPlan: {
			auth: "required",
			params: {
				bookingId: "string",
			},
			async handler(ctx) {
				const { bookingId } = ctx.params;

				const plans = await ctx.call(
					"paymentPlan.model.find",
					{ query: { bookingId } },
					{ meta: ctx.meta }
				);

				const paymentPlan = plans && plans.length > 0 ? plans[0] : null;

				if (!paymentPlan) {
					throw new MoleculerClientError(
						"Payment plan not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ bookingId }
					);
				}

				// Validate ownership for customers
				const user = ctx.meta.user;
				if (user.role === "customer") {
					const planCustomerId = paymentPlan.customerId?._id
						? paymentPlan.customerId._id.toString()
						: paymentPlan.customerId.toString();

					if (planCustomerId !== user.id) {
						throw new MoleculerClientError(
							"You do not have access to this payment plan.",
							403,
							ERROR_CODES.FORBIDDEN,
							{ bookingId }
						);
					}
				}

				const planId = paymentPlan._id?.toString ? paymentPlan._id.toString() : paymentPlan._id;

				const milestones = await ctx.call(
					"milestone.model.find",
					{ query: { paymentPlanId: planId }, sort: "milestoneNumber" },
					{ meta: ctx.meta }
				);

				return { paymentPlan, milestones };
			},
		},

		/**
		 * Get a payment plan by its own ID, with milestones.
		 */
		getPlanById: {
			auth: "required",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const paymentPlan = await ctx.call(
					"paymentPlan.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!paymentPlan) {
					throw new MoleculerClientError(
						"Payment plan not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				const planId = paymentPlan._id?.toString ? paymentPlan._id.toString() : paymentPlan._id;

				const milestones = await ctx.call(
					"milestone.model.find",
					{ query: { paymentPlanId: planId }, sort: "milestoneNumber" },
					{ meta: ctx.meta }
				);

				return { paymentPlan, milestones };
			},
		},

		/**
		 * Get all milestones for a payment plan, ordered by milestoneNumber.
		 */
		getMilestones: {
			auth: "required",
			params: {
				paymentPlanId: "string",
			},
			async handler(ctx) {
				const milestones = await ctx.call(
					"milestone.model.find",
					{ query: { paymentPlanId: ctx.params.paymentPlanId }, sort: "milestoneNumber" },
					{ meta: ctx.meta }
				);

				return milestones;
			},
		},

		/**
		 * Mark a milestone as paid and update the payment plan totals.
		 */
		payMilestone: {
			auth: "required",
			params: {
				milestoneId: "string",
				paymentId: "string",
			},
			async handler(ctx) {
				const { milestoneId, paymentId } = ctx.params;

				// Fetch milestone
				const milestone = await ctx.call(
					"milestone.model.get",
					{ id: milestoneId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!milestone) {
					throw new MoleculerClientError(
						"Milestone not found.",
						404,
						ERROR_CODES.MILESTONE_NOT_FOUND,
						{ milestoneId }
					);
				}

				// Validate status
				if (milestone.status === MILESTONE_STATUSES.PAID) {
					throw new MoleculerClientError(
						"Milestone has already been paid.",
						422,
						ERROR_CODES.MILESTONE_ALREADY_PAID,
						{ milestoneId, status: milestone.status }
					);
				}

				if (
					milestone.status !== MILESTONE_STATUSES.PENDING &&
					milestone.status !== MILESTONE_STATUSES.OVERDUE
				) {
					throw new MoleculerClientError(
						"Milestone is not in a payable state.",
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{ milestoneId, status: milestone.status }
					);
				}

				// Update milestone
				const updatedMilestone = await ctx.call(
					"milestone.model.update",
					{
						id: milestoneId,
						status: MILESTONE_STATUSES.PAID,
						paidAt: new Date().toISOString(),
						paymentId,
					},
					{ meta: ctx.meta }
				);

				// Fetch payment plan
				const planId = milestone.paymentPlanId?._id
					? milestone.paymentPlanId._id.toString()
					: milestone.paymentPlanId.toString();

				const paymentPlan = await ctx.call(
					"paymentPlan.model.get",
					{ id: planId },
					{ meta: ctx.meta }
				);

				const newPaidAmount = (paymentPlan.paidAmount || 0) + milestone.amount;
				const newRemainingAmount = paymentPlan.totalAmount - newPaidAmount;

				const planUpdate = {
					id: planId,
					paidAmount: newPaidAmount,
					remainingAmount: newRemainingAmount,
				};

				// Check if all milestones are now paid
				const allMilestones = await ctx.call(
					"milestone.model.find",
					{ query: { paymentPlanId: planId } },
					{ meta: ctx.meta }
				);

				const allPaid = allMilestones.every((m) => {
					const mId = m._id?.toString ? m._id.toString() : m._id;
					if (mId === milestoneId) return true; // this one is now paid
					return m.status === MILESTONE_STATUSES.PAID;
				});

				if (allPaid) {
					planUpdate.status = PAYMENT_PLAN_STATUSES.COMPLETED;
					planUpdate.completedAt = new Date().toISOString();
				}

				const updatedPlan = await ctx.call(
					"paymentPlan.model.update",
					planUpdate,
					{ meta: ctx.meta }
				);

				ctx.emit("paymentPlan.milestonePaid", {
					milestoneId,
					paymentPlanId: planId,
					paymentId,
					amount: milestone.amount,
				});

				return { milestone: updatedMilestone, paymentPlan: updatedPlan };
			},
		},

		/**
		 * Get the next unpaid milestone for a booking.
		 */
		getNextDueMilestone: {
			auth: "required",
			params: {
				bookingId: "string",
			},
			async handler(ctx) {
				const { bookingId } = ctx.params;

				const milestones = await ctx.call(
					"milestone.model.find",
					{
						query: {
							bookingId,
							status: { $in: [MILESTONE_STATUSES.PENDING, MILESTONE_STATUSES.OVERDUE] },
						},
						sort: "dueDate",
						limit: 1,
					},
					{ meta: ctx.meta }
				);

				if (!milestones || milestones.length === 0) {
					return null;
				}

				return milestones[0];
			},
		},

		/**
		 * Check for overdue milestones and mark them.
		 * Internal action -- called by Bull job.
		 */
		checkOverdue: {
			auth: undefined,
			async handler(ctx) {
				const now = new Date().toISOString();

				const overdueMilestones = await ctx.call(
					"milestone.model.find",
					{
						query: {
							status: MILESTONE_STATUSES.PENDING,
							dueDate: { $lt: now },
						},
					},
					{ meta: ctx.meta }
				);

				let updatedCount = 0;

				for (const milestone of overdueMilestones) {
					const milestoneId = milestone._id?.toString ? milestone._id.toString() : milestone._id;

					await ctx.call(
						"milestone.model.update",
						{
							id: milestoneId,
							status: MILESTONE_STATUSES.OVERDUE,
							isOverdue: true,
						},
						{ meta: ctx.meta }
					);

					ctx.emit("paymentPlan.milestoneOverdue", {
						milestoneId,
						paymentPlanId: milestone.paymentPlanId?.toString
							? milestone.paymentPlanId.toString()
							: milestone.paymentPlanId,
						bookingId: milestone.bookingId?.toString
							? milestone.bookingId.toString()
							: milestone.bookingId,
						dueDate: milestone.dueDate,
						amount: milestone.amount,
					});

					updatedCount++;
				}

				return { updatedCount };
			},
		},

		/**
		 * Send reminders for milestones due within the next 3 days.
		 * Internal action -- called by Bull job.
		 */
		sendReminders: {
			auth: undefined,
			async handler(ctx) {
				const now = new Date();
				const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

				const upcomingMilestones = await ctx.call(
					"milestone.model.find",
					{
						query: {
							status: MILESTONE_STATUSES.PENDING,
							dueDate: { $lte: threeDaysFromNow, $gte: now.toISOString() },
						},
					},
					{ meta: ctx.meta }
				);

				let sentCount = 0;

				for (const milestone of upcomingMilestones) {
					const milestoneId = milestone._id?.toString ? milestone._id.toString() : milestone._id;

					ctx.emit("paymentPlan.reminderDue", {
						milestoneId,
						paymentPlanId: milestone.paymentPlanId?.toString
							? milestone.paymentPlanId.toString()
							: milestone.paymentPlanId,
						bookingId: milestone.bookingId?.toString
							? milestone.bookingId.toString()
							: milestone.bookingId,
						dueDate: milestone.dueDate,
						amount: milestone.amount,
						label: milestone.label,
					});

					await ctx.call(
						"milestone.model.update",
						{
							id: milestoneId,
							reminderSentAt: new Date().toISOString(),
						},
						{ meta: ctx.meta }
					);

					sentCount++;
				}

				return { sentCount };
			},
		},
	},

	events: {
		/**
		 * When a booking is created, auto-create a payment plan.
		 */
		async "booking.created"(payload) {
			const { bookingId, totalAmount, customerId } = payload;

			if (!bookingId || !totalAmount) {
				this.logger.warn("booking.created event missing bookingId or totalAmount", payload);
				return;
			}

			try {
				await this.broker.call("paymentPlan.createPlan", {
					bookingId: bookingId.toString(),
					totalAmount,
				});
				this.logger.info("Payment plan created for booking:", bookingId);
			} catch (err) {
				this.logger.error("Failed to create payment plan for booking:", bookingId, err.message);
			}
		},

		/**
		 * When a payment is verified, find the relevant milestone and mark it paid.
		 */
		async "payment.verified"(payload) {
			const { bookingId, paymentId, amount } = payload;

			if (!bookingId || !paymentId) {
				this.logger.warn("payment.verified event missing bookingId or paymentId", payload);
				return;
			}

			// System-level meta for internal event handler calls.
			// Event handlers are internal — they bypass the API gateway,
			// so they need a system user context to pass auth checks.
			const systemMeta = {
				meta: { user: { id: "system", email: "system@internal", role: "admin" } },
			};

			try {
				// Find the next unpaid milestone for this booking
				const milestones = await this.broker.call("milestone.model.find", {
					query: {
						bookingId: bookingId.toString(),
						status: { $in: [MILESTONE_STATUSES.PENDING, MILESTONE_STATUSES.OVERDUE] },
					},
					sort: "milestoneNumber",
					limit: 1,
				}, systemMeta);

				if (milestones && milestones.length > 0) {
					const milestone = milestones[0];
					const milestoneId = milestone._id?.toString ? milestone._id.toString() : milestone._id;

					await this.broker.call("paymentPlan.payMilestone", {
						milestoneId,
						paymentId: paymentId.toString(),
					}, systemMeta);

					this.logger.info("Milestone paid via payment.verified:", milestoneId);
				} else {
					this.logger.warn("No unpaid milestone found for booking:", bookingId);
				}
			} catch (err) {
				this.logger.error("Failed to process payment.verified for booking:", bookingId, err.message);
			}
		},
	},
};
