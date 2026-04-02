"use strict";

const { ServiceBroker } = require("moleculer");
const PricingDeskService = require("../../../services/pricingDesk.service");
const { ERROR_CODES } = require("../../../utils/constants");

// ---- Test data ----

const mockStaffId = "staff-1";
const mockStaffMeta = { user: { id: mockStaffId, role: "staff" } };

const mockHotel = {
	_id: "hotel-1",
	name: "Golden Beach Hotel",
	destinationId: "dest-1",
	tier: "premium",
	isActive: true,
	rateData: { standardRate: 200 },
};

const mockAttraction1 = {
	_id: "attr-1",
	name: "Cape Coast Castle",
	destinationId: "dest-1",
	entryFee: 40,
	isActive: true,
};

const mockAttraction2 = {
	_id: "attr-2",
	name: "Kakum Canopy Walk",
	destinationId: "dest-1",
	entryFee: 60,
	isActive: true,
};

const mockDiningPartner = {
	_id: "dining-1",
	name: "Coastal Kitchen",
	destinationId: "dest-1",
	menuOptions: [
		{ name: "Lunch Set", pricePerPerson: 80 },
		{ name: "Dinner Set", pricePerPerson: 120 },
	],
	isActive: true,
};

const mockTransportResult = {
	vehicle: { id: "v-1", type: "bus", capacity: 15, basePricePerDay: 300 },
	days: 5,
	groupSize: 10,
	totalCost: 1500,
};

function makeTourRequest(overrides = {}) {
	return {
		_id: "tr-1",
		customerId: "customer-1",
		groupSize: 10,
		durationDays: 5,
		destinations: [
			{
				destinationId: "dest-1",
				order: 1,
				nightsStay: 3,
				hotelPreference: "premium",
				selectedAttractions: ["attr-1", "attr-2"],
				diningPreferences: ["dining-1"],
			},
		],
		status: "assigned_to_staff",
		referenceNumber: "DYN-20260401-XY99",
		...overrides,
	};
}

// ---- Model call results store ----
let modelCallResults = {};
let transportCallResult = null;

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
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
			get: {
				handler(ctx) {
					if (typeof modelCallResults["attraction.model.get"] === "function") {
						return modelCallResults["attraction.model.get"](ctx.params);
					}
					return modelCallResults["attraction.model.get"] || null;
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
			get: {
				handler(ctx) {
					if (typeof modelCallResults["diningPartner.model.get"] === "function") {
						return modelCallResults["diningPartner.model.get"](ctx.params);
					}
					return modelCallResults["diningPartner.model.get"] || null;
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
			count: {
				handler(ctx) {
					if (typeof modelCallResults["quote.model.count"] === "function") {
						return modelCallResults["quote.model.count"](ctx.params);
					}
					return modelCallResults["quote.model.count"] || 0;
				},
			},
		},
	});

	// Mock transport service (not a model — a service action)
	broker.createService({
		name: "transport",
		actions: {
			estimateTransportCost: {
				handler() {
					if (typeof transportCallResult === "function") {
						return transportCallResult();
					}
					return transportCallResult || mockTransportResult;
				},
			},
		},
	});

	// Load the real pricingDesk service
	broker.createService(PricingDeskService);

	return broker;
}

// ---- Helpers ----

function setupStandardMocks(tourRequest) {
	modelCallResults["tourRequest.model.get"] = () => tourRequest || makeTourRequest();

	modelCallResults["hotelPartner.model.find"] = () => [mockHotel];

	modelCallResults["attraction.model.get"] = (params) => {
		if (params.id === "attr-1") return { ...mockAttraction1 };
		if (params.id === "attr-2") return { ...mockAttraction2 };
		return null;
	};

	modelCallResults["diningPartner.model.get"] = (params) => {
		if (params.id === "dining-1") return { ...mockDiningPartner };
		return null;
	};

	transportCallResult = { ...mockTransportResult };
}

// ---- Tests ----

describe("PricingDesk Service — estimateCost", () => {
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
		transportCallResult = null;
	});

	it("returns correct cost breakdown with all components", async () => {
		const tourRequest = makeTourRequest();
		setupStandardMocks(tourRequest);

		const result = await broker.call(
			"pricingDesk.estimateCost",
			{ tourRequestId: "tr-1" },
			{ meta: mockStaffMeta }
		);

		// Hotel: standardRate(200) * nightsStay(3) * ceil(10/2)=5 rooms = 3000
		const expectedHotelCost = 200 * 3 * 5;
		// Attractions: (40 + 60) * 10 = 1000
		const expectedAttractionsCost = (40 + 60) * 10;
		// Dining: avg of (80+120)/2 = 100 per person * 10 people * 3 nights = 3000
		const expectedDiningCost = 100 * 10 * 3;
		// Transport: 1500
		const expectedTransportCost = 1500;

		const expectedSubtotal = expectedHotelCost + expectedAttractionsCost + expectedDiningCost + expectedTransportCost;
		const expectedPlatformFee = expectedSubtotal * 0.2;
		const expectedTotal = expectedSubtotal + expectedPlatformFee;
		const expectedPricePerPerson = expectedTotal / 10;

		expect(result.costBreakdown).toBeDefined();
		expect(result.costBreakdown.accommodation.amount).toBe(expectedHotelCost);
		expect(result.costBreakdown.attractions.amount).toBe(expectedAttractionsCost);
		expect(result.costBreakdown.dining.amount).toBe(expectedDiningCost);
		expect(result.costBreakdown.transport.amount).toBe(expectedTransportCost);
		expect(result.costBreakdown.subtotal).toBe(expectedSubtotal);
		expect(result.costBreakdown.platformFee.amount).toBe(expectedPlatformFee);
		expect(result.costBreakdown.margin).toBe(expectedPlatformFee);
		expect(result.totalPrice).toBe(expectedTotal);
		expect(result.pricePerPerson).toBe(expectedPricePerPerson);
		expect(result.currency).toBe("GHS");
		expect(result.groupSize).toBe(10);
		expect(result.durationDays).toBe(5);
		expect(result.note).toContain("automated estimate");
	});

	it("calculates hotel rooms correctly (ceil groupSize/2)", async () => {
		// Odd group size: 7 people -> ceil(7/2) = 4 rooms
		const tourRequest = makeTourRequest({ groupSize: 7 });
		setupStandardMocks(tourRequest);

		const result = await broker.call(
			"pricingDesk.estimateCost",
			{ tourRequestId: "tr-1" },
			{ meta: mockStaffMeta }
		);

		// Hotel: 200 * 3 nights * ceil(7/2)=4 rooms = 2400
		const expectedHotelCost = 200 * 3 * Math.ceil(7 / 2);
		expect(result.costBreakdown.accommodation.amount).toBe(expectedHotelCost);
	});

	it("applies margin correctly (default 20%)", async () => {
		const tourRequest = makeTourRequest();
		setupStandardMocks(tourRequest);

		const result = await broker.call(
			"pricingDesk.estimateCost",
			{ tourRequestId: "tr-1" },
			{ meta: mockStaffMeta }
		);

		const subtotal = result.costBreakdown.subtotal;
		expect(result.costBreakdown.marginPercent).toBe(20);
		expect(result.costBreakdown.margin).toBe(subtotal * 0.2);
		expect(result.totalPrice).toBe(subtotal + subtotal * 0.2);
	});

	it("custom marginPercent works", async () => {
		const tourRequest = makeTourRequest();
		setupStandardMocks(tourRequest);

		const result = await broker.call(
			"pricingDesk.estimateCost",
			{ tourRequestId: "tr-1", marginPercent: 15 },
			{ meta: mockStaffMeta }
		);

		const subtotal = result.costBreakdown.subtotal;
		expect(result.costBreakdown.marginPercent).toBe(15);
		expect(result.costBreakdown.margin).toBe(subtotal * 0.15);
		expect(result.totalPrice).toBe(subtotal + subtotal * 0.15);
		expect(result.costBreakdown.platformFee.description).toContain("15%");
	});

	it("throws TOUR_REQUEST_NOT_FOUND for invalid ID", async () => {
		modelCallResults["tourRequest.model.get"] = () => null;

		try {
			await broker.call(
				"pricingDesk.estimateCost",
				{ tourRequestId: "nonexistent-id" },
				{ meta: mockStaffMeta }
			);
			// Should not reach here
			expect(true).toBe(false);
		} catch (err) {
			expect(err.code).toBe(404);
			expect(err.type).toBe(ERROR_CODES.TOUR_REQUEST_NOT_FOUND);
		}
	});

	it("handles missing dining preferences with default rate", async () => {
		// Destination has no diningPreferences
		const tourRequest = makeTourRequest({
			destinations: [
				{
					destinationId: "dest-1",
					order: 1,
					nightsStay: 3,
					hotelPreference: "premium",
					selectedAttractions: ["attr-1"],
					diningPreferences: [], // empty
				},
			],
		});
		setupStandardMocks(tourRequest);

		const result = await broker.call(
			"pricingDesk.estimateCost",
			{ tourRequestId: "tr-1" },
			{ meta: mockStaffMeta }
		);

		// Default dining: 50 GHS * 10 people * 3 nights = 1500
		const expectedDefaultDining = 50 * 10 * 3;
		expect(result.costBreakdown.dining.amount).toBe(expectedDefaultDining);
		expect(result.costBreakdown.dining.description).toContain("Standard dining");
	});
});
