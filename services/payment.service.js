"use strict";

const crypto = require("crypto");
const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, PAYMENT_STATUSES, BOOKING_STATUSES } = require("../utils/constants");
const { BOOKING_TRANSITIONS, isValidTransition } = require("../config/bookingStates.config");
const paystackConfig = require("../config/paystack.config");
const PaystackMixin = require("../mixins/payment/paystack.mixin");

module.exports = {
	name: "payment",

	dependencies: ["payment.model", "booking.model", "paymentPlan.model"],

	mixins: [PaystackMixin],

	actions: {
		/**
		 * Initiate a payment for a booking.
		 * Creates a payment record and initializes a Paystack transaction.
		 */
		initiatePayment: {
			auth: "required",
			params: {
				bookingId: "string",
				paymentType: {
					type: "enum",
					values: ["commitment_fee", "milestone", "full_payment"],
				},
				amount: { type: "number", optional: true, convert: true },
			},
			async handler(ctx) {
				const { bookingId, paymentType, amount: milestoneAmount } = ctx.params;
				const userId = ctx.meta.user.id;

				// Fetch booking
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

				// Validate ownership
				const bookingCustomerId = booking.customerId?._id
					? booking.customerId._id.toString()
					: booking.customerId.toString();

				if (bookingCustomerId !== userId) {
					throw new MoleculerClientError(
						"You do not own this booking.",
						403,
						ERROR_CODES.FORBIDDEN,
						{ bookingId }
					);
				}

				// Validate booking status is pending_payment
				if (booking.status !== BOOKING_STATUSES.PENDING_PAYMENT) {
					throw new MoleculerClientError(
						`Booking is not in a payable state. Current status: "${booking.status}".`,
						422,
						ERROR_CODES.INVALID_BOOKING_TRANSITION,
						{ bookingId, currentStatus: booking.status }
					);
				}

				// Calculate amount based on payment type
				let amount;
				if (paymentType === "commitment_fee") {
					amount = booking.commitmentFeeAmount;
					if (!amount) {
						throw new MoleculerClientError(
							"Commitment fee amount not set on booking.",
							422,
							ERROR_CODES.COMMITMENT_FEE_REQUIRED,
							{ bookingId }
						);
					}
				} else if (paymentType === "full_payment") {
					amount = booking.totalAmount;
				} else if (paymentType === "milestone") {
					if (!milestoneAmount || milestoneAmount <= 0) {
						throw new MoleculerClientError(
							"Amount is required for milestone payments.",
							422,
							ERROR_CODES.VALIDATION_ERROR,
							{ paymentType }
						);
					}
					amount = milestoneAmount;
				}

				// Generate transaction reference
				const timestamp = Date.now();
				const randomHex = crypto.randomBytes(2).toString("hex");
				const transactionRef = `ELY-PAY-${timestamp}-${randomHex}`;

				// Create payment record
				const payment = await ctx.call(
					"payment.model.create",
					{
						bookingId,
						customerId: userId,
						amount,
						currency: booking.currency || "GHS",
						provider: "paystack",
						paymentType,
						transactionRef,
						status: PAYMENT_STATUSES.PENDING,
					},
					{ meta: ctx.meta }
				);

				// Fetch customer email for Paystack
				const user = await ctx.call(
					"user.model.get",
					{ id: userId },
					{ meta: ctx.meta }
				).catch(() => null);

				const email = user?.email || ctx.meta.user.email || "customer@elysiumtours.com";

				// Initialize Paystack transaction
				const paystackResult = await this.initializeTransaction({
					email,
					amount,
					currency: booking.currency || "GHS",
					reference: transactionRef,
					callbackUrl: paystackConfig.callbackUrl,
					metadata: {
						bookingId,
						paymentId: payment._id.toString(),
						paymentType,
						customerId: userId,
					},
				});

				// Update payment with Paystack response
				const paymentId = payment._id?.toString ? payment._id.toString() : payment._id;
				await ctx.call(
					"payment.model.update",
					{
						id: paymentId,
						accessCode: paystackResult.access_code,
						authorizationUrl: paystackResult.authorization_url,
						paystackReference: paystackResult.reference,
						status: PAYMENT_STATUSES.PROCESSING,
					},
					{ meta: ctx.meta }
				);

				// Transition booking to payment_processing
				if (isValidTransition(BOOKING_TRANSITIONS, booking.status, BOOKING_STATUSES.PAYMENT_PROCESSING)) {
					await ctx.call(
						"booking.model.update",
						{
							id: bookingId,
							status: BOOKING_STATUSES.PAYMENT_PROCESSING,
						},
						{ meta: ctx.meta }
					);
				}

				return {
					paymentId,
					authorizationUrl: paystackResult.authorization_url,
					accessCode: paystackResult.access_code,
					transactionRef,
				};
			},
		},

		/**
		 * Verify a payment by its transaction reference.
		 * Can be called by webhook callback or customer redirect.
		 */
		verifyPayment: {
			auth: undefined,
			params: {
				reference: "string",
			},
			async handler(ctx) {
				const { reference } = ctx.params;

				// Find payment by transactionRef
				const payments = await ctx.call(
					"payment.model.find",
					{ query: { transactionRef: reference } },
					{ meta: ctx.meta }
				);

				const payment = payments && payments.length > 0 ? payments[0] : null;

				if (!payment) {
					throw new MoleculerClientError(
						"Payment not found.",
						404,
						ERROR_CODES.PAYMENT_NOT_FOUND,
						{ reference }
					);
				}

				// Skip if already verified
				if (payment.status === PAYMENT_STATUSES.SUCCESS) {
					const booking = await ctx.call(
						"booking.model.get",
						{ id: payment.bookingId.toString() },
						{ meta: ctx.meta }
					).catch(() => null);

					return { payment, booking };
				}

				// Verify with Paystack
				const paystackData = await this.verifyTransaction(reference);

				const paymentId = payment._id?.toString ? payment._id.toString() : payment._id;
				const bookingId = payment.bookingId?.toString ? payment.bookingId.toString() : payment.bookingId;

				if (paystackData.status === "success") {
					// Update payment as successful
					await ctx.call(
						"payment.model.update",
						{
							id: paymentId,
							status: PAYMENT_STATUSES.SUCCESS,
							paidAt: paystackData.paid_at || new Date().toISOString(),
							metadata: paystackData,
						},
						{ meta: ctx.meta }
					);

					// If commitment fee, mark it paid on the booking
					if (payment.paymentType === "commitment_fee") {
						await ctx.call(
							"booking.model.update",
							{
								id: bookingId,
								commitmentFeePaid: true,
							},
							{ meta: ctx.meta }
						);
					}

					// Transition booking to confirmed
					const booking = await ctx.call(
						"booking.model.get",
						{ id: bookingId },
						{ meta: ctx.meta }
					).catch(() => null);

					if (
						booking &&
						isValidTransition(BOOKING_TRANSITIONS, booking.status, BOOKING_STATUSES.CONFIRMED)
					) {
						await ctx.call(
							"booking.model.update",
							{
								id: bookingId,
								status: BOOKING_STATUSES.CONFIRMED,
								confirmedAt: new Date().toISOString(),
							},
							{ meta: ctx.meta }
						);
					}

					const updatedBooking = await ctx.call(
						"booking.model.get",
						{ id: bookingId },
						{ meta: ctx.meta }
					).catch(() => null);

					ctx.emit("payment.verified", {
						bookingId,
						paymentId,
						amount: payment.amount,
					});

					const updatedPayment = await ctx.call(
						"payment.model.get",
						{ id: paymentId },
						{ meta: ctx.meta }
					).catch(() => payment);

					return { payment: updatedPayment, booking: updatedBooking };
				}

				// Payment failed
				await ctx.call(
					"payment.model.update",
					{
						id: paymentId,
						status: PAYMENT_STATUSES.FAILED,
						metadata: paystackData,
					},
					{ meta: ctx.meta }
				);

				// Revert booking status to pending_payment
				const booking = await ctx.call(
					"booking.model.get",
					{ id: bookingId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (
					booking &&
					isValidTransition(BOOKING_TRANSITIONS, booking.status, BOOKING_STATUSES.PENDING_PAYMENT)
				) {
					await ctx.call(
						"booking.model.update",
						{
							id: bookingId,
							status: BOOKING_STATUSES.PENDING_PAYMENT,
						},
						{ meta: ctx.meta }
					);
				}

				const updatedBooking = await ctx.call(
					"booking.model.get",
					{ id: bookingId },
					{ meta: ctx.meta }
				).catch(() => null);

				ctx.emit("payment.failed", {
					bookingId,
					paymentId,
					reference,
				});

				const updatedPayment = await ctx.call(
					"payment.model.get",
					{ id: paymentId },
					{ meta: ctx.meta }
				).catch(() => payment);

				return { payment: updatedPayment, booking: updatedBooking };
			},
		},

		/**
		 * Refund a payment (admin only).
		 * Creates a refund record and initiates refund via Paystack.
		 */
		refundPayment: {
			auth: "required",
			role: "admin",
			params: {
				paymentId: "string",
				amount: { type: "number", optional: true, convert: true },
				reason: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { paymentId, amount: refundAmount, reason } = ctx.params;

				const payment = await ctx.call(
					"payment.model.get",
					{ id: paymentId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!payment) {
					throw new MoleculerClientError(
						"Payment not found.",
						404,
						ERROR_CODES.PAYMENT_NOT_FOUND,
						{ paymentId }
					);
				}

				if (payment.status !== PAYMENT_STATUSES.SUCCESS) {
					throw new MoleculerClientError(
						"Only successful payments can be refunded.",
						422,
						ERROR_CODES.PAYMENT_FAILED,
						{ paymentId, status: payment.status }
					);
				}

				const amount = refundAmount || payment.amount;
				const bookingId = payment.bookingId?.toString ? payment.bookingId.toString() : payment.bookingId;

				// Call Paystack refund
				await this.createRefund({
					transaction: payment.transactionRef,
					amount,
					reason,
				});

				// Create refund payment record
				const timestamp = Date.now();
				const randomHex = crypto.randomBytes(2).toString("hex");
				const refundRef = `ELY-REF-${timestamp}-${randomHex}`;

				await ctx.call(
					"payment.model.create",
					{
						bookingId,
						customerId: payment.customerId?.toString ? payment.customerId.toString() : payment.customerId,
						amount: -amount,
						currency: payment.currency || "GHS",
						provider: "paystack",
						paymentType: "refund",
						transactionRef: refundRef,
						status: PAYMENT_STATUSES.SUCCESS,
						paidAt: new Date().toISOString(),
						refundReason: reason || "Refund processed",
					},
					{ meta: ctx.meta }
				);

				// Update original payment
				const totalRefunded = (payment.refundedAmount || 0) + amount;
				const newStatus = totalRefunded >= payment.amount
					? PAYMENT_STATUSES.REFUNDED
					: PAYMENT_STATUSES.PARTIALLY_REFUNDED;

				await ctx.call(
					"payment.model.update",
					{
						id: paymentId,
						status: newStatus,
						refundedAmount: totalRefunded,
						refundReason: reason || payment.refundReason,
					},
					{ meta: ctx.meta }
				);

				ctx.emit("payment.refunded", {
					bookingId,
					paymentId,
					refundAmount: amount,
					reason,
				});

				const updatedPayment = await ctx.call(
					"payment.model.get",
					{ id: paymentId },
					{ meta: ctx.meta }
				).catch(() => payment);

				return updatedPayment;
			},
		},

		/**
		 * Get payment transactions with filtering and pagination.
		 * Customers see only their own payments; admins see all.
		 */
		getTransactions: {
			auth: "required",
			params: {
				bookingId: { type: "string", optional: true },
				status: { type: "string", optional: true },
				page: { type: "number", optional: true, convert: true },
				pageSize: { type: "number", optional: true, convert: true },
			},
			async handler(ctx) {
				const { bookingId, status, page = 1, pageSize = 20 } = ctx.params;
				const user = ctx.meta.user;

				const query = {};

				// Scope to customer if not admin/super_admin/staff
				if (user.role !== "admin" && user.role !== "super_admin" && user.role !== "staff") {
					query.customerId = user.id;
				}

				if (bookingId) query.bookingId = bookingId;
				if (status) query.status = status;

				const payments = await ctx.call(
					"payment.model.find",
					{
						query,
						sort: "-createdAt",
						offset: (page - 1) * pageSize,
						limit: pageSize,
					},
					{ meta: ctx.meta }
				);

				return { payments, page, pageSize };
			},
		},

		/**
		 * Get a payment by its transaction reference (internal use).
		 */
		getPaymentByRef: {
			auth: undefined,
			params: {
				reference: "string",
			},
			async handler(ctx) {
				const { reference } = ctx.params;

				const payments = await ctx.call(
					"payment.model.find",
					{ query: { transactionRef: reference } },
					{ meta: ctx.meta }
				);

				const payment = payments && payments.length > 0 ? payments[0] : null;

				if (!payment) {
					throw new MoleculerClientError(
						"Payment not found.",
						404,
						ERROR_CODES.PAYMENT_NOT_FOUND,
						{ reference }
					);
				}

				return payment;
			},
		},

		/**
		 * Handle Paystack webhook events.
		 * Validates HMAC-SHA512 signature and processes events.
		 */
		webhookHandler: {
			auth: undefined,
			params: {
				event: "string",
				data: "object",
			},
			async handler(ctx) {
				const { event, data } = ctx.params;

				// Validate webhook signature if present
				const signature = ctx.meta.headers && ctx.meta.headers["x-paystack-signature"];
				if (signature) {
					const rawBody = ctx.meta.rawBody || JSON.stringify(ctx.params);
					const valid = this.validateWebhookSignature(rawBody, signature);
					if (!valid) {
						throw new MoleculerClientError(
							"Invalid webhook signature.",
							401,
							ERROR_CODES.UNAUTHORIZED
						);
					}
				}

				if (event === "charge.success") {
					const reference = data.reference;
					if (reference) {
						await ctx.call("payment.verifyPayment", { reference });
					}
				} else if (event === "refund.processed") {
					const reference = data.transaction_reference;
					if (reference) {
						const payments = await ctx.call(
							"payment.model.find",
							{ query: { transactionRef: reference } },
							{ meta: ctx.meta }
						);

						if (payments && payments.length > 0) {
							const payment = payments[0];
							const paymentId = payment._id?.toString ? payment._id.toString() : payment._id;

							if (data.status === "processed") {
								await ctx.call(
									"payment.model.update",
									{
										id: paymentId,
										metadata: data,
									},
									{ meta: ctx.meta }
								);
							}
						}
					}
				}

				return { received: true };
			},
		},

		/**
		 * Reconcile stale payments (admin only).
		 * Checks pending/processing payments older than 1 hour against Paystack.
		 */
		reconcile: {
			auth: "required",
			role: "admin",
			async handler(ctx) {
				const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

				const stalePayments = await ctx.call(
					"payment.model.find",
					{
						query: {
							status: { $in: [PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.PROCESSING] },
							createdAt: { $lt: oneHourAgo.toISOString() },
						},
					},
					{ meta: ctx.meta }
				);

				let checked = 0;
				let updated = 0;
				let failed = 0;

				for (const payment of stalePayments) {
					checked++;
					try {
						const paystackData = await this.verifyTransaction(payment.transactionRef);
						const paymentId = payment._id?.toString ? payment._id.toString() : payment._id;

						if (paystackData.status === "success") {
							await ctx.call(
								"payment.model.update",
								{
									id: paymentId,
									status: PAYMENT_STATUSES.SUCCESS,
									paidAt: paystackData.paid_at || new Date().toISOString(),
									metadata: paystackData,
								},
								{ meta: ctx.meta }
							);
							updated++;
						} else if (paystackData.status === "failed" || paystackData.status === "abandoned") {
							await ctx.call(
								"payment.model.update",
								{
									id: paymentId,
									status: PAYMENT_STATUSES.FAILED,
									metadata: paystackData,
								},
								{ meta: ctx.meta }
							);
							updated++;
						}
					} catch (err) {
						this.logger.error(`Reconcile failed for payment ${payment.transactionRef}:`, err.message);
						failed++;
					}
				}

				return { checked, updated, failed };
			},
		},

		/**
		 * Get payment analytics with date range filtering.
		 * Returns transaction counts, revenue, refunds, and adherence metrics.
		 */
		getPaymentAnalytics: {
			auth: "required",
			role: "admin",
			params: {
				startDate: { type: "string", optional: true },
				endDate: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { startDate, endDate } = ctx.params;

				const query = {};
				if (startDate || endDate) {
					query.createdAt = {};
					if (startDate) query.createdAt.$gte = new Date(startDate).toISOString();
					if (endDate) query.createdAt.$lte = new Date(endDate).toISOString();
				}

				const allPayments = await ctx.call(
					"payment.model.find",
					{ query },
					{ meta: ctx.meta }
				);

				// By status
				const paymentsByStatus = {};
				for (const status of Object.values(PAYMENT_STATUSES)) {
					paymentsByStatus[status] = 0;
				}

				// By type
				const paymentsByType = {
					commitment_fee: 0,
					milestone: 0,
					full_payment: 0,
				};

				let totalRevenue = 0;
				let totalRefunds = 0;
				let successfulCount = 0;

				for (const payment of allPayments) {
					// By status
					if (paymentsByStatus[payment.status] !== undefined) {
						paymentsByStatus[payment.status]++;
					}

					// By type (exclude refund records from type counts)
					if (payment.paymentType !== "refund" && paymentsByType[payment.paymentType] !== undefined) {
						paymentsByType[payment.paymentType]++;
					}

					// Revenue from successful non-refund payments
					if (payment.status === PAYMENT_STATUSES.SUCCESS && payment.paymentType !== "refund") {
						totalRevenue += payment.amount || 0;
						successfulCount++;
					}

					// Refund totals
					if (payment.paymentType === "refund" && payment.status === PAYMENT_STATUSES.SUCCESS) {
						totalRefunds += Math.abs(payment.amount) || 0;
					}
				}

				const netRevenue = totalRevenue - totalRefunds;
				const totalTransactions = allPayments.filter((p) => p.paymentType !== "refund").length;
				const averageTransactionValue = successfulCount > 0
					? Math.round((totalRevenue / successfulCount) * 100) / 100
					: 0;

				// Payment plan adherence: milestones paid on time
				let totalMilestones = 0;
				let onTimeMilestones = 0;

				try {
					const allPlans = await ctx.call(
						"paymentPlan.model.find",
						{ query: {} },
						{ meta: ctx.meta }
					);

					for (const plan of allPlans) {
						if (plan.milestones && Array.isArray(plan.milestones)) {
							for (const milestone of plan.milestones) {
								if (milestone.status === "paid") {
									totalMilestones++;
									if (milestone.paidAt && milestone.dueDate) {
										if (new Date(milestone.paidAt) <= new Date(milestone.dueDate)) {
											onTimeMilestones++;
										}
									} else {
										onTimeMilestones++;
									}
								}
							}
						}
					}
				} catch (err) {
					this.logger.warn("Could not fetch payment plans for adherence calculation:", err.message);
				}

				const paymentPlanAdherence = totalMilestones > 0
					? Math.round((onTimeMilestones / totalMilestones) * 10000) / 100
					: 100;

				return {
					totalTransactions,
					totalRevenue,
					totalRefunds,
					netRevenue,
					paymentsByStatus,
					paymentsByType,
					averageTransactionValue,
					paymentPlanAdherence,
				};
			},
		},

		/**
		 * Get revenue grouped by period (daily, weekly, monthly).
		 * Returns array of { period, revenue, transactionCount }.
		 */
		getRevenueByPeriod: {
			auth: "required",
			role: "admin",
			params: {
				period: {
					type: "enum",
					values: ["daily", "weekly", "monthly"],
				},
				startDate: { type: "string", optional: true },
				endDate: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { period, startDate, endDate } = ctx.params;

				const query = {
					status: PAYMENT_STATUSES.SUCCESS,
				};

				if (startDate || endDate) {
					query.createdAt = {};
					if (startDate) query.createdAt.$gte = new Date(startDate).toISOString();
					if (endDate) query.createdAt.$lte = new Date(endDate).toISOString();
				}

				const payments = await ctx.call(
					"payment.model.find",
					{ query },
					{ meta: ctx.meta }
				);

				const buckets = {};

				for (const payment of payments) {
					if (payment.paymentType === "refund") continue;

					const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date(payment.createdAt);
					let periodKey;

					if (period === "daily") {
						periodKey = paidAt.toISOString().slice(0, 10);
					} else if (period === "weekly") {
						const dayOfWeek = paidAt.getDay();
						const weekStart = new Date(paidAt);
						weekStart.setDate(weekStart.getDate() - dayOfWeek);
						periodKey = weekStart.toISOString().slice(0, 10);
					} else {
						periodKey = paidAt.toISOString().slice(0, 7);
					}

					if (!buckets[periodKey]) {
						buckets[periodKey] = { revenue: 0, transactionCount: 0 };
					}

					buckets[periodKey].revenue += payment.amount || 0;
					buckets[periodKey].transactionCount++;
				}

				const result = Object.entries(buckets)
					.sort((a, b) => a[0].localeCompare(b[0]))
					.map(([periodKey, data]) => ({
						period: periodKey,
						revenue: Math.round(data.revenue * 100) / 100,
						transactionCount: data.transactionCount,
					}));

				return result;
			},
		},

		/**
		 * Get payment plan analytics.
		 */
		getPaymentPlanAnalytics: {
			auth: "required",
			role: "admin",
			async handler(ctx) {
				const allPlans = await ctx.call(
					"paymentPlan.model.find",
					{ query: {} },
					{ meta: ctx.meta }
				);

				const byStatus = {
					active: 0,
					completed: 0,
					defaulted: 0,
					cancelled: 0,
				};

				let totalPaidPercent = 0;
				let overdueCount = 0;
				let totalMilestones = 0;
				let onTimeMilestones = 0;

				const now = new Date();

				for (const plan of allPlans) {
					// By status
					if (byStatus[plan.status] !== undefined) {
						byStatus[plan.status]++;
					}

					// Paid percent
					if (plan.totalAmount && plan.totalAmount > 0) {
						totalPaidPercent += (plan.paidAmount || 0) / plan.totalAmount;
					}

					// Process milestones
					if (plan.milestones && Array.isArray(plan.milestones)) {
						for (const milestone of plan.milestones) {
							totalMilestones++;

							if (milestone.status === "paid") {
								// Check if paid on time
								if (milestone.paidAt && milestone.dueDate) {
									const paidDate = new Date(milestone.paidAt);
									const dueDate = new Date(milestone.dueDate);
									if (paidDate <= dueDate) {
										onTimeMilestones++;
									}
								} else {
									// Paid but no dates to compare — count as on time
									onTimeMilestones++;
								}
							} else if (milestone.status === "overdue" || (milestone.dueDate && new Date(milestone.dueDate) < now && milestone.status === "pending")) {
								overdueCount++;
							}
						}
					}
				}

				const totalPlans = allPlans.length;

				const completionRate = totalPlans > 0
					? Math.round((byStatus.completed / totalPlans) * 10000) / 100
					: 0;

				const averagePaidPercent = totalPlans > 0
					? Math.round((totalPaidPercent / totalPlans) * 10000) / 100
					: 0;

				const onTimePaymentRate = totalMilestones > 0
					? Math.round((onTimeMilestones / totalMilestones) * 10000) / 100
					: 0;

				return {
					totalPlans,
					byStatus,
					completionRate,
					averagePaidPercent,
					overdueCount,
					onTimePaymentRate,
				};
			},
		},
	},

	events: {
		"payment.verified"(payload) {
			this.logger.info("Payment verified:", payload.paymentId || payload);
		},
		"payment.failed"(payload) {
			this.logger.info("Payment failed:", payload.paymentId || payload);
		},
		"payment.refunded"(payload) {
			this.logger.info("Payment refunded:", payload.paymentId || payload);
		},
	},
};
