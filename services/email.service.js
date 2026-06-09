"use strict";

const nodemailer = require("nodemailer");
const emailConfig = require("../config/email.config");

module.exports = {
	name: "email",

	dependencies: ["template.model"],

	settings: {
		smtp: emailConfig.smtp,
		sendgrid: emailConfig.sendgrid,
		from: emailConfig.from,
		fromName: emailConfig.fromName,
		useSendgridFallback: emailConfig.useSendgridFallback,
	},

	actions: {
		/**
		 * Send a raw email.
		 * Internal service-to-service — no auth required.
		 */
		send: {
			auth: undefined,
			params: {
				to: "email",
				subject: "string",
				html: "string",
				text: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { to, subject, html, text } = ctx.params;

				const mailOptions = {
					from: `"${this.settings.fromName}" <${this.settings.from}>`,
					to,
					subject,
					html,
					text: text || undefined,
				};

				const transporter = this.createTransporter();
				try {
					const info = await transporter.sendMail(mailOptions);
					transporter.close();
					this.logger.info(`Email sent to ${to} — messageId: ${info.messageId}`);
					return { success: true, messageId: info.messageId };
				} catch (err) {
					transporter.close();
					this.logger.warn(`SMTP send failed for ${to}: ${err.message}`);

					// Fallback to SendGrid if configured
					if (this.settings.useSendgridFallback) {
						this.logger.info(`Falling back to SendGrid for ${to}`);
						const messageId = await this.sendViaSendGrid(to, subject, html);
						return { success: true, messageId };
					}

					this.logger.error(`Email send failed for ${to}:`, err);
					throw err;
				}
			},
		},

		/**
		 * Send a templated email.
		 * Internal — no auth required.
		 */
		sendTemplated: {
			auth: undefined,
			params: {
				to: "email",
				templateName: "string",
				data: "object",
			},
			async handler(ctx) {
				const { to, templateName, data } = ctx.params;

				const rendered = await ctx.call("template.render", {
					templateName,
					data,
				});

				return ctx.call("email.send", {
					to,
					subject: rendered.subject,
					html: rendered.body,
				});
			},
		},

		/**
		 * Send a templated email to multiple recipients.
		 * Requires admin role.
		 */
		sendBulk: {
			auth: "required",
			role: "admin",
			params: {
				recipients: {
					type: "array",
					items: "email",
				},
				templateName: "string",
				data: "object",
			},
			async handler(ctx) {
				const { recipients, templateName, data } = ctx.params;
				const results = [];

				for (const to of recipients) {
					try {
						const result = await ctx.call("email.sendTemplated", {
							to,
							templateName,
							data,
						});
						results.push({ to, success: true, messageId: result.messageId });
					} catch (err) {
						this.logger.error(`Bulk email failed for ${to}:`, err.message);
						results.push({ to, success: false, error: err.message });
					}
				}

				return {
					total: recipients.length,
					sent: results.filter((r) => r.success).length,
					failed: results.filter((r) => !r.success).length,
					results,
				};
			},
		},
	},

	methods: {
		/**
		 * Create a nodemailer transporter from SMTP config.
		 * Called per-send to avoid stale connection issues on long-running services.
		 *
		 * @returns {Object} Nodemailer transporter
		 */
		createTransporter() {
			const port = this.settings.smtp.port;
			const useSSL = port === 465;
			return nodemailer.createTransport({
				host: this.settings.smtp.host,
				port,
				secure: useSSL,
				requireTLS: !useSSL,
				auth: this.settings.smtp.auth,
				tls: {
					rejectUnauthorized: false,
				},
				connectionTimeout: 15000,
				greetingTimeout: 15000,
				socketTimeout: 30000,
				logger: process.env.NODE_ENV !== "production",
				debug: process.env.NODE_ENV !== "production",
			});
		},

		/**
		 * Send email via SendGrid as fallback.
		 *
		 * @param {String} to - Recipient email
		 * @param {String} subject - Email subject
		 * @param {String} html - HTML body
		 * @returns {Promise<String>} Message ID
		 */
		async sendViaSendGrid(to, subject, html) {
			const sgMail = require("@sendgrid/mail");
			sgMail.setApiKey(this.settings.sendgrid.apiKey);

			const msg = {
				to,
				from: {
					email: this.settings.from,
					name: this.settings.fromName,
				},
				subject,
				html,
			};

			const [response] = await sgMail.send(msg);
			const messageId = response.headers["x-message-id"] || `sg-${Date.now()}`;
			this.logger.info(`Email sent via SendGrid to ${to} — messageId: ${messageId}`);
			return messageId;
		},
	},

	events: {
		/**
		 * When a new user registers, send OTP verification email.
		 */
		"auth.registered"(ctx) {
			const { email, otp, firstName } = ctx.params;

			this.broker
				.call("email.sendTemplated", {
					to: email,
					templateName: "otp_verification",
					data: { firstName: firstName || "there", otp, email },
				})
				.catch((err) => {
					this.logger.error(`Failed to send OTP email to ${email}:`, err.message);
				});
		},

		/**
		 * When a user requests a password reset, send the reset link.
		 */
		"auth.forgotPassword"(ctx) {
			const { email, resetToken } = ctx.params;

			const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

			this.broker
				.call("email.sendTemplated", {
					to: email,
					templateName: "password_reset",
					data: { firstName: "there", resetLink, email },
				})
				.catch((err) => {
					this.logger.error(`Failed to send password reset email to ${email}:`, err.message);
				});
		},

		/**
		 * When a 2FA login challenge is issued, send the OTP to the user's email.
		 * Uses email.send directly — no DB template lookup so the code always reaches the user.
		 */
		"auth.twoFactorChallenge"(ctx) {
			const { email, firstName, code } = ctx.params;
			const name = firstName || "there";

			this.broker
				.call("email.send", {
					to: email,
					subject: "Your Login Verification Code",
					html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2c3e50;">Login Verification</h1>
<p>Hi ${name},</p>
<p>Use the code below to complete your login. It expires in 10 minutes.</p>
<div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2c3e50; border-radius: 8px;">
  ${code}
</div>
<p>If you did not attempt to log in, your account may be at risk. Please change your password immediately.</p>
<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
				})
				.catch((err) => {
					this.logger.error(`Failed to send 2FA login code to ${email}:`, err.message);
				});
		},

		/**
		 * When a user initiates 2FA setup, send the confirmation OTP.
		 * Uses email.send directly — no DB template lookup so the code always reaches the user.
		 */
		"auth.twoFactorInit"(ctx) {
			const { email, firstName, code } = ctx.params;
			const name = firstName || "there";

			this.broker
				.call("email.send", {
					to: email,
					subject: "Enable Two-Factor Authentication",
					html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2c3e50;">Two-Factor Authentication Setup</h1>
<p>Hi ${name},</p>
<p>You requested to enable two-factor authentication. Enter the code below to confirm:</p>
<div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2c3e50; border-radius: 8px;">
  ${code}
</div>
<p>This code expires in 10 minutes. If you did not make this request, you can safely ignore this email.</p>
<p>Best regards,<br/>The Elysium Tours Team</p>
</div>`,
				})
				.catch((err) => {
					this.logger.error(`Failed to send 2FA setup code to ${email}:`, err.message);
				});
		},

		/**
		 * When a user verifies their email, send welcome email.
		 */
		"auth.verified"(ctx) {
			const { email } = ctx.params;

			this.broker
				.call("email.sendTemplated", {
					to: email,
					templateName: "welcome_email",
					data: { firstName: "there", email },
				})
				.catch((err) => {
					this.logger.error(`Failed to send welcome email to ${email}:`, err.message);
				});
		},
	},

	/**
	 * Service started lifecycle handler.
	 */
	started() {
		this.logger.info("Email service started — transporter created per send.");

		if (this.settings.useSendgridFallback) {
			this.logger.info("SendGrid fallback is enabled.");
		}
	},
};
