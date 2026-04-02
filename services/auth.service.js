"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const crypto = require("crypto");
const AuthHelpersMixin = require("../mixins/auth/authHelpers.mixin");
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "auth",
	dependencies: ["user.model"],
	mixins: [AuthHelpersMixin],

	actions: {
		/**
		 * Register a new customer account.
		 */
		register: {
			auth: undefined,
			params: {
				email: "email",
				password: "string|min:8",
				firstName: "string",
				lastName: "string",
				phone: "string|optional",
			},
			async handler(ctx) {
				const { email, password, firstName, lastName, phone } = ctx.params;

				// Check for existing user
				const existing = await this.getUserByEmail(email);
				if (existing) {
					throw new MoleculerClientError(
						"An account with this email already exists.",
						409,
						ERROR_CODES.EMAIL_ALREADY_EXISTS
					);
				}

				// Prepare user data
				const hashedPassword = await this.hashPassword(password);
				const otp = this.generateOTP();
				const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

				const user = await ctx.call("user.model.create", {
					email,
					password: hashedPassword,
					firstName,
					lastName,
					phone: phone || undefined,
					role: "customer",
					isVerified: false,
					otp,
					otpExpiry,
				});

				// Emit event for email service to send OTP
				ctx.emit("auth.registered", {
					userId: user._id.toString(),
					email: user.email,
					otp,
				});

				return {
					message: "Registration successful. Please verify your email.",
					userId: user._id.toString(),
				};
			},
		},

		/**
		 * Verify email via 6-digit OTP.
		 */
		verifyOTP: {
			auth: undefined,
			params: {
				email: "email",
				otp: "string|length:6",
			},
			async handler(ctx) {
				const { email, otp } = ctx.params;

				const user = await this.getUserWithSensitiveFields(email);
				if (!user) {
					throw new MoleculerClientError(
						"User not found.",
						404,
						ERROR_CODES.USER_NOT_FOUND
					);
				}

				if (user.otp !== otp) {
					throw new MoleculerClientError(
						"Invalid OTP.",
						400,
						ERROR_CODES.OTP_INVALID
					);
				}

				if (this.isOTPExpired(user.otpExpiry)) {
					throw new MoleculerClientError(
						"OTP has expired. Please request a new one.",
						400,
						ERROR_CODES.OTP_EXPIRED
					);
				}

				// Mark as verified, clear OTP fields
				await ctx.call("user.model.update", {
					id: user._id.toString(),
					isVerified: true,
					otp: null,
					otpExpiry: null,
				});

				const accessToken = this.generateAccessToken(user);
				const refreshToken = this.generateRefreshToken(user);

				// Store refresh token
				await ctx.call("user.model.update", {
					id: user._id.toString(),
					refreshToken,
				});

				ctx.emit("auth.verified", {
					userId: user._id.toString(),
					email: user.email,
				});

				return {
					accessToken,
					refreshToken,
					user: {
						id: user._id.toString(),
						email: user.email,
						firstName: user.firstName,
						lastName: user.lastName,
						role: user.role,
					},
				};
			},
		},

		/**
		 * Log in with email and password.
		 */
		login: {
			auth: undefined,
			params: {
				email: "email",
				password: "string",
			},
			async handler(ctx) {
				const { email, password } = ctx.params;

				const user = await this.getUserWithSensitiveFields(email);
				if (!user) {
					throw new MoleculerClientError(
						"User not found.",
						404,
						ERROR_CODES.USER_NOT_FOUND
					);
				}

				if (user.status !== "active") {
					throw new MoleculerClientError(
						`Account is ${user.status}. Please contact support.`,
						403,
						ERROR_CODES.FORBIDDEN
					);
				}

				const passwordMatch = await this.comparePassword(password, user.password);
				if (!passwordMatch) {
					throw new MoleculerClientError(
						"Invalid credentials.",
						401,
						ERROR_CODES.INVALID_CREDENTIALS
					);
				}

				if (!user.isVerified) {
					throw new MoleculerClientError(
						"Please verify your email before logging in.",
						403,
						ERROR_CODES.EMAIL_NOT_VERIFIED
					);
				}

				const accessToken = this.generateAccessToken(user);
				const refreshToken = this.generateRefreshToken(user);

				// Update lastLogin and refreshToken
				await ctx.call("user.model.update", {
					id: user._id.toString(),
					lastLogin: new Date(),
					refreshToken,
				});

				ctx.emit("auth.loggedIn", {
					userId: user._id.toString(),
					email: user.email,
				});

				return {
					accessToken,
					refreshToken,
					user: {
						id: user._id.toString(),
						email: user.email,
						firstName: user.firstName,
						lastName: user.lastName,
						role: user.role,
					},
				};
			},
		},

		/**
		 * Refresh access token using a valid refresh token.
		 */
		refreshToken: {
			auth: undefined,
			params: {
				refreshToken: "string",
			},
			async handler(ctx) {
				const { refreshToken } = ctx.params;

				const decoded = this.verifyToken(refreshToken);

				if (decoded.type !== "refresh") {
					throw new MoleculerClientError(
						"Invalid token type.",
						401,
						ERROR_CODES.TOKEN_INVALID
					);
				}

				const user = await this.getUserWithSensitiveFields(null, decoded.id);
				if (!user) {
					throw new MoleculerClientError(
						"User not found.",
						404,
						ERROR_CODES.USER_NOT_FOUND
					);
				}

				if (user.refreshToken !== refreshToken) {
					throw new MoleculerClientError(
						"Refresh token does not match. Please log in again.",
						401,
						ERROR_CODES.TOKEN_INVALID
					);
				}

				const newAccessToken = this.generateAccessToken(user);
				const newRefreshToken = this.generateRefreshToken(user);

				await ctx.call("user.model.update", {
					id: user._id.toString(),
					refreshToken: newRefreshToken,
				});

				return {
					accessToken: newAccessToken,
					refreshToken: newRefreshToken,
				};
			},
		},

		/**
		 * Send a password-reset email with a unique token.
		 */
		forgotPassword: {
			auth: undefined,
			params: {
				email: "email",
			},
			async handler(ctx) {
				const { email } = ctx.params;

				const user = await this.getUserByEmail(email);
				if (!user) {
					throw new MoleculerClientError(
						"User not found.",
						404,
						ERROR_CODES.USER_NOT_FOUND
					);
				}

				const resetToken = crypto.randomBytes(32).toString("hex");
				const resetPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

				await ctx.call("user.model.update", {
					id: user._id.toString(),
					resetPasswordToken: resetToken,
					resetPasswordExpiry,
				});

				ctx.emit("auth.forgotPassword", {
					email: user.email,
					resetToken,
				});

				return { message: "Password reset email sent." };
			},
		},

		/**
		 * Reset password using a valid reset token.
		 */
		resetPassword: {
			auth: undefined,
			params: {
				token: "string",
				newPassword: "string|min:8",
			},
			async handler(ctx) {
				const { token, newPassword } = ctx.params;

				const user = await this.getUserByResetToken(token);
				if (!user) {
					throw new MoleculerClientError(
						"Invalid or expired reset token.",
						400,
						ERROR_CODES.TOKEN_INVALID
					);
				}

				if (new Date(user.resetPasswordExpiry) < Date.now()) {
					throw new MoleculerClientError(
						"Reset token has expired.",
						400,
						ERROR_CODES.TOKEN_EXPIRED
					);
				}

				const hashedPassword = await this.hashPassword(newPassword);

				await ctx.call("user.model.update", {
					id: user._id.toString(),
					password: hashedPassword,
					resetPasswordToken: null,
					resetPasswordExpiry: null,
					refreshToken: null,
				});

				return { message: "Password reset successful." };
			},
		},

		/**
		 * Resend a new OTP for email verification.
		 */
		resendOTP: {
			auth: undefined,
			params: {
				email: "email",
			},
			async handler(ctx) {
				const { email } = ctx.params;

				const user = await this.getUserByEmail(email);
				if (!user) {
					throw new MoleculerClientError(
						"User not found.",
						404,
						ERROR_CODES.USER_NOT_FOUND
					);
				}

				if (user.isVerified) {
					throw new MoleculerClientError(
						"Email is already verified.",
						400,
						ERROR_CODES.VALIDATION_ERROR
					);
				}

				const otp = this.generateOTP();
				const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

				await ctx.call("user.model.update", {
					id: user._id.toString(),
					otp,
					otpExpiry,
				});

				ctx.emit("auth.resendOTP", {
					userId: user._id.toString(),
					email: user.email,
					otp,
				});

				return { message: "A new OTP has been sent to your email." };
			},
		},
	},

	methods: {
		/**
		 * Find a user by email using the public fields (no password).
		 * @param {string} email
		 * @returns {Promise<Object|null>}
		 */
		async getUserByEmail(email) {
			const results = await this.broker.call("user.model.find", {
				query: { email: email.toLowerCase() },
				limit: 1,
			});
			return results && results.length > 0 ? results[0] : null;
		},

		/**
		 * Find a user including sensitive fields (password, otp, refreshToken, etc.)
		 * by querying Mongoose directly through the adapter.
		 * @param {string|null} email - Lookup by email
		 * @param {string|null} id - Lookup by _id
		 * @returns {Promise<Object|null>}
		 */
		async getUserWithSensitiveFields(email, id) {
			const query = {};
			if (email) query.email = email.toLowerCase();
			if (id) query._id = id;

			return this.broker.call("user.model.findWithSensitive", { query });
		},

		/**
		 * Find a user by their reset password token.
		 */
		async getUserByResetToken(token) {
			return this.broker.call("user.model.findWithSensitive", {
				query: { resetPasswordToken: token },
			});
		},
	},
};
