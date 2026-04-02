"use strict";

const { ServiceBroker } = require("moleculer");
const TourPackageService = require("../../../services/tourPackage.service");
const { ERROR_CODES, SELLING_MODES } = require("../../../utils/constants");

// ---- Test data ----

const mockPackage = {
	_id: "pkg-1",
	title: "Cape Coast Adventure",
	slug: "cape-coast-adventure",
	description: "An exciting tour",
	destinationId: "dest-1",
	hotelPartnerId: "hotel-1",
	attractionIds: [],
	diningIds: [],
	sellingMode: SELLING_MODES.GROUP_BUY,
	durationDays: 3,
	isActive: true,
	status: "published",
	images: [],
	highlights: [],
	inclusions: [],
	exclusions: [],
	itinerary: [],
};

const mockPackageIndividual = {
	_id: "pkg-2",
	title: "Accra City Tour",
	slug: "accra-city-tour",
	destinationId: "dest-1",
	sellingMode: SELLING_MODES.INDIVIDUAL_SEATS,
	totalCapacity: 20,
	remainingCapacity: 10,
	durationDays: 1,
	isActive: true,
	status: "published",
};

const mockDestination = {
	_id: "dest-1",
	name: "Cape Coast",
	slug: "cape-coast",
	region: "Central",
	isActive: true,
};

const mockHotel = {
	_id: "hotel-1",
	name: "Beach Resort",
	destinationId: "dest-1",
	isActive: true,
};

const mockPricingTier = {
	_id: "tier-1",
	packageId: "pkg-1",
	minGroupSize: 5,
	maxGroupSize: 10,
	pricePerPerson: 500,
	isActive: true,
	label: "Small Group",
};

const mockPricingTier2 = {
	_id: "tier-2",
	packageId: "pkg-1",
	minGroupSize: 11,
	maxGroupSize: 20,
	pricePerPerson: 400,
	isActive: true,
	label: "Medium Group",
};

// Model call results — keyed by action name
let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock tourPackage.model service
	broker.createService({
		name: "tourPackage.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["tourPackage.model.find"] === "function"
						? modelCallResults["tourPackage.model.find"](ctx.params)
						: modelCallResults["tourPackage.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["tourPackage.model.get"] === "function") {
						return modelCallResults["tourPackage.model.get"](ctx.params);
					}
					return modelCallResults["tourPackage.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["tourPackage.model.create"] === "function"
						? modelCallResults["tourPackage.model.create"](ctx.params)
						: modelCallResults["tourPackage.model.create"] || {};
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
			get: {
				handler(ctx) {
					if (typeof modelCallResults["packagePricing.model.get"] === "function") {
						return modelCallResults["packagePricing.model.get"](ctx.params);
					}
					return modelCallResults["packagePricing.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["packagePricing.model.create"] === "function"
						? modelCallResults["packagePricing.model.create"](ctx.params)
						: modelCallResults["packagePricing.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["packagePricing.model.update"] === "function"
						? modelCallResults["packagePricing.model.update"](ctx.params)
						: modelCallResults["packagePricing.model.update"] || {};
				},
			},
			remove: {
				handler(ctx) {
					return typeof modelCallResults["packagePricing.model.remove"] === "function"
						? modelCallResults["packagePricing.model.remove"](ctx.params)
						: modelCallResults["packagePricing.model.remove"] || {};
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
		},
	});

	// Mock attraction.model service
	broker.createService({
		name: "attraction.model",
		actions: {
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

	// Mock review.model service
	broker.createService({
		name: "review.model",
		actions: {
			find: { handler() { return []; } },
			get: { handler() { return null; } },
			count: { handler() { return 0; } },
		},
	});

	// Mock review service
	broker.createService({
		name: "review",
		actions: {
			getStats: { handler() { return { weightedAverageRating: 0, simpleAverageRating: 0, totalReviews: 0, ratingBreakdown: {} }; } },
		},
	});

	// Mock waitlistEntry.model service
	broker.createService({
		name: "waitlistEntry.model",
		actions: {
			find: { handler() { return []; } },
			get: { handler() { return null; } },
			create: { handler(ctx) { return { _id: "wl-1", ...ctx.params }; } },
			count: { handler() { return 0; } },
		},
	});

	// Load real tourPackage service
	broker.createService(TourPackageService);

	return broker;
}

// ---- Tests ----

describe("TourPackage Service", () => {
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

	// ========== list ==========

	describe("list", () => {
		it("should return an array of published packages", async () => {
			modelCallResults["tourPackage.model.find"] = () => [mockPackage];
			modelCallResults["packagePricing.model.find"] = () => [mockPricingTier];

			const result = await broker.call("tourPackage.list", {});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(1);
			expect(result[0].title).toBe("Cape Coast Adventure");
			expect(result[0].pricingTiers).toBeDefined();
			expect(result[0].pricingTiers.length).toBe(1);
		});
	});

	// ========== get ==========

	describe("get", () => {
		it("should return a package with pricing tiers on happy path", async () => {
			modelCallResults["tourPackage.model.get"] = () => mockPackage;
			modelCallResults["packagePricing.model.find"] = () => [mockPricingTier, mockPricingTier2];
			modelCallResults["destination.model.get"] = () => mockDestination;

			const result = await broker.call("tourPackage.get", { id: "pkg-1" });

			expect(result).toBeDefined();
			expect(result._id).toBe("pkg-1");
			expect(result.title).toBe("Cape Coast Adventure");
			expect(result.pricingTiers.length).toBe(2);
			expect(result.destination).toBeDefined();
			expect(result.destination.name).toBe("Cape Coast");
		});

		it("should throw PACKAGE_NOT_FOUND for invalid id", async () => {
			modelCallResults["tourPackage.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("tourPackage.get", { id: "invalid-id" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PACKAGE_NOT_FOUND,
			});
		});
	});

	// ========== create ==========

	describe("create", () => {
		it("should create a package with slug and pricing tiers", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			modelCallResults["hotelPartner.model.get"] = () => mockHotel;
			modelCallResults["tourPackage.model.create"] = (params) => ({
				_id: "new-pkg",
				...params,
			});
			modelCallResults["packagePricing.model.create"] = (params) => ({
				_id: "new-tier",
				...params,
			});

			const result = await broker.call("tourPackage.create", {
				title: "Kumasi Cultural Tour",
				description: "Explore Ashanti heritage",
				destinationId: "dest-1",
				hotelPartnerId: "hotel-1",
				durationDays: 4,
				pricingTiers: [
					{ minGroupSize: 5, maxGroupSize: 15, pricePerPerson: 600, label: "Standard" },
				],
			});

			expect(result._id).toBe("new-pkg");
			expect(result.title).toBe("Kumasi Cultural Tour");
			expect(result.slug).toBe("kumasi-cultural-tour");
			expect(result.pricingTiers).toBeDefined();
			expect(result.pricingTiers.length).toBe(1);
			expect(result.pricingTiers[0].pricePerPerson).toBe(600);
		});

		it("should throw DESTINATION_NOT_FOUND for invalid destination", async () => {
			modelCallResults["destination.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("tourPackage.create", {
					title: "Bad Tour",
					destinationId: "invalid-dest",
					durationDays: 2,
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.DESTINATION_NOT_FOUND,
			});
		});
	});

	// ========== validatePackage ==========

	describe("validatePackage", () => {
		it("should return valid result for active published package with matching tier", async () => {
			modelCallResults["tourPackage.model.get"] = () => mockPackage;
			modelCallResults["packagePricing.model.find"] = () => [mockPricingTier, mockPricingTier2];

			const result = await broker.call("tourPackage.validatePackage", {
				packageId: "pkg-1",
				groupSize: 7,
			});

			expect(result.valid).toBe(true);
			expect(result.package._id).toBe("pkg-1");
			expect(result.pricingTier._id).toBe("tier-1");
			expect(result.pricePerPerson).toBe(500);
			expect(result.totalPrice).toBe(3500);
		});

		it("should throw PACKAGE_UNAVAILABLE for inactive package", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({
				...mockPackage,
				isActive: false,
			});

			await expect(
				broker.call("tourPackage.validatePackage", {
					packageId: "pkg-1",
					groupSize: 7,
				})
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.PACKAGE_UNAVAILABLE,
			});
		});

		it("should throw error when no pricing tier matches group size", async () => {
			modelCallResults["tourPackage.model.get"] = () => mockPackage;
			modelCallResults["packagePricing.model.find"] = () => [mockPricingTier];

			await expect(
				broker.call("tourPackage.validatePackage", {
					packageId: "pkg-1",
					groupSize: 50,
				})
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.VALIDATION_ERROR,
			});
		});
	});

	// ========== decrementCapacity ==========

	describe("decrementCapacity", () => {
		it("should decrement remaining capacity", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({ ...mockPackageIndividual });
			modelCallResults["tourPackage.model.update"] = (params) => ({
				...mockPackageIndividual,
				remainingCapacity: params.remainingCapacity,
			});

			const result = await broker.call("tourPackage.decrementCapacity", {
				packageId: "pkg-2",
				seats: 3,
			});

			expect(result.remainingCapacity).toBe(7);
		});

		it("should throw INSUFFICIENT_CAPACITY when not enough seats", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({ ...mockPackageIndividual });

			await expect(
				broker.call("tourPackage.decrementCapacity", {
					packageId: "pkg-2",
					seats: 15,
				})
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.INSUFFICIENT_CAPACITY,
			});
		});
	});

	// ========== toggleActive ==========

	describe("toggleActive", () => {
		it("should toggle isActive from true to false", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({ ...mockPackage, isActive: true });
			modelCallResults["tourPackage.model.update"] = (params) => ({
				...mockPackage,
				isActive: params.isActive,
			});

			const result = await broker.call("tourPackage.toggleActive", { id: "pkg-1" });

			expect(result.isActive).toBe(false);
		});
	});

	// ========== publish ==========

	describe("publish", () => {
		it("should set status to published from draft", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({ ...mockPackage, status: "draft" });
			modelCallResults["tourPackage.model.update"] = (params) => ({
				...mockPackage,
				status: params.status,
			});

			const result = await broker.call("tourPackage.publish", { id: "pkg-1" });

			expect(result.status).toBe("published");
		});
	});
});
