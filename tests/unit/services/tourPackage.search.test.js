"use strict";

const { ServiceBroker } = require("moleculer");
const TourPackageService = require("../../../services/tourPackage.service");
const { SELLING_MODES } = require("../../../utils/constants");

// ---- Test data ----

const mockPackage1 = {
	_id: "pkg-1",
	title: "Cape Coast Adventure",
	slug: "cape-coast-adventure",
	description: "An exciting tour through Cape Coast",
	destinationId: "dest-1",
	sellingMode: SELLING_MODES.GROUP_BUY,
	durationDays: 3,
	isActive: true,
	status: "published",
	highlights: ["Castle tour", "Beach visit"],
};

const mockPackage2 = {
	_id: "pkg-2",
	title: "Accra City Tour",
	slug: "accra-city-tour",
	description: "Explore the capital city",
	destinationId: "dest-2",
	sellingMode: SELLING_MODES.INDIVIDUAL_SEATS,
	durationDays: 1,
	isActive: true,
	status: "published",
	highlights: ["National Museum", "Market visit"],
};

const mockPackage3 = {
	_id: "pkg-3",
	title: "Kumasi Cultural Experience",
	slug: "kumasi-cultural-experience",
	description: "Ashanti heritage tour",
	destinationId: "dest-1",
	sellingMode: SELLING_MODES.GROUP_BUY,
	durationDays: 2,
	isActive: true,
	status: "published",
	highlights: ["Palace visit"],
};

const mockPricingTier = {
	_id: "tier-1",
	packageId: "pkg-1",
	minGroupSize: 5,
	maxGroupSize: 10,
	pricePerPerson: 500,
	isActive: true,
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

describe("TourPackage Search", () => {
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

	describe("search", () => {
		it("should return results matching query text", async () => {
			modelCallResults["tourPackage.model.find"] = (params) => {
				// Simulate text search filtering
				if (params.query && params.query.$text) {
					const searchTerm = params.query.$text.$search.toLowerCase();
					return [mockPackage1, mockPackage2, mockPackage3].filter(
						(pkg) =>
							pkg.title.toLowerCase().includes(searchTerm) ||
							pkg.description.toLowerCase().includes(searchTerm)
					);
				}
				return [mockPackage1, mockPackage2, mockPackage3];
			};

			const result = await broker.call("tourPackage.search", {
				query: "Cape Coast",
			});

			expect(result).toBeDefined();
			expect(result.results).toBeDefined();
			expect(Array.isArray(result.results)).toBe(true);
			expect(result.results.length).toBe(1);
			expect(result.results[0].title).toBe("Cape Coast Adventure");
			expect(result.query).toBe("Cape Coast");
			expect(result.page).toBe(1);
			expect(result.pageSize).toBe(10);
		});

		it("should filter by destinationId", async () => {
			modelCallResults["tourPackage.model.find"] = (params) => {
				const { destinationId } = params.query;
				return [mockPackage1, mockPackage2, mockPackage3].filter(
					(pkg) => pkg.destinationId === destinationId
				);
			};

			const result = await broker.call("tourPackage.search", {
				query: "tour",
				destinationId: "dest-1",
			});

			expect(result).toBeDefined();
			expect(result.results).toBeDefined();
			expect(result.results.length).toBe(2);
			expect(result.results.every((r) => r.destinationId === "dest-1")).toBe(true);
		});

		it("should return empty results for no matches", async () => {
			modelCallResults["tourPackage.model.find"] = () => [];

			const result = await broker.call("tourPackage.search", {
				query: "nonexistent-xyz-tour",
			});

			expect(result).toBeDefined();
			expect(result.results).toBeDefined();
			expect(result.results.length).toBe(0);
			expect(result.total).toBe(0);
		});

		it("should paginate results correctly", async () => {
			// Create a larger set of mock packages for pagination
			const manyPackages = Array.from({ length: 15 }, (_, i) => ({
				_id: `pkg-${i + 1}`,
				title: `Tour Package ${i + 1}`,
				slug: `tour-package-${i + 1}`,
				description: "A great tour",
				destinationId: "dest-1",
				sellingMode: SELLING_MODES.GROUP_BUY,
				durationDays: 3,
				isActive: true,
				status: "published",
				highlights: [],
			}));

			modelCallResults["tourPackage.model.find"] = () => manyPackages;

			// Page 1
			const page1 = await broker.call("tourPackage.search", {
				query: "tour",
				page: 1,
				pageSize: 5,
			});

			expect(page1.results.length).toBe(5);
			expect(page1.total).toBe(15);
			expect(page1.page).toBe(1);
			expect(page1.pageSize).toBe(5);

			// Page 2
			const page2 = await broker.call("tourPackage.search", {
				query: "tour",
				page: 2,
				pageSize: 5,
			});

			expect(page2.results.length).toBe(5);
			expect(page2.page).toBe(2);

			// Page 3
			const page3 = await broker.call("tourPackage.search", {
				query: "tour",
				page: 3,
				pageSize: 5,
			});

			expect(page3.results.length).toBe(5);
			expect(page3.page).toBe(3);

			// Page 4 (beyond data)
			const page4 = await broker.call("tourPackage.search", {
				query: "tour",
				page: 4,
				pageSize: 5,
			});

			expect(page4.results.length).toBe(0);
		});
	});
});
