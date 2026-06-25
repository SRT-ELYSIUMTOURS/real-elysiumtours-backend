"use strict";

const { ServiceBroker } = require("moleculer");
const PaymentService = require("../../../services/payment.service");
const { ERROR_CODES, PAYMENT_STATUSES, BOOKING_STATUSES } = require("../../../utils/constants");

// ---- Test data ----

const mockCustomerId = "customer-1";
const mockAdminId = "admin-1";

const mockBooking = {
	_id: "booking-1",
	customerId: mockCustomerId,
	bookingType: "dynamic",
	bookingRef: "ELY-BK-001",
	groupSize: 4,
	totalAmount: 5000,
	currency: "GHS",
	status: BOOKING_STATUSES.PENDING_PAYMENT,
	commitmentFeeAmount: 1000,
	commitmentFeePaid: false,
};

const mockUser = {
	_id: mockCustomerId,
	email: "customer@test.com",
	firstName: "Test",
	lastName: "Customer",
};

const mockPayment = {
	_id: "payment-1",
	bookingId: "booking-1",
	customerId: mockCustomerId,
	amount: 1000,
	currency: "GHS",
	provider: "paystack",
	paymentType: "commitment_fee",
	transactionRef: "ELY-PAY-1234567890-ab12",
	paystackReference: "ELY-PAY-1234567890-ab12",
	accessCode: "access_code_123",
	authorizationUrl: "https://checkout.paystack.com/access_code_123",
	status: PAYMENT_STATUSES.PROCESSING,
	createdAt: new Date().toISOString(),
};

const mockSuccessfulPayment = {
	...mockPayment,
	status: PAYMENT_STATUSES.SUCCESS,
	paidAt: new Date().toISOString(),
};

const mockPaystackInitResponse = {
	authorization_url: "https://checkout.paystack.com/access_code_123",
	access_code: "access_code_123",
	reference: "ELY-PAY-1234567890-ab12",
};

const mockPaystackVerifySuccess = {
	status: "success",
	reference: "ELY-PAY-1234567890-ab12",
	amount: 100000,
	paid_at: new Date().toISOString(),
	channel: "card",
	currency: "GHS",
};

const mockPaystackVerifyFailed = {
	status: "failed",
	reference: "ELY-PAY-1234567890-ab12",
	amount: 100000,
	gateway_response: "Declined",
};

// Model call results -- keyed by action name
let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock booking.model service
	broker.createService({
		name: "booking.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["booking.model.get"] === "function") {
						return modelCallResults["booking.model.get"](ctx.params);
					}
					return modelCallResults["booking.model.get"] || null;
				},
			},
			find: {
				handler(ctx) {
					if (typeof modelCallResults["booking.model.find"] === "function") {
						return modelCallResults["booking.model.find"](ctx.params);
					}
					return modelCallResults["booking.model.find"] || [];
				},
			},
			update: {
				handler(ctx) {
					if (typeof modelCallResults["booking.model.update"] === "function") {
						return modelCallResults["booking.model.update"](ctx.params);
					}
					return modelCallResults["booking.model.update"] || {};
				},
			},
		},
	});

	// Mock payment.model service
	broker.createService({
		name: "payment.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["payment.model.get"] === "function") {
						return modelCallResults["payment.model.get"](ctx.params);
					}
					return modelCallResults["payment.model.get"] || null;
				},
			},
			find: {
				handler(ctx) {
					if (typeof modelCallResults["payment.model.find"] === "function") {
						return modelCallResults["payment.model.find"](ctx.params);
					}
					return modelCallResults["payment.model.find"] || [];
				},
			},
			create: {
				handler(ctx) {
					if (typeof modelCallResults["payment.model.create"] === "function") {
						return modelCallResults["payment.model.create"](ctx.params);
					}
					return modelCallResults["payment.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					if (typeof modelCallResults["payment.model.update"] === "function") {
						return modelCallResults["payment.model.update"](ctx.params);
					}
					return modelCallResults["payment.model.update"] || {};
				},
			},
		},
	});

	// Mock user.model service
	broker.createService({
		name: "user.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["user.model.get"] === "function") {
						return modelCallResults["user.model.get"](ctx.params);
					}
					return modelCallResults["user.model.get"] || null;
				},
			},
		},
	});

	// Mock paymentPlan.model service (needed by analytics actions)
	broker.createService({
		name: "paymentPlan.model",
		actions: {
			find: {
				handler(ctx) {
					if (typeof modelCallResults["paymentPlan.model.find"] === "function") {
						return modelCallResults["paymentPlan.model.find"](ctx.params);
					}
					return modelCallResults["paymentPlan.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					return modelCallResults["paymentPlan.model.get"] || null;
				},
			},
		},
	});

	// Mock tourPackage.model + tourGuide.model services (payment.service dependencies)
	broker.createService({
		name: "tourPackage.model",
		actions: {
			get: { handler() { return null; } },
			find: { handler() { return []; } },
			update: { handler() { return {}; } },
		},
	});

	broker.createService({
		name: "tourGuide.model",
		actions: {
			get: { handler() { return null; } },
			find: { handler() { return []; } },
		},
	});

	// Load the real payment service
	const svc = broker.createService(PaymentService);

	// Override Paystack mixin methods so no real API calls are made
	svc.initializeTransaction = jest.fn().mockResolvedValue(mockPaystackInitResponse);
	svc.verifyTransaction = jest.fn().mockResolvedValue(mockPaystackVerifySuccess);
	svc.createRefund = jest.fn().mockResolvedValue({ status: "processed", transaction: "ELY-PAY-1234567890-ab12" });
	svc.validateWebhookSignature = jest.fn().mockReturnValue(true);

	return { broker, svc };
}

// ---- Tests ----

describe("Payment Service", () => {
	let broker;
	let svc;

	beforeAll(async () => {
		const created = createBroker();
		broker = created.broker;
		svc = created.svc;
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		modelCallResults = {};
		jest.clearAllMocks();

		// Reset mocks to default happy-path values
		svc.initializeTransaction.mockResolvedValue(mockPaystackInitResponse);
		svc.verifyTransaction.mockResolvedValue(mockPaystackVerifySuccess);
		svc.createRefund.mockResolvedValue({ status: "processed", transaction: "ELY-PAY-1234567890-ab12" });
		svc.validateWebhookSignature.mockReturnValue(true);
	});

	// ========== initiatePayment ==========

	describe("initiatePayment", () => {
		it("should create payment record and return authorization URL", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...mockBooking });
			modelCallResults["user.model.get"] = () => ({ ...mockUser });
			modelCallResults["payment.model.create"] = (params) => ({
				_id: "payment-new",
				...params,
			});
			modelCallResults["payment.model.update"] = (params) => ({
				_id: params.id,
				...params,
			});
			modelCallResults["booking.model.update"] = (params) => ({
				...mockBooking,
				...params,
			});

			const result = await broker.call(
				"payment.initiatePayment",
				{ bookingId: "booking-1", paymentType: "commitment_fee" },
				{ meta: { user: { id: mockCustomerId, role: "customer" } } }
			);

			expect(result.paymentId).toBeDefined();
			expect(result.authorizationUrl).toBe(mockPaystackInitResponse.authorization_url);
			expect(result.accessCode).toBe(mockPaystackInitResponse.access_code);
			expect(result.transactionRef).toMatch(/^ELY-PAY-/);
			expect(svc.initializeTransaction).toHaveBeenCalledTimes(1);
		});

		it("should calculate commitment fee correctly", async () => {
			modelCallResults["booking.model.get"] = () => ({
				...mockBooking,
				commitmentFeeAmount: 1500,
			});
			modelCallResults["user.model.get"] = () => ({ ...mockUser });
			modelCallResults["payment.model.create"] = (params) => ({
				_id: "payment-new",
				...params,
			});
			modelCallResults["payment.model.update"] = (params) => ({
				_id: params.id,
				...params,
			});
			modelCallResults["booking.model.update"] = (params) => ({
				...mockBooking,
				...params,
			});

			await broker.call(
				"payment.initiatePayment",
				{ bookingId: "booking-1", paymentType: "commitment_fee" },
				{ meta: { user: { id: mockCustomerId, role: "customer" } } }
			);

			// Verify initializeTransaction was called with the correct amount
			expect(svc.initializeTransaction).toHaveBeenCalledWith(
				expect.objectContaining({
					amount: 1500,
				})
			);
		});

		it("should throw BOOKING_NOT_FOUND for invalid booking", async () => {
			modelCallResults["booking.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call(
					"payment.initiatePayment",
					{ bookingId: "nonexistent", paymentType: "commitment_fee" },
					{ meta: { user: { id: mockCustomerId, role: "customer" } } }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.BOOKING_NOT_FOUND,
			});
		});

		it("should throw error if booking is not in pending_payment status", async () => {
			modelCallResults["booking.model.get"] = () => ({
				...mockBooking,
				status: BOOKING_STATUSES.CONFIRMED,
			});

			await expect(
				broker.call(
					"payment.initiatePayment",
					{ bookingId: "booking-1", paymentType: "commitment_fee" },
					{ meta: { user: { id: mockCustomerId, role: "customer" } } }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.INVALID_BOOKING_TRANSITION,
			});
		});
	});

	// ========== verifyPayment ==========

	describe("verifyPayment", () => {
		it("should verify successful payment and confirm booking", async () => {
			modelCallResults["payment.model.find"] = () => [{ ...mockPayment }];
			modelCallResults["payment.model.get"] = () => ({
				...mockPayment,
				status: PAYMENT_STATUSES.SUCCESS,
				paidAt: new Date().toISOString(),
			});
			modelCallResults["payment.model.update"] = (params) => ({
				...mockPayment,
				...params,
			});
			modelCallResults["booking.model.get"] = () => ({
				...mockBooking,
				status: BOOKING_STATUSES.PAYMENT_PROCESSING,
			});
			modelCallResults["booking.model.update"] = (params) => ({
				...mockBooking,
				...params,
			});

			svc.verifyTransaction.mockResolvedValue(mockPaystackVerifySuccess);

			const result = await broker.call(
				"payment.verifyPayment",
				{ reference: mockPayment.transactionRef }
			);

			expect(result.payment).toBeDefined();
			expect(result.booking).toBeDefined();
			expect(svc.verifyTransaction).toHaveBeenCalledWith(mockPayment.transactionRef);
		});

		it("should handle failed payment and revert booking status", async () => {
			modelCallResults["payment.model.find"] = () => [{ ...mockPayment }];
			modelCallResults["payment.model.get"] = () => ({
				...mockPayment,
				status: PAYMENT_STATUSES.FAILED,
			});
			modelCallResults["payment.model.update"] = (params) => ({
				...mockPayment,
				...params,
			});
			modelCallResults["booking.model.get"] = () => ({
				...mockBooking,
				status: BOOKING_STATUSES.PAYMENT_PROCESSING,
			});
			modelCallResults["booking.model.update"] = (params) => ({
				...mockBooking,
				...params,
			});

			svc.verifyTransaction.mockResolvedValue(mockPaystackVerifyFailed);

			const result = await broker.call(
				"payment.verifyPayment",
				{ reference: mockPayment.transactionRef }
			);

			expect(result.payment).toBeDefined();
			expect(result.booking).toBeDefined();
			expect(svc.verifyTransaction).toHaveBeenCalledWith(mockPayment.transactionRef);
		});

		it("should throw PAYMENT_NOT_FOUND for unknown reference", async () => {
			modelCallResults["payment.model.find"] = () => [];

			await expect(
				broker.call(
					"payment.verifyPayment",
					{ reference: "UNKNOWN-REF" }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PAYMENT_NOT_FOUND,
			});
		});
	});

	// ========== refundPayment ==========

	describe("refundPayment", () => {
		it("should create refund record (admin only)", async () => {
			modelCallResults["payment.model.get"] = (params) => {
				if (params.id === "payment-1") {
					return { ...mockSuccessfulPayment };
				}
				return { ...mockSuccessfulPayment, status: PAYMENT_STATUSES.REFUNDED, refundedAmount: 1000 };
			};
			modelCallResults["payment.model.create"] = (params) => ({
				_id: "refund-1",
				...params,
			});
			modelCallResults["payment.model.update"] = (params) => ({
				...mockSuccessfulPayment,
				...params,
			});

			const result = await broker.call(
				"payment.refundPayment",
				{ paymentId: "payment-1", reason: "Customer requested" },
				{ meta: { user: { id: mockAdminId, role: "admin" } } }
			);

			expect(result).toBeDefined();
			expect(svc.createRefund).toHaveBeenCalledTimes(1);
			expect(svc.createRefund).toHaveBeenCalledWith(
				expect.objectContaining({
					transaction: mockSuccessfulPayment.transactionRef,
					amount: mockSuccessfulPayment.amount,
					reason: "Customer requested",
				})
			);
		});
	});

	// ========== getTransactions ==========

	describe("getTransactions", () => {
		it("should return payments for customer (scoped)", async () => {
			modelCallResults["payment.model.find"] = (params) => {
				// Verify the query is scoped to customer
				expect(params.query.customerId).toBe(mockCustomerId);
				return [{ ...mockPayment }, { ...mockSuccessfulPayment, _id: "payment-2" }];
			};

			const result = await broker.call(
				"payment.getTransactions",
				{},
				{ meta: { user: { id: mockCustomerId, role: "customer" } } }
			);

			expect(result.payments).toBeDefined();
			expect(result.payments.length).toBe(2);
			expect(result.page).toBe(1);
			expect(result.pageSize).toBe(20);
		});
	});

	// ========== webhookHandler ==========

	describe("webhookHandler", () => {
		it("should process charge.success event", async () => {
			// Set up mocks for the internal verifyPayment call
			modelCallResults["payment.model.find"] = () => [{ ...mockPayment }];
			modelCallResults["payment.model.get"] = () => ({
				...mockPayment,
				status: PAYMENT_STATUSES.SUCCESS,
			});
			modelCallResults["payment.model.update"] = (params) => ({
				...mockPayment,
				...params,
			});
			modelCallResults["booking.model.get"] = () => ({
				...mockBooking,
				status: BOOKING_STATUSES.PAYMENT_PROCESSING,
			});
			modelCallResults["booking.model.update"] = (params) => ({
				...mockBooking,
				...params,
			});

			const result = await broker.call(
				"payment.webhookHandler",
				{
					event: "charge.success",
					data: {
						reference: mockPayment.transactionRef,
						status: "success",
						amount: 100000,
					},
				},
				{ meta: { headers: {} } }
			);

			expect(result).toEqual({ received: true });
			expect(svc.verifyTransaction).toHaveBeenCalled();
		});
	});
});
