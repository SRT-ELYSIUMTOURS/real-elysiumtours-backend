"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const Handlebars = require("handlebars");
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "template",

	dependencies: ["template.model"],

	actions: {
		/**
		 * Create a new template.
		 * Requires admin role.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				subject: "string",
				body: "string",
				channel: { type: "string", optional: true },
				variables: { type: "array", optional: true, items: "string" },
			},
			async handler(ctx) {
				const { name, subject, body, channel, variables } = ctx.params;

				const existing = await ctx.call("template.model.find", {
					query: { name },
				});
				if (existing && existing.length > 0) {
					throw new MoleculerClientError(
						`Template "${name}" already exists.`,
						409,
						ERROR_CODES.VALIDATION_ERROR,
						{ name }
					);
				}

				return ctx.call("template.model.create", {
					name,
					subject,
					body,
					channel: channel || "email",
					variables: variables || [],
				});
			},
		},

		/**
		 * Update an existing template.
		 * Requires admin role.
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				subject: { type: "string", optional: true },
				body: { type: "string", optional: true },
				variables: { type: "array", optional: true, items: "string" },
				isActive: { type: "boolean", optional: true },
			},
			async handler(ctx) {
				const { id, ...updates } = ctx.params;

				// Remove undefined fields
				const cleanUpdates = {};
				Object.keys(updates).forEach((key) => {
					if (updates[key] !== undefined) {
						cleanUpdates[key] = updates[key];
					}
				});

				return ctx.call("template.model.update", { id, ...cleanUpdates });
			},
		},

		/**
		 * Get a template by ID.
		 * Requires staff role (admin inherits).
		 */
		get: {
			auth: "required",
			role: "staff",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const template = await ctx.call("template.model.get", { id: ctx.params.id });
				if (!template) {
					throw new MoleculerClientError(
						"Template not found.",
						404,
						ERROR_CODES.TEMPLATE_NOT_FOUND
					);
				}
				return template;
			},
		},

		/**
		 * Get a template by name.
		 * Internal — no auth required.
		 */
		getByName: {
			auth: undefined,
			params: {
				name: "string",
			},
			async handler(ctx) {
				const results = await ctx.call("template.model.find", {
					query: { name: ctx.params.name },
					limit: 1,
				});
				if (!results || results.length === 0) {
					throw new MoleculerClientError(
						"Template not found.",
						404,
						ERROR_CODES.TEMPLATE_NOT_FOUND,
						{ name: ctx.params.name }
					);
				}
				return results[0];
			},
		},

		/**
		 * List templates with optional filters.
		 * Requires admin role.
		 */
		list: {
			auth: "required",
			role: "admin",
			params: {
				channel: { type: "string", optional: true },
				isActive: { type: "boolean", optional: true },
			},
			async handler(ctx) {
				const query = {};
				if (ctx.params.channel) query.channel = ctx.params.channel;
				if (ctx.params.isActive !== undefined) query.isActive = ctx.params.isActive;

				return ctx.call("template.model.find", { query });
			},
		},

		/**
		 * Render a template with data.
		 * Internal — no auth required.
		 */
		render: {
			auth: undefined,
			params: {
				templateName: "string",
				data: "object",
			},
			async handler(ctx) {
				const { templateName, data } = ctx.params;

				const template = await ctx.call("template.getByName", { name: templateName });

				const subject = this.compileTemplate(template.subject, data);
				const body = this.compileTemplate(template.body, data);

				return {
					subject,
					body,
					channel: template.channel,
				};
			},
		},

		/**
		 * Seed default templates if they don't exist.
		 * Requires admin role.
		 */
		seedDefaults: {
			auth: "required",
			role: "admin",
			async handler(ctx) {
				const defaults = this.getDefaultTemplates();
				const results = [];

				for (const tmpl of defaults) {
					const existing = await ctx.call("template.model.find", {
						query: { name: tmpl.name },
					});

					if (existing && existing.length > 0) {
						// Update existing
						await ctx.call("template.model.update", {
							id: existing[0]._id.toString(),
							subject: tmpl.subject,
							body: tmpl.body,
							channel: tmpl.channel,
							variables: tmpl.variables,
						});
						results.push({ name: tmpl.name, action: "updated" });
					} else {
						await ctx.call("template.model.create", tmpl);
						results.push({ name: tmpl.name, action: "created" });
					}
				}

				this.logger.info(`Seeded ${results.length} default templates.`);
				return { seeded: results };
			},
		},
	},

	methods: {
		/**
		 * Compile a Handlebars template string with provided data.
		 *
		 * @param {String} templateStr - Handlebars template string
		 * @param {Object} data - Data to inject into the template
		 * @returns {String} Rendered string
		 */
		compileTemplate(templateStr, data) {
			const compiled = Handlebars.compile(templateStr);
			return compiled(data || {});
		},

		/**
		 * Returns the array of default template definitions.
		 *
		 * @returns {Array<Object>}
		 */
		getDefaultTemplates() {
			return [
				{
					name: "welcome_email",
					subject: "Welcome to Elysium Tours, {{firstName}}!",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Welcome to Elysium Tours!</h1>
	<p>Hi {{firstName}},</p>
	<p>Thank you for joining Elysium Tours. We are thrilled to have you on board!</p>
	<p>Explore our curated tour packages and start planning your next adventure across Ghana and beyond.</p>
	<p>If you have any questions, feel free to reach out to our support team.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName"],
				},
				{
					name: "otp_verification",
					subject: "Your Verification Code",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Email Verification</h1>
	<p>Hi {{firstName}},</p>
	<p>Your verification code is:</p>
	<div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2c3e50; border-radius: 8px;">
		{{otp}}
	</div>
	<p>This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "otp"],
				},
				{
					name: "booking_confirmation",
					subject: "Booking Confirmed - {{bookingRef}}",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Booking Confirmed!</h1>
	<p>Hi {{firstName}},</p>
	<p>Your booking <strong>{{bookingRef}}</strong> has been confirmed.</p>
	<p><strong>Tour:</strong> {{tourName}}</p>
	<p><strong>Date:</strong> {{tourDate}}</p>
	<p><strong>Guests:</strong> {{guestCount}}</p>
	<p>We will send you further details as your tour date approaches.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "bookingRef", "tourName", "tourDate", "guestCount"],
				},
				{
					name: "quote_sent",
					subject: "Your Tour Quote is Ready",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Your Quote is Ready</h1>
	<p>Hi {{firstName}},</p>
	<p>We have prepared a quote for your tour request.</p>
	<p><strong>Total Amount:</strong> {{totalAmount}}</p>
	<p><strong>Valid Until:</strong> {{expiryDate}}</p>
	<p>Please log in to your account to review and accept the quote.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "totalAmount", "expiryDate"],
				},
				{
					name: "quote_accepted",
					subject: "Quote Accepted - {{bookingRef}}",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Quote Accepted</h1>
	<p>Hi {{firstName}},</p>
	<p>Great news! Your quote for booking <strong>{{bookingRef}}</strong> has been accepted.</p>
	<p>Next steps: please proceed with the payment to confirm your booking.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "bookingRef"],
				},
				{
					name: "payment_reminder",
					subject: "Payment Reminder - {{bookingRef}}",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Payment Reminder</h1>
	<p>Hi {{firstName}},</p>
	<p>This is a friendly reminder that a payment is due for booking <strong>{{bookingRef}}</strong>.</p>
	<p><strong>Milestone:</strong> {{milestoneName}}</p>
	<p><strong>Amount Due:</strong> {{amountDue}}</p>
	<p><strong>Due Date:</strong> {{dueDate}}</p>
	<p>Please log in to your account to make the payment.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "bookingRef", "milestoneName", "amountDue", "dueDate"],
				},
				{
					name: "payment_received",
					subject: "Payment Received - {{amount}}",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Payment Received</h1>
	<p>Hi {{firstName}},</p>
	<p>We have received your payment of <strong>{{amount}}</strong> for booking <strong>{{bookingRef}}</strong>.</p>
	<p>Thank you for your payment. You can view the updated payment status in your account.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "amount", "bookingRef"],
				},
				{
					name: "password_reset",
					subject: "Reset Your Password",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Password Reset</h1>
	<p>Hi {{firstName}},</p>
	<p>We received a request to reset your password. Click the link below to set a new password:</p>
	<p><a href="{{resetLink}}" style="display: inline-block; padding: 12px 24px; background: #2c3e50; color: #ffffff; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
	<p>This link expires in 1 hour. If you did not request a password reset, please ignore this email.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "resetLink"],
				},
				{
					name: "contract_sent",
					subject: "Your Tour Contract",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Tour Contract</h1>
	<p>Hi {{firstName}},</p>
	<p>Your tour contract for booking <strong>{{bookingRef}}</strong> is ready for review.</p>
	<p><strong>Tour:</strong> {{tourName}}</p>
	<p><strong>Travel Date:</strong> {{tourDate}}</p>
	<p>Please log in to your account to review and accept the contract before proceeding.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "bookingRef", "tourName", "tourDate"],
				},
				{
					name: "tour_reminder",
					subject: "Tour Reminder - {{tourName}}",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Tour Reminder</h1>
	<p>Hi {{firstName}},</p>
	<p>Your tour <strong>{{tourName}}</strong> is coming up on <strong>{{tourDate}}</strong>!</p>
	<p>Please ensure you have all necessary documents and are prepared for the trip.</p>
	<p>We look forward to providing you with an unforgettable experience.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "tourName", "tourDate"],
				},
				{
					name: "two_factor_login",
					subject: "Your Login Verification Code",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Login Verification</h1>
	<p>Hi {{firstName}},</p>
	<p>Use the code below to complete your login. It expires in 10 minutes.</p>
	<div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2c3e50; border-radius: 8px;">
		{{code}}
	</div>
	<p>If you did not attempt to log in, your account may be at risk. Please change your password immediately.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "code"],
				},
				{
					name: "two_factor_setup",
					subject: "Enable Two-Factor Authentication",
					body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
	<h1 style="color: #2c3e50;">Two-Factor Authentication Setup</h1>
	<p>Hi {{firstName}},</p>
	<p>You requested to enable two-factor authentication. Enter the code below to confirm:</p>
	<div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2c3e50; border-radius: 8px;">
		{{code}}
	</div>
	<p>This code expires in 10 minutes. If you did not make this request, you can safely ignore this email.</p>
	<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
					channel: "email",
					variables: ["firstName", "code"],
				},
			];
		},
	},
};
