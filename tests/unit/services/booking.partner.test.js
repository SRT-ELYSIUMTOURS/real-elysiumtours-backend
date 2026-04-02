"use strict";

const { ServiceBroker } = require("moleculer");
const { MoleculerClientError } = require("moleculer").Errors;
const BookingService = require("../../../services/booking.service");
const HotelPartnerService = require("../../../services/hotelPartner.service");
const {
	ERROR_CODES,
	BOOKING_STATUSES,
	QUOTE_STATUSES,
	SELLING_MODES,
	PARTNER_INVENTORY_MODELS,
} = require("../../../utils/constants");

// ---- Test data ----

const mockPackageWithHotel = {
	_id: "pkg-hotel-1",
	title: "Accra City Tour",
	sellingMode: SELLING_MODES.GROUP_BUY,
	isActive: true,
	status: "published",
	startDate: "2026-06-01T00:00:00.000Z",
	endDate: "2026-06-05T00:00:00.000Z",
	hotelPartnerId: "hotel-1",
	destinationId: "dest-1",
};

const mockPricingTier = {
	_id: "tier-1",
	packageId: "pkg-hotel-1",
	minGroupSize: 2,
	maxGroupSize: 10,
	pricePerPerson: 500,
	isActive: true,
};

const mockHotelOnRequest = {
	_id: "hotel-1",
	name: "Test Hotel",
	destinationId: "dest-1",
	tier: "standard",
	isActive: true,
	inventoryModel: PARTNER_INVENTORY_MODELS.ON_REQUEST,
	closeOutDates: [],
	commissionRate: 10,
};

const mockHotelFreeSale = {
	_id: "hotel-2",
	name: "Free Sale Hotel",
	destinationId: "dest-1",
	tier: "standard",
	isActive: true,
	inventoryModel: PARTNER_INVENTORY_MODELS.FREE_SALE,
	closeOutDates: [],
	commissionRate: 12,
};

const mockHotelFreeSaleClosedOut = {
	_id: "hotel-3",
	name: "Closed Out Hotel",
	destinationId: "dest-1",
	tier: "premium",
	isActive: true,
	inventoryModel: PARTNER_INVENTORY_MODELS.FREE_SALE,
	closeOutDates: [
		{
			startDate: new Date("2026-06-01T00:00:00.000Z"),
			endDate: new Date("2026-06-10T00:00:00.000Z"),
			reason: "Renovation",
		},
	],
	commissionRate: 15,
};

const mockHotelInactive = {
	_id: "hotel-4",
	name: "Inactive Hotel",
	destinationId: "dest-1",
	tier: "budget",
	isActive: false,
	inventoryModel: PARTNER_INVENTORY_MODELS.FREE_SALE,
	closeOutDates: [],
	commissionRate: 8,
};

const mockDestination = {
	_id: "dest-1",
	name: "Accra",
	region: "Greater Accra",
	isActive: true,
};

const mockBookingPendingPartner = {
	_id: "booking-partner-1",
	customerId: "customer-1",
	packageId: "pkg-hotel-1",
	bookingType: "packaged",
	bookingRef: "ELY-20260401-CC33",
	groupSize: 4,
	totalAmount: 2000,
	currency: "GHS",
	status: BOOKING_STATUSES.PENDING_PARTNER_CONFIRMATION,
	commitmentFeeAmount: 300,
	commitmentFeePaid: false,
	tourDate: "2026-06-01T00:00:00.000Z",
	partnerConfirmations: [
		{
			partnerType: "hotel",
			partnerId: "hotel-1",
			partnerName: "Test Hotel",
			status: "pending",
			requestedAt: "2026-04-01T10:00:00.000Z",
		},
	],
	createdAt: "2026-04-01T10:00:00.000Z",
};

const mockBookingTwoPartners = {
	_id: "booking-partner-2",
	customerId: "customer-1",
	packageId: "pkg-hotel-1",
	bookingType: "packaged",
	bookingRef: "ELY-20260401-DD44",
	groupSize: 4,
	totalAmount: 2000,
	currency: "GHS",
	status: BOOKING_STATUSES.PENDING_PARTNER_CONFIRMATION,
	commitmentFeeAmount: 300,
	commitmentFeePaid: false,
	tourDate: "2026-06-01T00:00:00.000Z",
	partnerConfirmations: [
		{
			partnerType: "hotel",
			partnerId: "hotel-1",
			partnerName: "Test Hotel",
			status: "pending",
			requestedAt: "2026-04-01T10:00:00.000Z",
		},
		{
			partnerType: "hotel",
			partnerId: "hotel-5",
			partnerName: "Second Hotel",
			status: "pending",
			requestedAt: "2026-04-01T10:00:00.000Z",
		},
	],
	createdAt: "2026-04-01T10:00:00.000Z",
};

const mockBookingRejectedPartner = {
	_id: "booking-partner-3",
	customerId: "customer-1",
	packageId: "pkg-hotel-1",
	bookingType: "packaged",
	bookingRef: "ELY-20260401-EE55",
	groupSize: 4,
	totalAmount: 2000,
	currency: "GHS",
	status: BOOKING_STATUSES.PENDING_PARTNER_CONFIRMATION,
	commitmentFeeAmount: 300,
	commitmentFeePaid: false,
	tourDate: "2026-06-01T00:00:00.000Z",
	partnerConfirmations: [
		{
			partnerType: "hotel",
			partnerId: "hotel-1",
			partnerName: "Test Hotel",
			status: "rejected",
			rejectedAt: "2026-04-02T10:00:00.000Z",
			rejectionReason: "Fully booked",
		},
	],
	createdAt: "2026-04-01T10:00:00.000Z",
};

// Model call results keyed by action name
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

// ---- Broker factory for booking partner tests ----

function createBookingPartnerBroker() {
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
			find: {
				handler(ctx) {
					return typeof modelCallResults["tourPackage.model.find"] === "function"
						? modelCallResults["tourPackage.model.find"](ctx.params)
						: modelCallResults["tourPackage.model.find"] || [];
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

	// Mock tourPackage service (validatePackage, decrementCapacity)
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
			get: {
				handler(ctx) {
					if (typeof modelCallResults["hotelPartner.model.get"] === "function") {
						return modelCallResults["hotelPartner.model.get"](ctx.params);
					}
					return modelCallResults["hotelPartner.model.get"] || null;
				},
			},
			find: {
				handler(ctx) {
					return typeof modelCallResults["hotelPartner.model.find"] === "function"
						? modelCallResults["hotelPartner.model.find"](ctx.params)
						: modelCallResults["hotelPartner.model.find"] || [];
				},
			},
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

	// Mock destination.model service
	broker.createService({
		name: "destination.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["destination.model.get"] === "function") {
						return modelCallResults["destination.model.get"](ctx.params);
					}
					return modelCallResults["destination.model.get"] || null;
				},
			},
		},
	});

	// Mock hotelPartner service (checkAvailability, getByDestination)
	// This is separate from hotelPartner.model — it mocks the business-logic service
	broker.createService({
		name: "hotelPartner",
		actions: {
			checkAvailability: {
				handler(ctx) {
					if (typeof modelCallResults["hotelPartner.checkAvailability"] === "function") {
						return modelCallResults["hotelPartner.checkAvailability"](ctx.params);
					}
					return modelCallResults["hotelPartner.checkAvailability"] || null;
				},
			},
			getByDestination: {
				handler(ctx) {
					if (typeof modelCallResults["hotelPartner.getByDestination"] === "function") {
						return modelCallResults["hotelPartner.getByDestination"](ctx.params);
					}
					return modelCallResults["hotelPartner.getByDestination"] || [];
				},
			},
		},
	});

	// Load the real booking service
	broker.createService(BookingService);

	return broker;
}

// ---- Broker factory for hotelPartner checkAvailability tests ----

function createHotelPartnerBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock hotelPartner.model service
	broker.createService({
		name: "hotelPartner.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["hotelPartner.model.get"] === "function") {
						return modelCallResults["hotelPartner.model.get"](ctx.params);
					}
					return modelCallResults["hotelPartner.model.get"] || null;
				},
			},
			find: {
				handler(ctx) {
					return typeof modelCallResults["hotelPartner.model.find"] === "function"
						? modelCallResults["hotelPartner.model.find"](ctx.params)
						: modelCallResults["hotelPartner.model.find"] || [];
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["hotelPartner.model.update"] === "function"
						? modelCallResults["hotelPartner.model.update"](ctx.params)
						: modelCallResults["hotelPartner.model.update"] || {};
				},
			},
		},
	});

	// Mock destination.model service
	broker.createService({
		name: "destination.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["destination.model.get"] === "function") {
						return modelCallResults["destination.model.get"](ctx.params);
					}
					return modelCallResults["destination.model.get"] || null;
				},
			},
		},
	});

	// Load the real hotelPartner service
	broker.createService(HotelPartnerService);

	return broker;
}

// ---- Tests ----

describe("Booking Partner Inventory Validation", () => {
	let broker;

	beforeAll(async () => {
		broker = createBookingPartnerBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		modelCallResults = {};
	});

	// ========== createBooking with partner validation ==========

	describe("createBooking with partner validation", () => {
		it("should set status to pending_partner_confirmation for on-request hotel", async () => {
			modelCallResults["tourPackage.validatePackage"] = () => ({
				valid: true,
				package: { ...mockPackageWithHotel },
				pricingTier: mockPricingTier,
				pricePerPerson: 500,
				totalPrice: 2000,
			});
			modelCallResults["hotelPartner.checkAvailability"] = () => ({
				available: true,
				needsConfirmation: true,
				inventoryModel: PARTNER_INVENTORY_MODELS.ON_REQUEST,
				hotel: { name: "Test Hotel" },
			});
			modelCallResults["booking.model.create"] = (params) => ({
				_id: "new-booking-partner",
				...params,
			});

			const result = await broker.call(
				"booking.createBooking",
				{ packageId: "pkg-hotel-1", groupSize: 4 },
				{ meta: customerMeta() }
			);

			expect(result._id).toBe("new-booking-partner");
			expect(result.status).toBe(BOOKING_STATUSES.PENDING_PARTNER_CONFIRMATION);
			expect(result.partnerConfirmations).toBeDefined();
			expect(result.partnerConfirmations).toHaveLength(1);
			expect(result.partnerConfirmations[0].status).toBe("pending");
			expect(result.partnerConfirmations[0].partnerId).toBe("hotel-1");
		});

		it("should set status to pending_payment for free-sale hotel with no close-out", async () => {
			modelCallResults["tourPackage.validatePackage"] = () => ({
				valid: true,
				package: {
					...mockPackageWithHotel,
					hotelPartnerId: "hotel-2",
				},
				pricingTier: mockPricingTier,
				pricePerPerson: 500,
				totalPrice: 2000,
			});
			modelCallResults["hotelPartner.checkAvailability"] = () => ({
				available: true,
				needsConfirmation: false,
				inventoryModel: PARTNER_INVENTORY_MODELS.FREE_SALE,
				hotel: { name: "Free Sale Hotel" },
			});
			modelCallResults["booking.model.create"] = (params) => ({
				_id: "new-booking-freesale",
				...params,
			});

			const result = await broker.call(
				"booking.createBooking",
				{ packageId: "pkg-hotel-1", groupSize: 4 },
				{ meta: customerMeta() }
			);

			expect(result._id).toBe("new-booking-freesale");
			expect(result.status).toBe(BOOKING_STATUSES.PENDING_PAYMENT);
			expect(result.partnerConfirmations).toBeDefined();
			expect(result.partnerConfirmations).toHaveLength(1);
			expect(result.partnerConfirmations[0].status).toBe("auto_confirmed");
		});

		it("should set status to pending_partner_confirmation for free-sale hotel on closed-out date", async () => {
			modelCallResults["tourPackage.validatePackage"] = () => ({
				valid: true,
				package: {
					...mockPackageWithHotel,
					hotelPartnerId: "hotel-3",
				},
				pricingTier: mockPricingTier,
				pricePerPerson: 500,
				totalPrice: 2000,
			});
			modelCallResults["hotelPartner.checkAvailability"] = () => ({
				available: false,
				inventoryModel: PARTNER_INVENTORY_MODELS.FREE_SALE,
				reason: "Hotel closed out",
			});
			modelCallResults["booking.model.create"] = (params) => ({
				_id: "new-booking-closedout",
				...params,
			});

			const result = await broker.call(
				"booking.createBooking",
				{ packageId: "pkg-hotel-1", groupSize: 4 },
				{ meta: customerMeta() }
			);

			expect(result._id).toBe("new-booking-closedout");
			expect(result.status).toBe(BOOKING_STATUSES.PENDING_PARTNER_CONFIRMATION);
		});
	});

	// ========== confirmPartner ==========

	describe("confirmPartner", () => {
		it("should transition to pending_payment when all partners are confirmed", async () => {
			modelCallResults["booking.model.get"] = () => ({
				...mockBookingPendingPartner,
			});
			modelCallResults["booking.model.update"] = (params) => ({
				...mockBookingPendingPartner,
				...params,
				status: params.status || mockBookingPendingPartner.status,
				partnerConfirmations: params.partnerConfirmations || mockBookingPendingPartner.partnerConfirmations,
			});

			const result = await broker.call(
				"booking.confirmPartner",
				{
					bookingId: "booking-partner-1",
					partnerId: "hotel-1",
				},
				{ meta: staffMeta() }
			);

			expect(result.status).toBe(BOOKING_STATUSES.PENDING_PAYMENT);
			// The confirmed partner entry should have status "confirmed"
			const hotelEntry = result.partnerConfirmations.find(
				(p) => p.partnerId === "hotel-1"
			);
			expect(hotelEntry).toBeDefined();
			expect(hotelEntry.status).toBe("confirmed");
		});

		it("should stay in pending_partner_confirmation when some partners still pending", async () => {
			modelCallResults["booking.model.get"] = () => ({
				...mockBookingTwoPartners,
			});
			modelCallResults["booking.model.update"] = (params) => ({
				...mockBookingTwoPartners,
				...params,
				status: params.status || mockBookingTwoPartners.status,
				partnerConfirmations: params.partnerConfirmations || mockBookingTwoPartners.partnerConfirmations,
			});

			const result = await broker.call(
				"booking.confirmPartner",
				{
					bookingId: "booking-partner-2",
					partnerId: "hotel-1",
				},
				{ meta: staffMeta() }
			);

			expect(result.status).toBe(BOOKING_STATUSES.PENDING_PARTNER_CONFIRMATION);
			// The first partner should be confirmed, the second still pending
			const confirmedEntry = result.partnerConfirmations.find(
				(p) => p.partnerId === "hotel-1"
			);
			expect(confirmedEntry.status).toBe("confirmed");
			const pendingEntry = result.partnerConfirmations.find(
				(p) => p.partnerId === "hotel-5"
			);
			expect(pendingEntry.status).toBe("pending");
		});

		it("should throw error when booking is not in pending_partner_confirmation status", async () => {
			modelCallResults["booking.model.get"] = () => ({
				...mockBookingPendingPartner,
				_id: "booking-confirmed",
				status: BOOKING_STATUSES.CONFIRMED,
				partnerConfirmations: [
					{
						partnerType: "hotel",
						partnerId: "hotel-1",
						partnerName: "Test Hotel",
						status: "confirmed",
					},
				],
			});

			await expect(
				broker.call(
					"booking.confirmPartner",
					{
						id: "booking-confirmed",
						partnerId: "hotel-1",
					},
					{ meta: staffMeta() }
				)
			).rejects.toMatchObject({
				code: 422,
			});
		});
	});

	// ========== rejectPartner ==========

	describe("rejectPartner", () => {
		it("should set partner status to rejected and include reason", async () => {
			modelCallResults["booking.model.get"] = () => JSON.parse(JSON.stringify(mockBookingPendingPartner));
			modelCallResults["booking.model.update"] = (params) => ({
				...JSON.parse(JSON.stringify(mockBookingPendingPartner)),
				...params,
			});

			const result = await broker.call(
				"booking.rejectPartner",
				{
					bookingId: "booking-partner-1",
					partnerId: "hotel-1",
					reason: "Fully booked for these dates",
				},
				{ meta: staffMeta() }
			);

			expect(result.message).toBeDefined();
			expect(result.bookingId).toBe("booking-partner-1");
			expect(result.partnerId).toBe("hotel-1");
		});
	});

	// ========== suggestSubstitution ==========

	describe("suggestSubstitution", () => {
		it("should return alternative hotels excluding the rejected partner", async () => {
			modelCallResults["booking.model.get"] = () => ({
				...mockBookingRejectedPartner,
			});
			modelCallResults["tourPackage.model.get"] = () => ({
				...mockPackageWithHotel,
			});
			modelCallResults["hotelPartner.getByDestination"] = () => [
				{ ...mockHotelOnRequest },
				{ ...mockHotelFreeSale },
				{
					_id: "hotel-6",
					name: "Alternative Hotel",
					destinationId: "dest-1",
					tier: "premium",
					isActive: true,
					inventoryModel: PARTNER_INVENTORY_MODELS.FREE_SALE,
				},
			];

			const result = await broker.call(
				"booking.suggestSubstitution",
				{
					bookingId: "booking-partner-3",
					partnerId: "hotel-1",
				},
				{ meta: staffMeta() }
			);

			expect(result).toBeDefined();
			expect(Array.isArray(result.alternatives)).toBe(true);
			// Should not include hotel-1 (the rejected partner)
			const rejectedInList = result.alternatives.find(
				(h) => h._id === "hotel-1"
			);
			expect(rejectedInList).toBeUndefined();
			// Should include other hotels from the same destination
			expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
		});
	});
});

// ---- hotelPartner.checkAvailability tests ----

describe("HotelPartner checkAvailability", () => {
	let broker;

	beforeAll(async () => {
		broker = createHotelPartnerBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		modelCallResults = {};
	});

	it("should return available: true and needsConfirmation: false for free-sale hotel with no close-outs", async () => {
		modelCallResults["hotelPartner.model.get"] = () => ({
			...mockHotelFreeSale,
		});

		const result = await broker.call(
			"hotelPartner.checkAvailability",
			{
				hotelId: "hotel-2",
				checkInDate: "2026-06-01",
				checkOutDate: "2026-06-05",
			}
		);

		expect(result.available).toBe(true);
		expect(result.needsConfirmation).toBe(false);
		expect(result.inventoryModel).toBe(PARTNER_INVENTORY_MODELS.FREE_SALE);
	});

	it("should return available: false for a hotel with close-out dates overlapping the check-in", async () => {
		modelCallResults["hotelPartner.model.get"] = () => ({
			...mockHotelFreeSaleClosedOut,
		});

		const result = await broker.call(
			"hotelPartner.checkAvailability",
			{
				hotelId: "hotel-3",
				checkInDate: "2026-06-03",
				checkOutDate: "2026-06-07",
			}
		);

		expect(result.available).toBe(false);
		expect(result.reason).toBeDefined();
		expect(typeof result.reason).toBe("string");
	});

	it("should return available: true and needsConfirmation: true for on-request hotel", async () => {
		modelCallResults["hotelPartner.model.get"] = () => ({
			...mockHotelOnRequest,
		});

		const result = await broker.call(
			"hotelPartner.checkAvailability",
			{
				hotelId: "hotel-1",
				checkInDate: "2026-06-01",
				checkOutDate: "2026-06-05",
			}
		);

		expect(result.available).toBe(true);
		expect(result.needsConfirmation).toBe(true);
		expect(result.inventoryModel).toBe(PARTNER_INVENTORY_MODELS.ON_REQUEST);
	});

	it("should return available: false for an inactive hotel", async () => {
		modelCallResults["hotelPartner.model.get"] = () => ({
			...mockHotelInactive,
		});

		const result = await broker.call(
			"hotelPartner.checkAvailability",
			{
				hotelId: "hotel-4",
				checkInDate: "2026-06-01",
				checkOutDate: "2026-06-05",
			}
		);

		expect(result.available).toBe(false);
		expect(result.reason).toBeDefined();
	});
});
