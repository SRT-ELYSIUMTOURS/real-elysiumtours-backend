"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const crypto = require("crypto");
const https = require("https");
const AuthHelpersMixin = require("../mixins/auth/authHelpers.mixin");
const { ERROR_CODES } = require("../utils/constants");

function parseUserAgent(ua) {
	if (!ua) return "Unknown Device";
	if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
	if (/Android/i.test(ua)) return "Android Device";
	if (/Edg\//i.test(ua)) return "Edge Browser";
	if (/Chrome/i.test(ua)) return "Chrome Browser";
	if (/Firefox/i.test(ua)) return "Firefox Browser";
	if (/Safari/i.test(ua)) return "Safari Browser";
	return "Unknown Device";
}

module.exports = {
	name: "auth",
	dependencies: ["user.model", "session.model"],
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

				// Accept test OTP in non-production environments
				const isTestOtp = process.env.NODE_ENV !== "production" && otp === "123456";
				if (user.otp !== otp && !isTestOtp) {
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

				// Create session for device tracking
				let verifySessionId = null;
				try {
					const session = await ctx.call("session.model.create", {
						userId: user._id.toString(),
						deviceLabel: parseUserAgent(ctx.meta.userAgent),
						ip: ctx.meta.clientIp || null,
						lastActive: new Date(),
						isActive: true,
					});
					verifySessionId = session._id.toString();
				} catch (err) {
					this.logger.warn("Session creation failed (non-fatal):", err.message);
				}

				const accessToken = this.generateAccessToken(user, verifySessionId);
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
						twoFactorEnabled: false,
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

				// 2FA challenge — return short-lived token instead of real JWT
				if (user.twoFactorEnabled) {
					const twoFactorCode = this.generateOTP();
					const twoFactorExpiry = new Date(Date.now() + 10 * 60 * 1000);
					const hashedCode = await this.hashPassword(twoFactorCode);
					const challengeToken = this.generateChallengeToken(user._id.toString());
					await ctx.call("user.model.updateDirect", {
						id: user._id.toString(),
						update: { twoFactorCode: hashedCode, twoFactorExpiry },
					});
					ctx.emit("auth.twoFactorChallenge", { email: user.email, firstName: user.firstName, code: twoFactorCode });
					return { requires2fa: true, challengeToken, email: user.email };
				}

				// Create session for device tracking
				let sessionId = null;
				try {
					const session = await ctx.call("session.model.create", {
						userId: user._id.toString(),
						deviceLabel: parseUserAgent(ctx.meta.userAgent),
						ip: ctx.meta.clientIp || null,
						lastActive: new Date(),
						isActive: true,
					});
					sessionId = session._id.toString();
				} catch (err) {
					this.logger.warn("Session creation failed (non-fatal):", err.message);
				}

				const accessToken = this.generateAccessToken(user, sessionId);
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
						twoFactorEnabled: user.twoFactorEnabled || false,
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
		 * Get the permissions for the currently authenticated user's role.
		 * Returns the resource-level and page-level access map derived from
		 * config/permissions.config.js and the role hierarchy.
		 */
		getPermissions: {
			auth: "required",
			async handler(ctx) {
				const userRole = ctx.meta.user.role;
				const permissionsConfig = require("../config/permissions.config");

				// Role hierarchy: super_admin > admin > staff > customer
				const ROLE_LEVELS = { customer: 0, staff: 1, admin: 2, super_admin: 3 };
				const userLevel = ROLE_LEVELS[userRole] || 0;

				// Build resource access map from permissions config
				// Each permission key is like "tourPackage.create" with { roles: ["admin"] }
				// We check if the user's role level meets the minimum required role level
				const resourceAccess = {};
				const pageAccess = {};

				for (const [key, config] of Object.entries(permissionsConfig)) {
					const allowedRoles = config.roles || [];
					// Find the minimum role level required (lowest level in the allowed list)
					const minLevel = Math.min(
						...allowedRoles.map((r) => ROLE_LEVELS[r] ?? 99)
					);
					const hasAccess = userLevel >= minLevel || userRole === "super_admin";

					// Parse the key into resource.action format
					const [resource, action] = key.split(".");
					if (!action) continue;

					if (!resourceAccess[resource]) {
						resourceAccess[resource] = {};
					}
					resourceAccess[resource][action] = hasAccess;
				}

				// Page-level access derived from key permissions
				pageAccess.dashboard = userLevel >= ROLE_LEVELS.staff;
				pageAccess.pricingDesk = userLevel >= ROLE_LEVELS.staff;
				pageAccess.analytics = userLevel >= ROLE_LEVELS.admin;
				pageAccess.sla = userLevel >= ROLE_LEVELS.admin;
				pageAccess.settings = userLevel >= ROLE_LEVELS.admin;
				pageAccess.communications = userLevel >= ROLE_LEVELS.admin;
				pageAccess.organizations = userRole === "super_admin";
				pageAccess.platformHealth = userRole === "super_admin";

				return {
					role: userRole,
					roleLevel: userLevel,
					resourceAccess,
					pageAccess,
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
		 * Complete a 2FA login challenge.
		 * Verifies the OTP against the stored hashed code, then issues real tokens.
		 */
		verifyTwoFactorLogin: {
			auth: undefined,
			params: {
				challengeToken: "string",
				otp: "string|length:6",
			},
			async handler(ctx) {
				const { challengeToken, otp } = ctx.params;

				let decoded;
				try {
					decoded = this.verifyToken(challengeToken);
				} catch (err) {
					throw new MoleculerClientError(
						"Invalid or expired challenge.",
						401,
						ERROR_CODES.TOKEN_INVALID
					);
				}

				if (decoded.type !== "2fa_challenge") {
					throw new MoleculerClientError(
						"Invalid challenge token.",
						401,
						ERROR_CODES.TOKEN_INVALID
					);
				}

				const user = await this.getUserWithSensitiveFields(null, decoded.id);
				if (!user) {
					throw new MoleculerClientError("User not found.", 404, ERROR_CODES.USER_NOT_FOUND);
				}

				if (!user.twoFactorCode || !user.twoFactorExpiry) {
					throw new MoleculerClientError(
						"No pending 2FA challenge.",
						400,
						ERROR_CODES.OTP_INVALID
					);
				}

				if (new Date(user.twoFactorExpiry) < Date.now()) {
					throw new MoleculerClientError(
						"Code has expired. Please log in again.",
						400,
						ERROR_CODES.TOKEN_EXPIRED
					);
				}

				const isTestOtp = process.env.NODE_ENV !== "production" && otp === "123456";
				const isMatch = isTestOtp || await this.comparePassword(otp, user.twoFactorCode);
				if (!isMatch) {
					throw new MoleculerClientError(
						"Invalid or expired OTP.",
						400,
						ERROR_CODES.OTP_INVALID
					);
				}

				// Create session
				let sessionId = null;
				try {
					const session = await ctx.call("session.model.create", {
						userId: user._id.toString(),
						deviceLabel: parseUserAgent(ctx.meta.userAgent),
						ip: ctx.meta.clientIp || null,
						lastActive: new Date(),
						isActive: true,
					});
					sessionId = session._id.toString();
				} catch (err) {
					this.logger.warn("Session creation failed (non-fatal):", err.message);
				}

				const accessToken = this.generateAccessToken(user, sessionId);
				const refreshToken = this.generateRefreshToken(user);

				await ctx.call("user.model.updateDirect", {
					id: user._id.toString(),
					update: {
						twoFactorCode: null,
						twoFactorExpiry: null,
						lastLogin: new Date(),
						refreshToken,
					},
				});

				ctx.emit("auth.loggedIn", { userId: user._id.toString(), email: user.email });

				return {
					accessToken,
					refreshToken,
					user: {
						id: user._id.toString(),
						email: user.email,
						firstName: user.firstName,
						lastName: user.lastName,
						role: user.role,
						twoFactorEnabled: true,
					},
				};
			},
		},

		/**
		 * Initiate 2FA setup — sends OTP to the user's registered email.
		 */
		initTwoFactor: {
			auth: "required",
			async handler(ctx) {
				const user = await this.getUserWithSensitiveFields(null, ctx.meta.user.id);
				if (!user) {
					throw new MoleculerClientError("User not found.", 404, ERROR_CODES.USER_NOT_FOUND);
				}
				if (user.twoFactorEnabled) {
					throw new MoleculerClientError(
						"Two-factor authentication is already enabled.",
						400,
						ERROR_CODES.VALIDATION_ERROR
					);
				}
				const code = this.generateOTP();
				const expiry = new Date(Date.now() + 10 * 60 * 1000);
				const hashedCode = await this.hashPassword(code);
				await ctx.call("user.model.updateDirect", {
					id: ctx.meta.user.id,
					update: { twoFactorCode: hashedCode, twoFactorExpiry: expiry },
				});
				ctx.emit("auth.twoFactorInit", { email: user.email, firstName: user.firstName, code });
				return { message: "Verification code sent to your email." };
			},
		},

		/**
		 * Confirm 2FA setup — verifies OTP and enables 2FA on the account.
		 */
		confirmTwoFactor: {
			auth: "required",
			params: { otp: "string|length:6" },
			async handler(ctx) {
				const user = await this.getUserWithSensitiveFields(null, ctx.meta.user.id);
				if (!user) {
					throw new MoleculerClientError("User not found.", 404, ERROR_CODES.USER_NOT_FOUND);
				}
				if (!user.twoFactorCode || !user.twoFactorExpiry) {
					throw new MoleculerClientError(
						"No pending 2FA setup. Please start the setup again.",
						400,
						ERROR_CODES.OTP_INVALID
					);
				}
				if (new Date(user.twoFactorExpiry) < Date.now()) {
					throw new MoleculerClientError(
						"Code has expired. Please start the setup again.",
						400,
						ERROR_CODES.TOKEN_EXPIRED
					);
				}
				const isTestOtp = process.env.NODE_ENV !== "production" && ctx.params.otp === "123456";
				const isMatch = isTestOtp || await this.comparePassword(ctx.params.otp, user.twoFactorCode);
				if (!isMatch) {
					throw new MoleculerClientError("Invalid or expired OTP.", 400, ERROR_CODES.OTP_INVALID);
				}
				await ctx.call("user.model.updateDirect", {
					id: ctx.meta.user.id,
					update: { twoFactorEnabled: true, twoFactorCode: null, twoFactorExpiry: null },
				});
				return { message: "Two-factor authentication enabled." };
			},
		},

		/**
		 * Disable 2FA — requires current password verification.
		 */
		disableTwoFactor: {
			auth: "required",
			params: { password: "string" },
			async handler(ctx) {
				const user = await this.getUserWithSensitiveFields(null, ctx.meta.user.id);
				if (!user) {
					throw new MoleculerClientError("User not found.", 404, ERROR_CODES.USER_NOT_FOUND);
				}
				if (!user.twoFactorEnabled) {
					throw new MoleculerClientError(
						"Two-factor authentication is not enabled.",
						400,
						ERROR_CODES.VALIDATION_ERROR
					);
				}
				const passwordMatch = await this.comparePassword(ctx.params.password, user.password);
				if (!passwordMatch) {
					throw new MoleculerClientError(
						"Current password is incorrect.",
						401,
						ERROR_CODES.INVALID_CREDENTIALS
					);
				}
				await ctx.call("user.model.updateDirect", {
					id: ctx.meta.user.id,
					update: { twoFactorEnabled: false, twoFactorCode: null, twoFactorExpiry: null },
				});
				return { message: "Two-factor authentication disabled." };
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

		/**
		 * Google OAuth login — verifies Google ID token, upserts user, issues JWT.
		 * Frontend-initiates flow: browser gets ID token from Google, sends it here.
		 */
		googleLogin: {
			auth: undefined,
			params: {
				accessToken: "string",
			},
			async handler(ctx) {
				// Fetch the user's profile from Google's userinfo endpoint
				let googleUser;
				try {
					googleUser = await new Promise((resolve, reject) => {
						const req = https.get(
							`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(ctx.params.accessToken)}`,
							(res) => {
								let data = "";
								res.on("data", (chunk) => { data += chunk; });
								res.on("end", () => {
									const parsed = JSON.parse(data);
									if (parsed.error || !parsed.sub) reject(new Error(parsed.error_description || "Invalid token"));
									else resolve(parsed);
								});
							}
						);
						req.on("error", reject);
					});
				} catch {
					throw new MoleculerClientError(
						"Invalid Google token.",
						401,
						ERROR_CODES.INVALID_CREDENTIALS
					);
				}

				const { sub: googleId, email, given_name: firstName, family_name: lastName, picture: avatar } = googleUser;

				// Look up by googleId first, then fall back to email
				let user = await this.broker.call("user.model.findWithSensitive", { query: { googleId } });

				if (!user) {
					user = await this.broker.call("user.model.findWithSensitive", { query: { email: email.toLowerCase() } });

					if (user) {
						// Existing email account — link Google to it
						await ctx.call("user.model.updateDirect", {
							id: user._id.toString(),
							update: { googleId, authProvider: "google", isVerified: true },
						});
						user.googleId = googleId;
						user.authProvider = "google";
					} else {
						// New user — create account
						user = await ctx.call("user.model.create", {
							email: email.toLowerCase(),
							password: crypto.randomBytes(32).toString("hex"), // unusable random password
							firstName: firstName || "User",
							lastName: lastName || "",
							avatar: avatar || null,
							googleId,
							authProvider: "google",
							isVerified: true,
							status: "active",
							role: "customer",
						});
						ctx.emit("auth.googleRegistered", { email, firstName: firstName || "User" });
					}
				}

				if (user.status !== "active") {
					throw new MoleculerClientError(
						"Account is not active.",
						403,
						ERROR_CODES.ACCOUNT_INACTIVE
					);
				}

				// Create session
				let sessionId = null;
				try {
					const deviceLabel = parseUserAgent(ctx.meta.userAgent);
					const session = await ctx.call("session.model.create", {
						userId: user._id.toString(),
						deviceLabel,
						ip: ctx.meta.clientIp || null,
						lastActive: new Date(),
						isActive: true,
					});
					sessionId = session._id.toString();
				} catch (_) { /* session creation is best-effort */ }

				const accessToken = this.generateAccessToken(user, sessionId);
				const refreshToken = this.generateRefreshToken(user);

				await ctx.call("user.model.updateDirect", {
					id: user._id.toString(),
					update: { refreshToken, lastLogin: new Date() },
				});

				ctx.emit("auth.loggedIn", { userId: user._id.toString(), email: user.email });

				return {
					user: {
						id: user._id.toString(),
						email: user.email,
						firstName: user.firstName,
						lastName: user.lastName,
						avatar: user.avatar || null,
						role: user.role,
						isVerified: true,
						twoFactorEnabled: false,
						authProvider: "google",
					},
					accessToken,
					refreshToken,
				};
			},
		},

		/**
		 * Logout — clears refresh token in DB and marks session inactive.
		 */
		logout: {
			auth: "required",
			async handler(ctx) {
				await this.logout(ctx.meta.user.id, ctx.meta.user.sessionId);
				return { message: "Logged out successfully." };
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
		 * Logout — clears refresh token and marks session inactive.
		 */
		async logout(userId, sessionId) {
			await this.broker.call("user.model.updateDirect", {
				id: userId,
				update: { refreshToken: null },
			});

			if (sessionId) {
				await this.broker.call("session.model.updateDirect", {
					id: sessionId,
					update: { isActive: false },
				}).catch(() => {}); // non-fatal if session doesn't exist
			}
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
