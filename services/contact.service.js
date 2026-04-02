"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "contact",

	dependencies: ["subscriber.model"],

	actions: {
		/**
		 * Submit a contact form.
		 * Public endpoint — no auth required.
		 */
		submit: {
			auth: undefined,
			params: {
				firstName: "string",
				lastName: "string",
				email: "email",
				phone: { type: "string", optional: true },
				phoneCode: { type: "string", optional: true },
				subject: "string",
				message: "string",
			},
			async handler(ctx) {
				const { firstName, lastName, email, phone, phoneCode, subject, message } = ctx.params;

				const contactEmail = process.env.CONTACT_EMAIL || process.env.FROM_EMAIL || "info@elysiumtours.com";

				const phoneDisplay = phone ? `${phoneCode || ""}${phone}` : "Not provided";

				// Send email to the company
				const htmlBody = `
					<h2>New Contact Form Submission</h2>
					<p><strong>Name:</strong> ${firstName} ${lastName}</p>
					<p><strong>Email:</strong> ${email}</p>
					<p><strong>Phone:</strong> ${phoneDisplay}</p>
					<p><strong>Subject:</strong> ${subject}</p>
					<hr />
					<p><strong>Message:</strong></p>
					<p>${message}</p>
				`;

				await this.broker.call("email.send", {
					to: contactEmail,
					subject: `Contact Form: ${subject}`,
					html: htmlBody,
				}).catch((err) => {
					this.logger.error("Failed to send contact form email:", err.message);
				});

				// Send confirmation email to the submitter
				const confirmHtml = `
					<h2>Thank you for contacting us, ${firstName}!</h2>
					<p>We have received your message and will get back to you shortly.</p>
					<p><strong>Subject:</strong> ${subject}</p>
					<p>Best regards,<br/>Elysium Tours Team</p>
				`;

				await this.broker.call("email.send", {
					to: email,
					subject: "We received your message - Elysium Tours",
					html: confirmHtml,
				}).catch((err) => {
					this.logger.error("Failed to send confirmation email:", err.message);
				});

				return {
					success: true,
					message: "Your message has been sent. We'll get back to you shortly.",
				};
			},
		},

		/**
		 * Subscribe to the newsletter.
		 * Public endpoint — no auth required.
		 */
		submitNewsletter: {
			auth: undefined,
			params: {
				email: "email",
			},
			async handler(ctx) {
				const { email } = ctx.params;

				// Check if subscriber already exists
				const existing = await ctx.call("subscriber.model.find", {
					query: { email },
					limit: 1,
				});

				if (existing && existing.length > 0) {
					// If already exists and active, just return success
					if (existing[0].status === "active") {
						return {
							success: true,
							message: "You've been subscribed to our newsletter.",
						};
					}

					// If unsubscribed, re-activate
					await ctx.call("subscriber.model.update", {
						id: existing[0]._id.toString(),
						status: "active",
						subscribedAt: new Date(),
						unsubscribedAt: null,
					});

					return {
						success: true,
						message: "You've been subscribed to our newsletter.",
					};
				}

				// Create new subscriber
				const subscriberData = {
					email,
					status: "active",
					subscribedAt: new Date(),
					source: "website",
				};

				await ctx.call("subscriber.model.create", subscriberData);

				return {
					success: true,
					message: "You've been subscribed to our newsletter.",
				};
			},
		},
	},

	events: {},
};
