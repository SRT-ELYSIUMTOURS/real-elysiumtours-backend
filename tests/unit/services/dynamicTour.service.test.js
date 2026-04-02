"use strict";

const { ServiceBroker } = require("moleculer");
const DynamicTourService = require("../../../services/dynamicTour.service");
const { ERROR_CODES, TOUR_REQUEST_STATUSES, QUOTE_STATUSES } = require("../../../utils/constants");

// ---- Test data ----

const mockUserId = "user-1";
const mockStaffUserId = "staff-1";

const mockDestination = {
	_id: "dest-1",
	name: "Cape Coast",
	isActive: true,
};

const mockDestination2 = {
	_id: "dest-2",
	name: "Kumasi",
	isActive: true,
};

const mockHotel = { _id: "hotel-1", name: "Golden Beach Hotel", destinationId: "dest-1", isActive: true };
const mockAttraction = { _id: "attr-1", name: "Cape Coast Castle", destinationId: "dest-1", isActive: true };
const mockDining = { _id: "din-1", name: "Ocean View Restaurant", destinationId: "dest-1", isActive: true };

const mockTourRequest = {
	_id: "tr-1",
	customerId: mockUserId,
	destinations: [{ destinationId: "dest-1", order: 1, nightsStay: 2 }],
	groupSize: 4,
	durationDays: 5,
	status: TOUR_REQUEST_STATUSES.DRAFT,
	referenceNumber: "DYN-20260401-AB12",
};

const mockQuote = {
	_id: "quote-1",
	tourRequestId: "tr-1",
	totalPrice: 0,
	pricePerPerson: 0,
	status: QUOTE_STATUSES.PENDING,
	slaDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
};

// Model call results -- keyed by action name
let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock destination.model service
	broker.createService({
		name: "destination.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["destination.model.find"] === "function"
						? modelCallResults["destination.model.find"](ctx.params)
						: modelCallResults["destination.model.find"] || [];
				},
			},
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

	// Mock hotelPartner.model service
	broker.createService({
		name: "hotelPartner.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["hotelPartner.model.find"] === "function"
						? modelCallResults["hotelPartner.model.find"](ctx.params)
						: modelCallResults["hotelPartner.model.find"] || [];
				},
			},
		},
	});

	// Mock attraction.model service
	broker.createService({
		name: "attraction.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["attraction.model.find"] === "function"
						? modelCallResults["attraction.model.find"](ctx.params)
						: modelCallResults["attraction.model.find"] || [];
				},
			},
		},
	});

	// Mock diningPartner.model service
	broker.createService({
		name: "diningPartner.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["diningPartner.model.find"] === "function"
						? modelCallResults["diningPartner.model.find"](ctx.params)
						: modelCallResults["diningPartner.model.find"] || [];
				},
			},
		},
	});

	// Mock vehicle.model service
	broker.createService({
		name: "vehicle.model",
		actions: {
			find: {
				handler() {
					return modelCallResults["vehicle.model.find"] || [];
				},
			},
		},
	});

	// Mock tourRequest.model service
	broker.createService({
		name: "tourRequest.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["tourRequest.model.find"] === "function"
						? modelCallResults["tourRequest.model.find"](ctx.params)
						: modelCallResults["tourRequest.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["tourRequest.model.get"] === "function") {
						return modelCallResults["tourRequest.model.get"](ctx.params);
					}
					return modelCallResults["tourRequest.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["tourRequest.model.create"] === "function"
						? modelCallResults["tourRequest.model.create"](ctx.params)
						: modelCallResults["tourRequest.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["tourRequest.model.update"] === "function"
						? modelCallResults["tourRequest.model.update"](ctx.params)
						: modelCallResults["tourRequest.model.update"] || {};
				},
			},
		},
	});

	// Mock quote.model service
	broker.createService({
		name: "quote.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["quote.model.find"] === "function"
						? modelCallResults["quote.model.find"](ctx.params)
						: modelCallResults["quote.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["quote.model.get"] === "function") {
						return modelCallResults["quote.model.get"](ctx.params);
					}
					return modelCallResults["quote.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["quote.model.create"] === "function"
						? modelCallResults["quote.model.create"](ctx.params)
						: modelCallResults["quote.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["quote.model.update"] === "function"
						? modelCallResults["quote.model.update"](ctx.params)
						: modelCallResults["quote.model.update"] || {};
				},
			},
		},
	});

	// Load the real dynamicTour service
	broker.createService(DynamicTourService);

	return broker;
}

// ---- Tests ----

describe("DynamicTour Service", () => {
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

	// ========== getDestinations ==========

	describe("getDestinations", () => {
		it("should return active destinations", async () => {
			modelCallResults["destination.model.find"] = (params) => {
				if (params.query && params.query.isActive === true) {
					return [mockDestination, mockDestination2];
				}
				return [];
			};

			const result = await broker.call("dynamicTour.getDestinations");

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
			expect(result[0].name).toBe("Cape Coast");
		});
	});

	// ========== getOptions ==========

	describe("getOptions", () => {
		it("should return hotels, attractions, dining for a destination", async () => {
			modelCallResults["hotelPartner.model.find"] = () => [mockHotel];
			modelCallResults["attraction.model.find"] = () => [mockAttraction];
			modelCallResults["diningPartner.model.find"] = () => [mockDining];

			const result = await broker.call("dynamicTour.getOptions", {
				destinationId: "dest-1",
			});

			expect(result.hotels).toBeDefined();
			expect(result.hotels.length).toBe(1);
			expect(result.attractions).toBeDefined();
			expect(result.attractions.length).toBe(1);
			expect(result.dining).toBeDefined();
			expect(result.dining.length).toBe(1);
		});
	});

	// ========== buildTourRequest ==========

	describe("buildTourRequest", () => {
		it("should create tour request with reference number", async () => {
			modelCallResults["destination.model.get"] = (params) => {
				if (params.id === "dest-1") return mockDestination;
				throw new Error("not found");
			};

			modelCallResults["tourRequest.model.create"] = (params) => ({
				_id: "tr-new",
				...params,
			});

			const result = await broker.call(
				"dynamicTour.buildTourRequest",
				{
					destinations: [{ destinationId: "dest-1", nightsStay: 3 }],
					groupSize: 4,
					durationDays: 5,
				},
				{ meta: { user: { id: mockUserId } } }
			);

			expect(result._id).toBe("tr-new");
			expect(result.customerId).toBe(mockUserId);
			expect(result.status).toBe(TOUR_REQUEST_STATUSES.DRAFT);
			expect(result.referenceNumber).toMatch(/^DYN-\d{8}-[A-F0-9]{4}$/);
			expect(result.destinations[0].order).toBe(1);
		});

		it("should throw DESTINATION_NOT_FOUND for invalid destination", async () => {
			modelCallResults["destination.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call(
					"dynamicTour.buildTourRequest",
					{
						destinations: [{ destinationId: "invalid-dest", nightsStay: 2 }],
						groupSize: 2,
						durationDays: 3,
					},
					{ meta: { user: { id: mockUserId } } }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.DESTINATION_NOT_FOUND,
			});
		});
	});

	// ========== submitForPricing ==========

	describe("submitForPricing", () => {
		it("should transition status and create quote with SLA deadline", async () => {
			modelCallResults["tourRequest.model.get"] = () => ({ ...mockTourRequest });

			modelCallResults["tourRequest.model.update"] = (params) => ({
				...mockTourRequest,
				...params,
			});

			modelCallResults["quote.model.create"] = (params) => ({
				_id: "quote-new",
				...params,
			});

			const result = await broker.call(
				"dynamicTour.submitForPricing",
				{ tourRequestId: "tr-1" },
				{ meta: { user: { id: mockUserId } } }
			);

			expect(result.tourRequest).toBeDefined();
			expect(result.tourRequest.status).toBe(TOUR_REQUEST_STATUSES.IN_QUEUE);
			expect(result.quote).toBeDefined();
			expect(result.quote.status).toBe(QUOTE_STATUSES.PENDING);
			expect(result.quote.slaDeadline).toBeDefined();
			expect(result.message).toContain("submitted");
		});

		it("should throw TOUR_REQUEST_NOT_FOUND for invalid id", async () => {
			modelCallResults["tourRequest.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call(
					"dynamicTour.submitForPricing",
					{ tourRequestId: "nonexistent" },
					{ meta: { user: { id: mockUserId } } }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.TOUR_REQUEST_NOT_FOUND,
			});
		});

		it("should throw error if request does not belong to user", async () => {
			modelCallResults["tourRequest.model.get"] = () => ({
				...mockTourRequest,
				customerId: "other-user",
			});

			await expect(
				broker.call(
					"dynamicTour.submitForPricing",
					{ tourRequestId: "tr-1" },
					{ meta: { user: { id: mockUserId } } }
				)
			).rejects.toMatchObject({
				code: 403,
				type: ERROR_CODES.FORBIDDEN,
			});
		});

		it("should throw INVALID_BOOKING_TRANSITION if status does not allow submission", async () => {
			modelCallResults["tourRequest.model.get"] = () => ({
				...mockTourRequest,
				status: TOUR_REQUEST_STATUSES.QUOTE_SENT, // not draft
			});

			await expect(
				broker.call(
					"dynamicTour.submitForPricing",
					{ tourRequestId: "tr-1" },
					{ meta: { user: { id: mockUserId } } }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.INVALID_BOOKING_TRANSITION,
			});
		});
	});

	// ========== getMyRequests ==========

	describe("getMyRequests", () => {
		it("should return requests for current user only", async () => {
			modelCallResults["tourRequest.model.find"] = (params) => {
				if (params.query && params.query.customerId === mockUserId) {
					return [mockTourRequest];
				}
				return [];
			};

			modelCallResults["quote.model.find"] = (params) => {
				if (params.query && params.query.tourRequestId === "tr-1") {
					return [mockQuote];
				}
				return [];
			};

			const result = await broker.call(
				"dynamicTour.getMyRequests",
				{},
				{ meta: { user: { id: mockUserId } } }
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(1);
			expect(result[0].tourRequest._id).toBe("tr-1");
			expect(result[0].quote).toBeDefined();
			expect(result[0].quote._id).toBe("quote-1");
		});
	});

	// ========== cancelRequest ==========

	describe("cancelRequest", () => {
		it("should cancel request and associated quote", async () => {
			modelCallResults["tourRequest.model.get"] = () => ({ ...mockTourRequest });

			modelCallResults["tourRequest.model.update"] = (params) => ({
				...mockTourRequest,
				...params,
			});

			modelCallResults["quote.model.find"] = () => [mockQuote];

			modelCallResults["quote.model.update"] = (params) => ({
				...mockQuote,
				...params,
			});

			const result = await broker.call(
				"dynamicTour.cancelRequest",
				{ id: "tr-1" },
				{ meta: { user: { id: mockUserId } } }
			);

			expect(result.status).toBe(TOUR_REQUEST_STATUSES.CANCELLED);
		});

		it("should throw error if request is already past cancellable status", async () => {
			modelCallResults["tourRequest.model.get"] = () => ({
				...mockTourRequest,
				status: TOUR_REQUEST_STATUSES.QUOTE_ACCEPTED, // terminal, not cancellable
			});

			await expect(
				broker.call(
					"dynamicTour.cancelRequest",
					{ id: "tr-1" },
					{ meta: { user: { id: mockUserId } } }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.INVALID_BOOKING_TRANSITION,
			});
		});
	});
});
