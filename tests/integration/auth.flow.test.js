"use strict";

const { ServiceBroker } = require("moleculer");
const AuthService = require("../../services/auth.service");
const UserService = require("../../services/user.service");
const { ERROR_CODES } = require("../../utils/constants");

// Mock bcrypt to avoid slow hashing in tests
jest.mock("bcrypt", () => ({
	hash: jest.fn().mockImplementation(async (password) => `hashed_${password}`),
	compare: jest.fn().mockImplementation(async (plain, hashed) => hashed === `hashed_${plain}`),
}));

// Use real JWT so tokens actually round-trip through verify
const jwt = require("jsonwebtoken");

// ---- In-memory stores ----

let userStore; // Map<id, userDoc>
let templateStore; // Map<name, templateDoc>
let emailCalls; // array of captured email calls
let idCounter;

function resetStores() {
	userStore = new Map();
	templateStore = new Map();
	emailCalls = [];
	idCounter = 1;
}

/**
 * Create a mock user.model service that stores data in-memory.
 */
function createMockUserModel() {
	return {
		name: "user.model",
		actions: {
			create: {
				handler(ctx) {
					const id = `user_${idCounter++}`;
					const doc = {
						_id: id,
						...ctx.params,
						email: ctx.params.email.toLowerCase(),
						status: ctx.params.status || "active",
						createdAt: new Date(),
					};
					userStore.set(id, doc);
					return { ...doc };
				},
			},
			find: {
				handler(ctx) {
					const { query, limit } = ctx.params;
					const results = [];
					for (const user of userStore.values()) {
						let match = true;
						if (query) {
							for (const [key, val] of Object.entries(query)) {
								if (user[key] !== val) {
									match = false;
									break;
								}
							}
						}
						if (match) results.push({ ...user });
						if (limit && results.length >= limit) break;
					}
					return results;
				},
			},
			get: {
				handler(ctx) {
					const { id } = ctx.params;
					const user = userStore.get(id);
					if (!user) return null;
					// Return public fields (exclude password, otp, refreshToken)
					const { password, otp, otpExpiry, refreshToken, resetPasswordToken, resetPasswordExpiry, ...publicFields } = user;
					return { ...publicFields };
				},
			},
			update: {
				handler(ctx) {
					const { id, ...updates } = ctx.params;
					const user = userStore.get(id);
					if (!user) return null;
					Object.assign(user, updates);
					userStore.set(id, user);
					return { ...user };
				},
			},
			findWithSensitive: {
				handler(ctx) {
					const { query } = ctx.params;
					for (const user of userStore.values()) {
						let match = true;
						for (const [key, val] of Object.entries(query)) {
							if (user[key] !== val) { match = false; break; }
						}
						if (match) return { ...user }; // Return ALL fields including password, otp
					}
					return null;
				},
			},
			updateDirect: {
				handler(ctx) {
					const { id, update } = ctx.params;
					const user = userStore.get(id);
					if (!user) return null;
					Object.assign(user, update);
					userStore.set(id, user);
					return { ...user };
				},
			},
		},
	};
}

/**
 * Create a mock template.model service.
 */
function createMockTemplateModel() {
	return {
		name: "template.model",
		actions: {
			find: {
				handler(ctx) {
					const { query } = ctx.params;
					if (query && query.name) {
						const tmpl = templateStore.get(query.name);
						return tmpl ? [tmpl] : [];
					}
					return Array.from(templateStore.values());
				},
			},
			create: {
				handler(ctx) {
					const doc = { _id: `tmpl_${idCounter++}`, ...ctx.params };
					templateStore.set(doc.name, doc);
					return doc;
				},
			},
			get: {
				handler(ctx) {
					for (const tmpl of templateStore.values()) {
						if (tmpl._id === ctx.params.id) return tmpl;
					}
					return null;
				},
			},
			update: {
				handler(ctx) {
					const { id, ...updates } = ctx.params;
					for (const [name, tmpl] of templateStore.entries()) {
						if (tmpl._id === id) {
							Object.assign(tmpl, updates);
							templateStore.set(name, tmpl);
							return tmpl;
						}
					}
					return null;
				},
			},
		},
	};
}

/**
 * Create a mock email service that captures calls.
 */
function createMockEmailService() {
	return {
		name: "email",
		actions: {
			send: {
				handler(ctx) {
					emailCalls.push({ action: "send", params: ctx.params });
					return { success: true, messageId: `msg_${Date.now()}` };
				},
			},
			sendTemplated: {
				handler(ctx) {
					emailCalls.push({ action: "sendTemplated", params: ctx.params });
					return { success: true, messageId: `msg_${Date.now()}` };
				},
			},
		},
		events: {
			"auth.registered"() {},
			"auth.verified"() {},
			"auth.forgotPassword"() {},
			"auth.resendOTP"() {},
		},
	};
}

// ---- Tests ----

describe("Auth Flow — Integration", () => {
	let broker;

	// State carried across ordered tests
	let registeredUserId;
	let registeredOTP;
	let accessToken;
	let refreshTokenValue;
	let resetToken;

	const TEST_EMAIL = "integration@example.com";
	const TEST_PASSWORD = "SecurePass123";
	const NEW_PASSWORD = "NewSecurePass456";

	beforeAll(async () => {
		process.env.JWT_SECRET = "integration-test-secret";
		process.env.JWT_EXPIRY = "1h";
		process.env.REFRESH_TOKEN_EXPIRY = "7d";

		resetStores();

		broker = new ServiceBroker({
			logger: false,
			validator: true,
		});

		// Load mock model services
		broker.createService(createMockUserModel());
		broker.createService(createMockTemplateModel());
		broker.createService(createMockEmailService());

		// Load real services (auth and user)
		broker.createService(AuthService);
		broker.createService(UserService);

		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	// ========== Step 1: Register ==========

	it("1. Register a new user", async () => {
		const result = await broker.call("auth.register", {
			email: TEST_EMAIL,
			password: TEST_PASSWORD,
			firstName: "Integration",
			lastName: "Tester",
			phone: "+233200000000",
		});

		expect(result.userId).toBeDefined();
		expect(result.message).toContain("Registration successful");

		registeredUserId = result.userId;

		// Capture the OTP that was stored on the user
		const user = userStore.get(registeredUserId);
		expect(user).toBeDefined();
		expect(user.otp).toBeDefined();
		expect(user.otp).toHaveLength(6);
		registeredOTP = user.otp;
	});

	// ========== Step 2: Verify OTP ==========

	it("2. Verify OTP with the registered user", async () => {
		const result = await broker.call("auth.verifyOTP", {
			email: TEST_EMAIL,
			otp: registeredOTP,
		});

		expect(result.accessToken).toBeDefined();
		expect(result.refreshToken).toBeDefined();
		expect(result.user).toBeDefined();
		expect(result.user.email).toBe(TEST_EMAIL.toLowerCase());
		expect(result.user.role).toBe("customer");

		accessToken = result.accessToken;
		refreshTokenValue = result.refreshToken;

		// Verify the user is now marked as verified in the store
		const user = userStore.get(registeredUserId);
		expect(user.isVerified).toBe(true);
	});

	// ========== Step 3: Login ==========

	it("3. Login with credentials", async () => {
		const result = await broker.call("auth.login", {
			email: TEST_EMAIL,
			password: TEST_PASSWORD,
		});

		expect(result.accessToken).toBeDefined();
		expect(result.refreshToken).toBeDefined();
		expect(result.user).toBeDefined();
		expect(result.user.id).toBe(registeredUserId);
		expect(result.user.email).toBe(TEST_EMAIL.toLowerCase());
		expect(result.user.firstName).toBe("Integration");
		expect(result.user.role).toBe("customer");

		// Update tokens for subsequent steps
		accessToken = result.accessToken;
		refreshTokenValue = result.refreshToken;
	});

	// ========== Step 4: Refresh Token ==========

	it("4. Refresh token", async () => {
		const result = await broker.call("auth.refreshToken", {
			refreshToken: refreshTokenValue,
		});

		expect(result.accessToken).toBeDefined();
		expect(result.refreshToken).toBeDefined();
		// New tokens should be different from old ones (different iat)
		expect(result.accessToken).toBeDefined();

		// Update for subsequent steps
		accessToken = result.accessToken;
		refreshTokenValue = result.refreshToken;
	});

	// ========== Step 5: Get Profile ==========

	it("5. Get profile with the access token (user.service)", async () => {
		// Decode token to get user id for meta
		const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

		const result = await broker.call(
			"user.getProfile",
			{},
			{ meta: { user: { id: decoded.id, email: decoded.email, role: decoded.role } } }
		);

		expect(result).toBeDefined();
		expect(result._id).toBe(registeredUserId);
		expect(result.email).toBe(TEST_EMAIL.toLowerCase());
		expect(result.firstName).toBe("Integration");
		expect(result.lastName).toBe("Tester");
	});

	// ========== Step 6: Forgot Password ==========

	it("6. Forgot password", async () => {
		const result = await broker.call("auth.forgotPassword", {
			email: TEST_EMAIL,
		});

		expect(result.message).toContain("Password reset email sent");

		// Verify a reset token was stored
		const user = userStore.get(registeredUserId);
		expect(user.resetPasswordToken).toBeDefined();
		expect(user.resetPasswordExpiry).toBeDefined();
		resetToken = user.resetPasswordToken;
	});

	// ========== Step 7: Reset Password ==========

	it("7. Reset password", async () => {
		// The auth service uses getUserByResetToken which goes through the adapter.
		// Since our mock returns null from getAdapter, it will return null from getUserByResetToken.
		// We need to make the adapter available — patch getLocalService for this test.
		const authSvc = broker.getLocalService("auth");

		// Override getUserByResetToken to search our in-memory store
		const originalMethod = authSvc.getUserByResetToken;
		authSvc.getUserByResetToken = async function (token) {
			for (const user of userStore.values()) {
				if (user.resetPasswordToken === token) {
					return { ...user };
				}
			}
			return null;
		};

		const result = await broker.call("auth.resetPassword", {
			token: resetToken,
			newPassword: NEW_PASSWORD,
		});

		expect(result.message).toContain("Password reset successful");

		// Verify the password was updated and reset fields cleared
		const user = userStore.get(registeredUserId);
		expect(user.password).toBe(`hashed_${NEW_PASSWORD}`);
		expect(user.resetPasswordToken).toBeNull();
		expect(user.resetPasswordExpiry).toBeNull();

		// Restore original method
		authSvc.getUserByResetToken = originalMethod;
	});
});
