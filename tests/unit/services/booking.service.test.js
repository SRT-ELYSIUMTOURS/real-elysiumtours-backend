"use strict";

const { ServiceBroker } = require("moleculer");
const BookingService = require("../../../services/booking.service");
const { ERROR_CODES, BOOKING_STATUSES, QUOTE_STATUSES, SELLING_MODES } = require("../../../utils/constants");

// ---- Test data ----

const mockPackage = {
	_id: "pkg-1",
	title: "Cape Coast Adventure",
	sellingMode: SELLING_MODES.GROUP_BUY,
	isActive: true,
	status: "published",
	startDate: "2026-06-01T00:00:00.000Z",
	endDate: "2026-06-05T00:00:00.000Z",
};

const mockPricingTier = {
	_id: "tier-1",
	packageId: "pkg-1",
	minGroupSize: 2,
	maxGroupSize: 10,
	pricePerPerson: 500,
	isActive: true,
};

const mockQuote = {
	_id: "quote-1",
	tourRequestId: "tr-1",
	totalPrice: 8000,
	pricePerPerson: 2000,
	status: QUOTE_STATUSES.ACCEPTED,
};

const mockTourRequest = {
	_id: "tr-1",
	customerId: "customer-1",
	groupSize: 4,
	durationDays: 5,
	preferredStartDate: "2026-07-01T00:00:00.000Z",
	status: "quote_accepted",
};

const mockBooking = {
	_id: "booking-1",
	customerId: "customer-1",
	packageId: "pkg-1",
	bookingType: "packaged",
	bookingRef: "ELY-20260401-AB12",
	groupSize: 4,
	totalAmount: 2000,
	currency: "GHS",
	status: BOOKING_STATUSES.PENDING_PAYMENT,
	commitmentFeeAmount: 300,
	commitmentFeePaid: false,
	createdAt: "2026-04-01T10:00:00.000Z",
};

const mockConfirmedBooking = {
	...mockBooking,
	_id: "booking-2",
	status: BOOKING_STATUSES.CONFIRMED,
	confirmedAt: "2026-04-02T10:00:00.000Z",
};

// Model call results — keyed by action name
let modelCallResults = {};

function customerMeta(id = "customer-1") {
	return { user: { id, role: "customer" } };
}

function staffMeta(id = "staff-1") {
	return { user: { id, role: "staff" } };
}

function adminMeta(id = "admin-1") {
	return { user: { id, role: "admin" } };
}

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock booking.model service
	broker.createService({
		name: "booking.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.find"] === "function"
						? modelCallResults["booking.model.find"](ctx.params)
						: modelCallResults["booking.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["booking.model.get"] === "function") {
						return modelCallResults["booking.model.get"](ctx.params);
					}
					return modelCallResults["booking.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.create"] === "function"
						? modelCallResults["booking.model.create"](ctx.params)
						: modelCallResults["booking.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.update"] === "function"
						? modelCallResults["booking.model.update"](ctx.params)
						: modelCallResults["booking.model.update"] || {};
				},
			},
			count: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.count"] === "function"
						? modelCallResults["booking.model.count"](ctx.params)
						: modelCallResults["booking.model.count"] || 0;
				},
			},
		},
	});

	// Mock tourPackage.model service
	broker.createService({
		name: "tourPackage.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["tourPackage.model.get"] === "function") {
						return modelCallResults["tourPackage.model.get"](ctx.params);
					}
					return modelCallResults["tourPackage.model.get"] || null;
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["tourPackage.model.update"] === "function"
						? modelCallResults["tourPackage.model.update"](ctx.params)
						: modelCallResults["tourPackage.model.update"] || {};
				},
			},
		},
	});

	// Mock tourPackage service (for validatePackage and decrementCapacity)
	broker.createService({
		name: "tourPackage",
		actions: {
			validatePackage: {
				handler(ctx) {
					if (typeof modelCallResults["tourPackage.validatePackage"] === "function") {
						return modelCallResults["tourPackage.validatePackage"](ctx.params);
					}
					return modelCallResults["tourPackage.validatePackage"] || null;
				},
			},
			decrementCapacity: {
				handler(ctx) {
					if (typeof modelCallResults["tourPackage.decrementCapacity"] === "function") {
						return modelCallResults["tourPackage.decrementCapacity"](ctx.params);
					}
					return modelCallResults["tourPackage.decrementCapacity"] || {};
				},
			},
		},
	});

	// Mock packagePricing.model service
	broker.createService({
		name: "packagePricing.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["packagePricing.model.find"] === "function"
						? modelCallResults["packagePricing.model.find"](ctx.params)
						: modelCallResults["packagePricing.model.find"] || [];
				},
			},
		},
	});

	// Mock hotelPartner.model service
	broker.createService({
		name: "hotelPartner.model",
		actions: {
			get: { handler() { return null; } },
			find: { handler() { return []; } },
		},
	});

	// Mock hotelPartner service
	broker.createService({
		name: "hotelPartner",
		actions: {
			checkAvailability: { handler() { return { available: true, needsConfirmation: true, inventoryModel: "on_request" }; } },
			getByDestination: { handler() { return []; } },
		},
	});

	// Mock quote.model service
	broker.createService({
		name: "quote.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["quote.model.get"] === "function") {
						return modelCallResults["quote.model.get"](ctx.params);
					}
					return modelCallResults["quote.model.get"] || null;
				},
			},
		},
	});

	// Mock tourRequest.model service
	broker.createService({
		name: "tourRequest.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["tourRequest.model.get"] === "function") {
						return modelCallResults["tourRequest.model.get"](ctx.params);
					}
					return modelCallResults["tourRequest.model.get"] || null;
				},
			},
		},
	});

	// Mock tourGuide.model service (booking.service dependency)
	broker.createService({
		name: "tourGuide.model",
		actions: {
			get: { handler() { return null; } },
			find: { handler() { return []; } },
		},
	});

	// Load real booking service
	broker.createService(BookingService);

	return broker;
}

// ---- Tests ----

describe("Booking Service", () => {
	let broker;

	beforeAll(async () => {
		broker = createBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		modelCallResults = {};
	});

	// ========== createBooking (packaged) ==========

	describe("createBooking (packaged)", () => {
		it("should create a packaged booking with bookingRef, pending_payment status, and correct totalAmount", async () => {
			modelCallResults["tourPackage.validatePackage"] = () => ({
				valid: true,
				package: mockPackage,
				pricingTier: mockPricingTier,
				pricePerPerson: 500,
				totalPrice: 2000,
			});
			modelCallResults["booking.model.create"] = (params) => ({
				_id: "new-booking",
				...params,
			});

			const result = await broker.call(
				"booking.createBooking",
				{ packageId: "pkg-1", groupSize: 4 },
				{ meta: customerMeta() }
			);

			expect(result._id).toBe("new-booking");
			expect(result.bookingType).toBe("packaged");
			expect(result.status).toBe(BOOKING_STATUSES.PENDING_PAYMENT);
			expect(result.totalAmount).toBe(2000);
			expect(result.bookingRef).toMatch(/^ELY-\d{8}-[A-F0-9]{4}$/);
			expect(result.commitmentFeeAmount).toBe(300);
			expect(result.packageId).toBe("pkg-1");
			expect(result.customerId).toBe("customer-1");
		});
	});

	// ========== createBooking (dynamic) ==========

	describe("createBooking (dynamic)", () => {
		it("should create a booking from an accepted quote", async () => {
			modelCallResults["quote.model.get"] = () => ({ ...mockQuote });
			modelCallResults["tourRequest.model.get"] = () => ({ ...mockTourRequest });
			modelCallResults["booking.model.create"] = (params) => ({
				_id: "new-dynamic-booking",
				...params,
			});

			const result = await broker.call(
				"booking.createBooking",
				{ quoteId: "quote-1", groupSize: 4 },
				{ meta: customerMeta() }
			);

			expect(result._id).toBe("new-dynamic-booking");
			expect(result.bookingType).toBe("dynamic");
			expect(result.status).toBe(BOOKING_STATUSES.PENDING_PAYMENT);
			expect(result.totalAmount).toBe(8000);
			expect(result.quoteId).toBe("quote-1");
			expect(result.groupSize).toBe(4); // from tourRequest
			expect(result.commitmentFeeAmount).toBe(1200);
		});
	});

	// ========== createBooking — invalid packageId ==========

	describe("createBooking — invalid packageId", () => {
		it("should throw PACKAGE_NOT_FOUND for invalid packageId", async () => {
			modelCallResults["tourPackage.validatePackage"] = () => {
				const { MoleculerClientError } = require("moleculer").Errors;
				throw new MoleculerClientError(
					"Tour package not found.",
					404,
					ERROR_CODES.PACKAGE_NOT_FOUND,
					{ packageId: "invalid-pkg" }
				);
			};

			await expect(
				broker.call(
					"booking.createBooking",
					{ packageId: "invalid-pkg", groupSize: 4 },
					{ meta: customerMeta() }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PACKAGE_NOT_FOUND,
			});
		});
	});

	// ========== createBooking — quote not accepted ==========

	describe("createBooking — quote not accepted", () => {
		it("should throw error when quote is not accepted", async () => {
			modelCallResults["quote.model.get"] = () => ({
				...mockQuote,
				status: QUOTE_STATUSES.SENT,
			});

			await expect(
				broker.call(
					"booking.createBooking",
					{ quoteId: "quote-1", groupSize: 4 },
					{ meta: customerMeta() }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.VALIDATION_ERROR,
			});
		});
	});

	// ========== getBooking ==========

	describe("getBooking", () => {
		it("should return booking for the owner", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...mockBooking });

			const result = await broker.call(
				"booking.getBooking",
				{ id: "booking-1" },
				{ meta: customerMeta() }
			);

			expect(result._id).toBe("booking-1");
			expect(result.bookingRef).toBe("ELY-20260401-AB12");
		});

		it("should throw BOOKING_NOT_FOUND for invalid id", async () => {
			modelCallResults["booking.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call(
					"booking.getBooking",
					{ id: "invalid-id" },
					{ meta: customerMeta() }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.BOOKING_NOT_FOUND,
			});
		});

		it("should throw FORBIDDEN when customer tries to view another customer's booking", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...mockBooking });

			await expect(
				broker.call(
					"booking.getBooking",
					{ id: "booking-1" },
					{ meta: customerMeta("other-customer") }
				)
			).rejects.toMatchObject({
				code: 403,
				type: ERROR_CODES.FORBIDDEN,
			});
		});
	});

	// ========== listBookings ==========

	describe("listBookings", () => {
		it("should return only current user's bookings for customer role", async () => {
			let capturedQuery;
			modelCallResults["booking.model.count"] = () => 1;
			modelCallResults["booking.model.find"] = (params) => {
				capturedQuery = params.query;
				return [mockBooking];
			};

			const result = await broker.call(
				"booking.listBookings",
				{},
				{ meta: customerMeta() }
			);

			expect(result.bookings.length).toBe(1);
			expect(capturedQuery.customerId).toBe("customer-1");
		});
	});

	// ========== updateStatus ==========

	describe("updateStatus", () => {
		it("should update status on valid transition", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...mockBooking });
			modelCallResults["booking.model.update"] = (params) => ({
				...mockBooking,
				status: params.status,
			});

			const result = await broker.call(
				"booking.updateStatus",
				{ id: "booking-1", status: BOOKING_STATUSES.CANCELLED },
				{ meta: staffMeta() }
			);

			expect(result.status).toBe(BOOKING_STATUSES.CANCELLED);
		});

		it("should throw INVALID_BOOKING_TRANSITION for invalid transition", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...mockBooking });

			await expect(
				broker.call(
					"booking.updateStatus",
					{ id: "booking-1", status: BOOKING_STATUSES.TOUR_COMPLETED },
					{ meta: staffMeta() }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.INVALID_BOOKING_TRANSITION,
			});
		});
	});

	// ========== cancelBooking ==========

	describe("cancelBooking", () => {
		it("should cancel a pending_payment booking with reason", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...mockBooking });
			modelCallResults["booking.model.update"] = (params) => ({
				...mockBooking,
				status: params.status,
				cancellationReason: params.cancellationReason,
				cancelledAt: params.cancelledAt,
			});

			const result = await broker.call(
				"booking.cancelBooking",
				{ id: "booking-1", reason: "Changed plans" },
				{ meta: customerMeta() }
			);

			expect(result.status).toBe(BOOKING_STATUSES.CANCELLED);
			expect(result.cancellationReason).toBe("Changed plans");
			expect(result.cancelledAt).toBeDefined();
		});

		it("should throw error when booking cannot be cancelled", async () => {
			// tour_scheduled cannot be cancelled
			modelCallResults["booking.model.get"] = () => ({
				...mockBooking,
				status: BOOKING_STATUSES.TOUR_SCHEDULED,
				customerId: "customer-1",
			});

			await expect(
				broker.call(
					"booking.cancelBooking",
					{ id: "booking-1" },
					{ meta: customerMeta() }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.INVALID_BOOKING_TRANSITION,
			});
		});
	});
});
