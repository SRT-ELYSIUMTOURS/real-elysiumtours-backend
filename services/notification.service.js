"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, NOTIFICATION_CHANNELS } = require("../utils/constants");

module.exports = {
	name: "notification",

	dependencies: ["notification.model", "template.model"],

	actions: {
		/**
		 * Send a notification to a single recipient.
		 * Internal service-to-service -- no auth required.
		 */
		send: {
			auth: undefined,
			params: {
				recipientId: "string",
				type: "string",
				channel: { type: "string", optional: true },
				title: "string",
				message: "string",
				data: { type: "object", optional: true },
			},
			async handler(ctx) {
				const {
					recipientId,
					type,
					channel = NOTIFICATION_CHANNELS.IN_APP,
					title,
					message,
					data,
				} = ctx.params;

				// Create the notification record with pending status
				let notification = await ctx.call("notification.model.create", {
					recipientId,
					type,
					channel,
					title,
					message,
					data: data || {},
					deliveryStatus: "pending",
				});

				try {
					switch (channel) {
					case NOTIFICATION_CHANNELS.IN_APP:
						// In-app notifications are delivered immediately
						notification = await ctx.call("notification.model.update", {
							id: notification._id.toString(),
							deliveryStatus: "delivered",
							sentAt: new Date(),
						});
						break;

					case NOTIFICATION_CHANNELS.EMAIL:
						await this.broker.call(
							"email.send",
							{
								to: data && data.email,
								subject: title,
								html: message,
							},
							{ meta: ctx.meta }
						);
						notification = await ctx.call("notification.model.update", {
							id: notification._id.toString(),
							deliveryStatus: "sent",
							sentAt: new Date(),
						});
						break;

					case NOTIFICATION_CHANNELS.SMS:
						await this.sendSMS(data && data.phone, message);
						notification = await ctx.call("notification.model.update", {
							id: notification._id.toString(),
							deliveryStatus: "sent",
							sentAt: new Date(),
						});
						break;

					case NOTIFICATION_CHANNELS.WHATSAPP:
						await this.sendWhatsApp(data && data.phone, message);
						notification = await ctx.call("notification.model.update", {
							id: notification._id.toString(),
							deliveryStatus: "sent",
							sentAt: new Date(),
						});
						break;

					default:
						notification = await ctx.call("notification.model.update", {
							id: notification._id.toString(),
							deliveryStatus: "delivered",
							sentAt: new Date(),
						});
						break;
					}
				} catch (err) {
					this.logger.error(
						`Notification delivery failed for ${recipientId} via ${channel}:`,
						err.message
					);
					notification = await ctx.call("notification.model.update", {
						id: notification._id.toString(),
						deliveryStatus: "failed",
						failureReason: err.message,
					});
				}

				return notification;
			},
		},

		/**
		 * Send a templated notification.
		 * Internal service-to-service -- no auth required.
		 */
		sendTemplated: {
			auth: undefined,
			params: {
				recipientId: "string",
				type: "string",
				channel: { type: "string", optional: true },
				templateName: "string",
				templateData: "object",
			},
			async handler(ctx) {
				const { recipientId, type, channel, templateName, templateData } =
					ctx.params;

				const rendered = await ctx.call("template.render", {
					templateName,
					data: templateData,
				});

				return ctx.call("notification.send", {
					recipientId,
					type,
					channel: channel || rendered.channel || NOTIFICATION_CHANNELS.IN_APP,
					title: rendered.subject,
					message: rendered.body,
					data: templateData,
				});
			},
		},

		/**
		 * List notifications for the current user.
		 * Requires authentication.
		 */
		listForUser: {
			auth: "required",
			params: {
				page: { type: "number", integer: true, positive: true, optional: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true },
				unreadOnly: { type: "boolean", optional: true },
			},
			async handler(ctx) {
				const userId = ctx.meta.user.id;
				const page = ctx.params.page || 1;
				const pageSize = ctx.params.pageSize || 20;
				const query = { recipientId: userId };

				if (ctx.params.unreadOnly) {
					query.isRead = false;
				}

				return ctx.call("notification.model.find", {
					query,
					sort: "-createdAt",
					limit: pageSize,
					offset: (page - 1) * pageSize,
				});
			},
		},

		/**
		 * Mark a single notification as read.
		 * Requires authentication. Validates ownership.
		 */
		markRead: {
			auth: "required",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const userId = ctx.meta.user.id;

				const notification = await ctx.call("notification.model.get", {
					id: ctx.params.id,
				});

				if (!notification) {
					throw new MoleculerClientError(
						"Notification not found.",
						404,
						ERROR_CODES.NOTIFICATION_NOT_FOUND
					);
				}

				const recipientId =
					notification.recipientId && notification.recipientId.toString
						? notification.recipientId.toString()
						: notification.recipientId;

				if (recipientId !== userId) {
					throw new MoleculerClientError(
						"You do not have access to this notification.",
						403,
						ERROR_CODES.NOTIFICATION_ACCESS_DENIED
					);
				}

				return ctx.call("notification.model.update", {
					id: ctx.params.id,
					isRead: true,
					readAt: new Date(),
				});
			},
		},

		/**
		 * Mark all unread notifications as read for the current user.
		 * Requires authentication.
		 */
		markAllRead: {
			auth: "required",
			async handler(ctx) {
				const userId = ctx.meta.user.id;

				const unread = await ctx.call("notification.model.find", {
					query: { recipientId: userId, isRead: false },
				});

				const results = [];
				for (const notif of unread) {
					const updated = await ctx.call("notification.model.update", {
						id: notif._id.toString(),
						isRead: true,
						readAt: new Date(),
					});
					results.push(updated);
				}

				return { updated: results.length };
			},
		},

		/**
		 * Get count of unread notifications for the current user.
		 * Requires authentication.
		 */
		getUnreadCount: {
			auth: "required",
			async handler(ctx) {
				const userId = ctx.meta.user.id;

				const unread = await ctx.call("notification.model.find", {
					query: { recipientId: userId, isRead: false },
				});

				return { count: unread.length };
			},
		},

		/**
		 * Send notification to multiple recipients.
		 * Requires admin role.
		 */
		bulkSend: {
			auth: "required",
			role: "admin",
			params: {
				recipientIds: { type: "array", items: "string" },
				type: "string",
				channel: { type: "string", optional: true },
				title: "string",
				message: "string",
				data: { type: "object", optional: true },
			},
			async handler(ctx) {
				const { recipientIds, type, channel, title, message, data } =
					ctx.params;

				let sent = 0;
				let failed = 0;

				for (const recipientId of recipientIds) {
					try {
						await ctx.call("notification.send", {
							recipientId,
							type,
							channel,
							title,
							message,
							data,
						});
						sent++;
					} catch (err) {
						this.logger.error(
							`bulkSend failed for recipient ${recipientId}:`,
							err.message
						);
						failed++;
					}
				}

				return { sent, failed, total: recipientIds.length };
			},
		},
	},

	methods: {
		/**
		 * Send an SMS message (stub -- real Twilio integration in Phase 4).
		 *
		 * @param {String} phone - Recipient phone number
		 * @param {String} message - Message body
		 * @returns {Promise<void>}
		 */
		async sendSMS(phone, message) {
			this.logger.info(
				`[SMS STUB] Sending SMS to ${phone}: ${message.substring(0, 80)}...`
			);
			// Twilio integration will replace this stub
		},

		/**
		 * Send a WhatsApp message (stub -- real Twilio integration later).
		 *
		 * @param {String} phone - Recipient phone number
		 * @param {String} message - Message body
		 * @returns {Promise<void>}
		 */
		async sendWhatsApp(phone, message) {
			this.logger.info(
				`[WhatsApp STUB] Sending WhatsApp to ${phone}: ${message.substring(0, 80)}...`
			);
			// Twilio integration will replace this stub
		},
	},

	events: {
		/**
		 * Booking created -- notify customer.
		 */
		"booking.created"(ctx) {
			const { customerId, bookingRef } = ctx.params;
			this.broker
				.call("notification.send", {
					recipientId: customerId,
					type: "booking_confirmation",
					channel: NOTIFICATION_CHANNELS.IN_APP,
					title: "Booking Created",
					message: `Your booking ${bookingRef} has been created successfully.`,
					data: { bookingRef },
				})
				.catch((err) =>
					this.logger.error("booking.created notification failed:", err.message)
				);
		},

		/**
		 * Booking status changed -- notify customer.
		 */
		"booking.statusChanged"(ctx) {
			const { customerId, bookingRef, status } = ctx.params;
			this.broker
				.call("notification.send", {
					recipientId: customerId,
					type: "booking_status_changed",
					channel: NOTIFICATION_CHANNELS.IN_APP,
					title: "Booking Status Updated",
					message: `Your booking ${bookingRef} status has been updated to ${status}.`,
					data: { bookingRef, status },
				})
				.catch((err) =>
					this.logger.error(
						"booking.statusChanged notification failed:",
						err.message
					)
				);
		},

		/**
		 * Booking cancelled -- notify customer.
		 */
		"booking.cancelled"(ctx) {
			const { customerId, bookingRef } = ctx.params;
			this.broker
				.call("notification.send", {
					recipientId: customerId,
					type: "booking_cancelled",
					channel: NOTIFICATION_CHANNELS.IN_APP,
					title: "Booking Cancelled",
					message: `Your booking ${bookingRef} has been cancelled.`,
					data: { bookingRef },
				})
				.catch((err) =>
					this.logger.error(
						"booking.cancelled notification failed:",
						err.message
					)
				);
		},

		/**
		 * Quote sent to customer.
		 */
		"pricingDesk.quoteSent"(ctx) {
			const { customerId, quoteId, tourRequestId } = ctx.params;
			if (!customerId) {
				this.logger.debug("pricingDesk.quoteSent: no customerId in payload, skipping notification");
				return;
			}
			this.broker
				.call("notification.send", {
					recipientId: customerId.toString(),
					type: "quote_sent",
					channel: NOTIFICATION_CHANNELS.IN_APP,
					title: "Your Quote is Ready",
					message: "Your tour quote is ready for review. Please log in to view it.",
					data: { quoteId, tourRequestId },
				})
				.catch((err) =>
					this.logger.error(
						"pricingDesk.quoteSent notification failed:",
						err.message
					)
				);
		},

		/**
		 * Quote accepted by customer -- notify staff.
		 */
		"pricingDesk.quoteAccepted"(ctx) {
			const { customerId, quoteId, tourRequestId } = ctx.params;
			// Notify the customer (confirmation), not staff — staff sees it in the queue
			if (!customerId) {
				this.logger.debug("pricingDesk.quoteAccepted: no customerId in payload, skipping notification");
				return;
			}
			this.broker
				.call("notification.send", {
					recipientId: customerId.toString(),
					type: "quote_accepted",
					channel: NOTIFICATION_CHANNELS.IN_APP,
					title: "Quote Accepted",
					message: "Your quote has been accepted. A booking will be created shortly.",
					data: { quoteId, tourRequestId },
				})
				.catch((err) =>
					this.logger.error(
						"pricingDesk.quoteAccepted notification failed:",
						err.message
					)
				);
		},

		/**
		 * Quote rejected by customer -- notify staff.
		 */
		"pricingDesk.quoteRejected"(ctx) {
			const { quoteId, tourRequestId, reason } = ctx.params;
			// No specific staffId in payload — log the rejection for now
			this.logger.info("Quote rejected:", quoteId, "Reason:", reason || "none");
			// TODO: look up assigned staff from quote and notify them
		},

		/**
		 * Contract accepted -- notify staff.
		 * Payload: { bookingId, contractId }
		 */
		"contract.accepted"(ctx) {
			const { bookingId, contractId } = ctx.params;
			this.logger.info("Contract accepted for booking:", bookingId);
			// TODO: look up booking owner/staff and notify
		},

		/**
		 * Contract sent to customer.
		 */
		"contract.sent"(ctx) {
			const { customerId, contractId, bookingId } = ctx.params;
			if (!customerId) {
				this.logger.debug("contract.sent: no customerId, skipping notification");
				return;
			}
			this.broker
				.call("notification.send", {
					recipientId: customerId.toString(),
					type: "contract_sent",
					channel: NOTIFICATION_CHANNELS.IN_APP,
					title: "Your Contract is Ready",
					message: "Your tour contract is ready for review. Please log in to view it.",
					data: { contractId, bookingId },
				})
				.catch((err) =>
					this.logger.error("contract.sent notification failed:", err.message)
				);
		},

		/**
		 * Payment milestone paid -- notify customer.
		 */
		"paymentPlan.milestonePaid"(ctx) {
			const { milestoneId, paymentPlanId, paymentId, amount } = ctx.params;
			// No customerId in payload — log the milestone payment for now
			this.logger.info(
				"Milestone paid:", milestoneId,
				"amount:", amount,
				"plan:", paymentPlanId
			);
			// TODO: look up paymentPlan → bookingId → customerId and send notification
		},

		/**
		 * Payment milestone overdue -- notify customer.
		 */
		"paymentPlan.milestoneOverdue"(ctx) {
			const { customerId, milestoneId, amount, dueDate, bookingRef } =
				ctx.params;
			this.broker
				.call("notification.send", {
					recipientId: customerId,
					type: "payment_overdue",
					channel: NOTIFICATION_CHANNELS.IN_APP,
					title: "Payment Overdue",
					message: `Your payment of ${amount} for booking ${bookingRef} was due on ${dueDate}. Please make your payment as soon as possible.`,
					data: { milestoneId, amount, dueDate, bookingRef },
				})
				.catch((err) =>
					this.logger.error(
						"paymentPlan.milestoneOverdue notification failed:",
						err.message
					)
				);
		},

		/**
		 * Payment reminder due -- notify customer.
		 */
		"paymentPlan.reminderDue"(ctx) {
			const { customerId, milestoneId, amount, dueDate, bookingRef } =
				ctx.params;
			this.broker
				.call("notification.send", {
					recipientId: customerId,
					type: "payment_reminder",
					channel: NOTIFICATION_CHANNELS.IN_APP,
					title: "Payment Reminder",
					message: `A payment of ${amount} for booking ${bookingRef} is due on ${dueDate}.`,
					data: { milestoneId, amount, dueDate, bookingRef },
				})
				.catch((err) =>
					this.logger.error(
						"paymentPlan.reminderDue notification failed:",
						err.message
					)
				);
		},

		/**
		 * Interest threshold reached -- notify admin.
		 */
		"interest.thresholdReached"(ctx) {
			const { adminId, packageId, packageName, count } = ctx.params;
			this.broker
				.call("notification.send", {
					recipientId: adminId,
					type: "interest_threshold",
					channel: NOTIFICATION_CHANNELS.IN_APP,
					title: "Interest Threshold Reached",
					message: `Package "${packageName}" has reached ${count} interested customers.`,
					data: { packageId, packageName, count },
				})
				.catch((err) =>
					this.logger.error(
						"interest.thresholdReached notification failed:",
						err.message
					)
				);
		},

		/**
		 * Dynamic tour submitted for pricing -- notify staff.
		 */
		"dynamicTour.submittedForPricing"(ctx) {
			const { tourRequestId, referenceNumber, customerId } = ctx.params;
			// No specific staffId in payload — this is a broadcast to all pricing staff.
			// For now, log the event. In production, query for staff users and notify each.
			this.logger.info(
				"New tour request for pricing:",
				tourRequestId,
				"from customer:",
				customerId
			);
			// TODO: query all staff users and send individual notifications
		},
	},
};
