"use strict";

const { ServiceBroker } = require("moleculer");
const TourPackageService = require("../../../services/tourPackage.service");
const { ERROR_CODES, ROOM_TYPES, CURRENCIES, HOTEL_TIERS } = require("../../../utils/constants");

// ---- Test data ----

const standardOptionId = "5f1a2b3c4d5e6f7a8b9c0d11";
const premiumOptionId = "5f1a2b3c4d5e6f7a8b9c0d22";

const mockAccommodationPackage = {
	_id: "pkg-acc-1",
	title: "Northern Heritage Expedition",
	slug: "northern-heritage",
	destinationId: "dest-tamale",
	durationDays: 6,
	isActive: true,
	status: "published",
	displayCurrency: CURRENCIES.USD,
	startDate: "2027-01-23T06:00:00.000Z",
	bookingCutoffHours: 24,
	accommodationOptions: [
		{
			_id: standardOptionId,
			label: "Standard (3-star)",
			tier: HOTEL_TIERS.STANDARD,
			hotelPartnerId: "hotel-std-1",
			destinationHotels: [],
			pricing: [
				{ roomType: ROOM_TYPES.SINGLE, minGroupSize: 1, maxGroupSize: 50, pricePerPerson: 2400 },
				{ roomType: ROOM_TYPES.DOUBLE, minGroupSize: 1, maxGroupSize: 50, pricePerPerson: 2100 },
			],
			isActive: true,
		},
		{
			_id: premiumOptionId,
			label: "Premium (4-star)",
			tier: HOTEL_TIERS.PREMIUM,
			hotelPartnerId: "hotel-prem-1",
			destinationHotels: [],
			pricing: [
				{ roomType: ROOM_TYPES.SINGLE, minGroupSize: 1, maxGroupSize: 50, pricePerPerson: 3500 },
				{ roomType: ROOM_TYPES.DOUBLE, minGroupSize: 1, maxGroupSize: 50, pricePerPerson: 3100 },
			],
			isActive: true,
		},
	],
};

const mockLegacyPackage = {
	_id: "pkg-legacy",
	title: "Legacy Tour",
	destinationId: "dest-1",
	durationDays: 2,
	isActive: true,
	status: "published",
	displayCurrency: CURRENCIES.GHS,
	accommodationOptions: [],
};

let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({ logger: false, validator: true });

	function resolveMock(key, ctx) {
		const r = modelCallResults[key];
		if (typeof r === "function") return r(ctx ? ctx.params : undefined);
		return r;
	}

	broker.createService({
		name: "tourPackage.model",
		actions: {
			find: { handler(ctx) { return resolveMock("tourPackage.model.find", ctx) || []; } },
			get: { handler(ctx) { return resolveMock("tourPackage.model.get", ctx) || null; } },
			create: { handler() { return {}; } },
			update: { handler() { return {}; } },
		},
	});

	broker.createService({
		name: "packagePricing.model",
		actions: {
			find: { handler(ctx) { return resolveMock("packagePricing.model.find", ctx) || []; } },
			get: { handler() { return null; } },
			create: { handler() { return {}; } },
			update: { handler() { return {}; } },
			remove: { handler() { return {}; } },
		},
	});

	broker.createService({
		name: "destination.model",
		actions: { get: { handler() { return { _id: "dest-1", isActive: true }; } } },
	});

	broker.createService({
		name: "hotelPartner.model",
		actions: { get: { handler() { return { _id: "hotel-1", isActive: true }; } } },
	});

	broker.createService({
		name: "attraction.model",
		actions: { get: { handler() { return { _id: "attr-1", isActive: true }; } } },
	});

	broker.createService({
		name: "review.model",
		actions: { find: { handler() { return []; } }, get: { handler() { return null; } }, count: { handler() { return 0; } } },
	});

	broker.createService({
		name: "review",
		actions: { getStats: { handler() { return { weightedAverageRating: 0, simpleAverageRating: 0, totalReviews: 0, ratingBreakdown: {} }; } } },
	});

	broker.createService({
		name: "waitlistEntry.model",
		actions: { find: { handler() { return []; } }, get: { handler() { return null; } }, create: { handler() { return {}; } }, count: { handler() { return 0; } } },
	});

	broker.createService(TourPackageService);
	return broker;
}

describe("tourPackage.validatePackage — accommodationOptions path", () => {
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

	it("returns the accommodation option's price for the chosen roomType", async () => {
		modelCallResults["tourPackage.model.get"] = () => mockAccommodationPackage;

		const result = await broker.call("tourPackage.validatePackage", {
			packageId: "pkg-acc-1",
			groupSize: 4,
			accommodationOptionId: standardOptionId,
			roomType: ROOM_TYPES.DOUBLE,
		});

		expect(result.valid).toBe(true);
		expect(result.pricePerPerson).toBe(2100);
		expect(result.totalPrice).toBe(8400);
		expect(result.currency).toBe(CURRENCIES.USD);
		expect(result.roomType).toBe(ROOM_TYPES.DOUBLE);
		expect(result.accommodationOption.label).toBe("Standard (3-star)");
	});

	it("picks the premium option when explicitly chosen", async () => {
		modelCallResults["tourPackage.model.get"] = () => mockAccommodationPackage;

		const result = await broker.call("tourPackage.validatePackage", {
			packageId: "pkg-acc-1",
			groupSize: 2,
			accommodationOptionId: premiumOptionId,
			roomType: ROOM_TYPES.SINGLE,
		});

		expect(result.pricePerPerson).toBe(3500);
		expect(result.totalPrice).toBe(7000);
	});

	it("rejects when accommodationOptionId is missing on a package that requires one", async () => {
		modelCallResults["tourPackage.model.get"] = () => mockAccommodationPackage;

		await expect(
			broker.call("tourPackage.validatePackage", {
				packageId: "pkg-acc-1",
				groupSize: 4,
			})
		).rejects.toMatchObject({
			type: ERROR_CODES.ACCOMMODATION_REQUIRED,
		});
	});

	it("rejects when roomType is missing on an accommodation-tiered package", async () => {
		modelCallResults["tourPackage.model.get"] = () => mockAccommodationPackage;

		await expect(
			broker.call("tourPackage.validatePackage", {
				packageId: "pkg-acc-1",
				groupSize: 4,
				accommodationOptionId: standardOptionId,
			})
		).rejects.toMatchObject({
			type: ERROR_CODES.ACCOMMODATION_REQUIRED,
		});
	});

	it("rejects when the accommodation option does not exist on the package", async () => {
		modelCallResults["tourPackage.model.get"] = () => mockAccommodationPackage;

		await expect(
			broker.call("tourPackage.validatePackage", {
				packageId: "pkg-acc-1",
				groupSize: 4,
				accommodationOptionId: "5f1a2b3c4d5e6f7a8b9c00ff",
				roomType: ROOM_TYPES.DOUBLE,
			})
		).rejects.toMatchObject({
			type: ERROR_CODES.ACCOMMODATION_OPTION_NOT_FOUND,
		});
	});

	it("rejects when the chosen roomType is not priced for the group size", async () => {
		modelCallResults["tourPackage.model.get"] = () => mockAccommodationPackage;

		await expect(
			broker.call("tourPackage.validatePackage", {
				packageId: "pkg-acc-1",
				groupSize: 4,
				accommodationOptionId: standardOptionId,
				roomType: ROOM_TYPES.QUAD,
			})
		).rejects.toMatchObject({
			type: ERROR_CODES.ROOM_TYPE_NOT_AVAILABLE,
		});
	});

	it("falls back to packagePricing when accommodationOptions is empty (legacy path)", async () => {
		modelCallResults["tourPackage.model.get"] = () => mockLegacyPackage;
		modelCallResults["packagePricing.model.find"] = () => [
			{ _id: "tier-legacy", packageId: "pkg-legacy", minGroupSize: 1, maxGroupSize: 10, pricePerPerson: 500, currency: CURRENCIES.GHS, isActive: true },
		];

		const result = await broker.call("tourPackage.validatePackage", {
			packageId: "pkg-legacy",
			groupSize: 4,
		});

		expect(result.valid).toBe(true);
		expect(result.pricePerPerson).toBe(500);
		expect(result.totalPrice).toBe(2000);
		expect(result.currency).toBe(CURRENCIES.GHS);
		expect(result.accommodationOption).toBeUndefined();
	});
});
