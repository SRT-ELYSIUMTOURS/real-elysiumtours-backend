"use strict";

const { ServiceBroker } = require("moleculer");
const AuthService = require("../../../services/auth.service");
const { ERROR_CODES } = require("../../../utils/constants");

// Mock bcrypt
jest.mock("bcrypt", () => ({
	hash: jest.fn().mockResolvedValue("$2b$12$hashedpassword"),
	compare: jest.fn().mockResolvedValue(true),
}));

// Mock jsonwebtoken
jest.mock("jsonwebtoken", () => ({
	sign: jest.fn().mockReturnValue("mock-jwt-token"),
	verify: jest.fn().mockReturnValue({ id: "user123", type: "refresh", email: "test@example.com", role: "customer" }),
}));

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ---- Test helpers ----

const mockUser = {
	_id: "user123",
	email: "test@example.com",
	password: "$2b$12$hashedpassword",
	firstName: "John",
	lastName: "Doe",
	role: "customer",
	isVerified: true,
	status: "active",
	otp: "123456",
	otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
	refreshToken: "mock-jwt-token",
};

// Model call results — keyed by action name, overridden per test
let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock user.model service with real action handlers that delegate to modelCallResults
	broker.createService({
		name: "user.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["user.model.find"] === "function"
						? modelCallResults["user.model.find"](ctx.params)
						: modelCallResults["user.model.find"] || [];
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["user.model.create"] === "function"
						? modelCallResults["user.model.create"](ctx.params)
						: modelCallResults["user.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["user.model.update"] === "function"
						? modelCallResults["user.model.update"](ctx.params)
						: modelCallResults["user.model.update"] || {};
				},
			},
			get: {
				handler(ctx) {
					return typeof modelCallResults["user.model.get"] === "function"
						? modelCallResults["user.model.get"](ctx.params)
						: modelCallResults["user.model.get"] || null;
				},
			},
		},
	});

	// Load auth service
	const authSvc = broker.createService(AuthService);

	return { broker, authSvc };
}

// ---- Tests ----

describe("Auth Service", () => {
	let broker;
	let authSvc;

	beforeAll(async () => {
		process.env.JWT_SECRET = "test-secret";
		process.env.JWT_EXPIRY = "1h";
		process.env.REFRESH_TOKEN_EXPIRY = "7d";

		({ broker, authSvc } = createBroker());
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		modelCallResults = {};
	});

	// ========== register ==========

	describe("register", () => {
		it("should create user and return userId on happy path", async () => {
			jest.spyOn(authSvc, "getUserByEmail").mockResolvedValue(null);

			modelCallResults["user.model.create"] = () => ({
				_id: "new-user-id",
				email: "new@example.com",
			});

			const result = await broker.call("auth.register", {
				email: "new@example.com",
				password: "password123",
				firstName: "Jane",
				lastName: "Doe",
			});

			expect(result.userId).toBe("new-user-id");
			expect(result.message).toContain("Registration successful");
		});

		it("should throw EMAIL_ALREADY_EXISTS (409) for duplicate email", async () => {
			jest.spyOn(authSvc, "getUserByEmail").mockResolvedValue(mockUser);

			await expect(
				broker.call("auth.register", {
					email: "test@example.com",
					password: "password123",
					firstName: "John",
					lastName: "Doe",
				})
			).rejects.toMatchObject({
				code: 409,
				type: ERROR_CODES.EMAIL_ALREADY_EXISTS,
			});
		});

		it("should throw validation error for invalid email", async () => {
			await expect(
				broker.call("auth.register", {
					email: "not-an-email",
					password: "password123",
					firstName: "John",
					lastName: "Doe",
				})
			).rejects.toThrow();
		});
	});

	// ========== verifyOTP ==========

	describe("verifyOTP", () => {
		it("should verify user and return tokens on valid OTP", async () => {
			jest.spyOn(authSvc, "getUserWithSensitiveFields").mockResolvedValue({
				...mockUser,
				isVerified: false,
			});

			modelCallResults["user.model.update"] = () => ({ ...mockUser, isVerified: true });

			const result = await broker.call("auth.verifyOTP", {
				email: "test@example.com",
				otp: "123456",
			});

			expect(result.accessToken).toBeDefined();
			expect(result.refreshToken).toBeDefined();
			expect(result.user.email).toBe("test@example.com");
		});

		it("should throw OTP_EXPIRED for expired OTP", async () => {
			jest.spyOn(authSvc, "getUserWithSensitiveFields").mockResolvedValue({
				...mockUser,
				otpExpiry: new Date(Date.now() - 60 * 1000), // 1 minute ago
			});

			await expect(
				broker.call("auth.verifyOTP", {
					email: "test@example.com",
					otp: "123456",
				})
			).rejects.toMatchObject({
				code: 400,
				type: ERROR_CODES.OTP_EXPIRED,
			});
		});

		it("should throw OTP_INVALID for wrong OTP", async () => {
			jest.spyOn(authSvc, "getUserWithSensitiveFields").mockResolvedValue(mockUser);

			await expect(
				broker.call("auth.verifyOTP", {
					email: "test@example.com",
					otp: "000000",
				})
			).rejects.toMatchObject({
				code: 400,
				type: ERROR_CODES.OTP_INVALID,
			});
		});
	});

	// ========== login ==========

	describe("login", () => {
		it("should return tokens on valid credentials", async () => {
			jest.spyOn(authSvc, "getUserWithSensitiveFields").mockResolvedValue(mockUser);
			bcrypt.compare.mockResolvedValue(true);

			modelCallResults["user.model.update"] = () => mockUser;

			const result = await broker.call("auth.login", {
				email: "test@example.com",
				password: "password123",
			});

			expect(result.accessToken).toBeDefined();
			expect(result.refreshToken).toBeDefined();
			expect(result.user.email).toBe("test@example.com");
			expect(result.user.role).toBe("customer");
		});

		it("should throw INVALID_CREDENTIALS for wrong password", async () => {
			jest.spyOn(authSvc, "getUserWithSensitiveFields").mockResolvedValue(mockUser);
			bcrypt.compare.mockResolvedValue(false);

			await expect(
				broker.call("auth.login", {
					email: "test@example.com",
					password: "wrongpassword",
				})
			).rejects.toMatchObject({
				code: 401,
				type: ERROR_CODES.INVALID_CREDENTIALS,
			});
		});

		it("should throw EMAIL_NOT_VERIFIED for unverified email", async () => {
			jest.spyOn(authSvc, "getUserWithSensitiveFields").mockResolvedValue({
				...mockUser,
				isVerified: false,
			});
			bcrypt.compare.mockResolvedValue(true);

			await expect(
				broker.call("auth.login", {
					email: "test@example.com",
					password: "password123",
				})
			).rejects.toMatchObject({
				code: 403,
				type: ERROR_CODES.EMAIL_NOT_VERIFIED,
			});
		});
	});

	// ========== refreshToken ==========

	describe("refreshToken", () => {
		it("should return new tokens for a valid refresh token", async () => {
			jwt.verify.mockReturnValue({ id: "user123", type: "refresh" });
			jest.spyOn(authSvc, "getUserWithSensitiveFields").mockResolvedValue(mockUser);

			modelCallResults["user.model.update"] = () => mockUser;

			const result = await broker.call("auth.refreshToken", {
				refreshToken: "mock-jwt-token",
			});

			expect(result.accessToken).toBeDefined();
			expect(result.refreshToken).toBeDefined();
		});

		it("should throw TOKEN_EXPIRED for expired refresh token", async () => {
			jwt.verify.mockImplementation(() => {
				const err = new Error("jwt expired");
				err.name = "TokenExpiredError";
				throw err;
			});

			await expect(
				broker.call("auth.refreshToken", {
					refreshToken: "expired-token",
				})
			).rejects.toMatchObject({
				code: 401,
				type: ERROR_CODES.TOKEN_EXPIRED,
			});
		});
	});
});
