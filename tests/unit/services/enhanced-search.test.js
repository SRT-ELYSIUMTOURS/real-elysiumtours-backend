"use strict";

const { ServiceBroker } = require("moleculer");
const TourPackageService = require("../../../services/tourPackage.service");
const { ERROR_CODES } = require("../../../utils/constants");

// ---- Test data ----

const now = Date.now();

const mockPackageNewest = {
	_id: "pkg-search-1",
	title: "New Accra Tour",
	isActive: true,
	status: "published",
	destinationId: "dest-1",
	sellingMode: "group_buy",
	bookingCount: 5,
	createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
};

const mockPackageMid = {
	_id: "pkg-search-2",
	title: "Cape Coast Heritage Walk",
	isActive: true,
	status: "published",
	destinationId: "dest-2",
	sellingMode: "group_buy",
	bookingCount: 25,
	createdAt: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
};

const mockPackageOldest = {
	_id: "pkg-search-3",
	title: "Kumasi Cultural Experience",
	isActive: true,
	status: "published",
	destinationId: "dest-3",
	sellingMode: "group_buy",
	bookingCount: 100,
	createdAt: new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
};

const mockPricingPkg1 = [
	{ _id: "tier-s1", packageId: "pkg-search-1", pricePerPerson: 800, isActive: true, minGroupSize: 1, maxGroupSize: 10 },
];

const mockPricingPkg2 = [
	{ _id: "tier-s2", packageId: "pkg-search-2", pricePerPerson: 300, isActive: true, minGroupSize: 1, maxGroupSize: 10 },
];

const mockPricingPkg3 = [
	{ _id: "tier-s3", packageId: "pkg-search-3", pricePerPerson: 550, isActive: true, minGroupSize: 1, maxGroupSize: 10 },
];

// ---- Model mock results store ----
let modelCallResults = {};

function resolveResult(key, params) {
	if (typeof modelCallResults[key] === "function") {
		return modelCallResults[key](params);
	}
	return modelCallResults[key] || null;
}

// ---- Broker factory ----

function createSearchBroker() {
	const broker = new ServiceBroker({ logger: false, validator: true });

	broker.createService({
		name: "tourPackage.model",
		actions: {
			get: { handler(ctx) { return resolveResult("tourPackage.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("tourPackage.model.find", ctx.params); } },
			create: { handler(ctx) { return resolveResult("tourPackage.model.create", ctx.params); } },
			update: { handler(ctx) { return resolveResult("tourPackage.model.update", ctx.params); } },
			incrementField: { handler(ctx) { return resolveResult("tourPackage.model.incrementField", ctx.params); } },
		},
	});

	broker.createService({
		name: "packagePricing.model",
		actions: {
			get: { handler(ctx) { return resolveResult("packagePricing.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("packagePricing.model.find", ctx.params); } },
			create: { handler(ctx) { return resolveResult("packagePricing.model.create", ctx.params); } },
			update: { handler(ctx) { return resolveResult("packagePricing.model.update", ctx.params); } },
			remove: { handler(ctx) { return resolveResult("packagePricing.model.remove", ctx.params); } },
		},
	});

	broker.createService({
		name: "destination.model",
		actions: {
			get: { handler(ctx) { return resolveResult("destination.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("destination.model.find", ctx.params); } },
		},
	});

	broker.createService({
		name: "hotelPartner.model",
		actions: {
			get: { handler(ctx) { return resolveResult("hotelPartner.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("hotelPartner.model.find", ctx.params); } },
		},
	});

	broker.createService({
		name: "attraction.model",
		actions: {
			get: { handler(ctx) { return resolveResult("attraction.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("attraction.model.find", ctx.params); } },
		},
	});

	broker.createService({
		name: "review.model",
		actions: {
			find: { handler(ctx) { return resolveResult("review.model.find", ctx.params); } },
		},
	});

	broker.createService({
		name: "waitlistEntry.model",
		actions: {
			find: { handler(ctx) { return resolveResult("waitlistEntry.model.find", ctx.params); } },
			count: { handler(ctx) { return resolveResult("waitlistEntry.model.count", ctx.params); } },
			create: { handler(ctx) { return resolveResult("waitlistEntry.model.create", ctx.params); } },
			update: { handler(ctx) { return resolveResult("waitlistEntry.model.update", ctx.params); } },
		},
	});

	broker.createService(TourPackageService);

	return broker;
}

// Helper to set up standard search mocks (3 packages returned by model.find)
function setupSearchMocks() {
	// tourPackage.model.find returns all 3 packages in arbitrary order
	modelCallResults["tourPackage.model.find"] = () => [
		{ ...mockPackageMid },     // bookingCount: 25, price: 300, 30 days old
		{ ...mockPackageOldest },  // bookingCount: 100, price: 550, 1 year old
		{ ...mockPackageNewest },  // bookingCount: 5, price: 800, 1 day old
	];

	// packagePricing.model.find returns pricing per package
	modelCallResults["packagePricing.model.find"] = (params) => {
		const pkgId = params.query?.packageId;
		if (pkgId === "pkg-search-1") return [...mockPricingPkg1];
		if (pkgId === "pkg-search-2") return [...mockPricingPkg2];
		if (pkgId === "pkg-search-3") return [...mockPricingPkg3];
		return [];
	};
}

// ---- Tests ----

describe("Enhanced search sortBy parameter", () => {
	let broker;

	beforeAll(async () => {
		broker = createSearchBroker();
		await broker.start();
	});

	afterAll(() => broker.stop());

	beforeEach(() => {
		modelCallResults = {};
	});

	it('sortBy: "newest" — returns results sorted by createdAt desc', async () => {
		setupSearchMocks();

		const result = await broker.call("tourPackage.search", {
			query: "tour",
			sortBy: "newest",
		});

		expect(result.results).toHaveLength(3);
		expect(result.sortBy).toBe("newest");

		// Newest first: pkg-search-1 (1 day), pkg-search-2 (30 days), pkg-search-3 (1 year)
		expect(result.results[0]._id).toBe("pkg-search-1");
		expect(result.results[1]._id).toBe("pkg-search-2");
		expect(result.results[2]._id).toBe("pkg-search-3");
	});

	it('sortBy: "popularity" — returns results sorted by bookingCount desc', async () => {
		setupSearchMocks();

		const result = await broker.call("tourPackage.search", {
			query: "tour",
			sortBy: "popularity",
		});

		expect(result.results).toHaveLength(3);
		expect(result.sortBy).toBe("popularity");

		// Most popular first: pkg-search-3 (100), pkg-search-2 (25), pkg-search-1 (5)
		expect(result.results[0]._id).toBe("pkg-search-3");
		expect(result.results[1]._id).toBe("pkg-search-2");
		expect(result.results[2]._id).toBe("pkg-search-1");
	});

	it('sortBy: "price_low" — returns results sorted by lowest pricePerPerson asc', async () => {
		setupSearchMocks();

		const result = await broker.call("tourPackage.search", {
			query: "tour",
			sortBy: "price_low",
		});

		expect(result.results).toHaveLength(3);
		expect(result.sortBy).toBe("price_low");

		// Cheapest first: pkg-search-2 (300), pkg-search-3 (550), pkg-search-1 (800)
		expect(result.results[0]._id).toBe("pkg-search-2");
		expect(result.results[1]._id).toBe("pkg-search-3");
		expect(result.results[2]._id).toBe("pkg-search-1");
	});

	it('sortBy: "relevance" (default) — no regression, returns results without reordering', async () => {
		setupSearchMocks();

		const result = await broker.call("tourPackage.search", {
			query: "tour",
			sortBy: "relevance",
		});

		expect(result.results).toHaveLength(3);
		expect(result.sortBy).toBe("relevance");
		expect(result.total).toBe(3);
		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(10);

		// Relevance preserves the original order from the DB (no re-sort applied)
		expect(result.results[0]._id).toBe("pkg-search-2");
		expect(result.results[1]._id).toBe("pkg-search-3");
		expect(result.results[2]._id).toBe("pkg-search-1");
	});

	it("default sortBy should be relevance when not specified", async () => {
		setupSearchMocks();

		const result = await broker.call("tourPackage.search", {
			query: "tour",
		});

		expect(result.sortBy).toBe("relevance");
		expect(result.results).toHaveLength(3);
	});

	it('sortBy: "price_high" — returns results sorted by highest pricePerPerson desc', async () => {
		setupSearchMocks();

		const result = await broker.call("tourPackage.search", {
			query: "tour",
			sortBy: "price_high",
		});

		expect(result.results).toHaveLength(3);
		expect(result.sortBy).toBe("price_high");

		// Most expensive first: pkg-search-1 (800), pkg-search-3 (550), pkg-search-2 (300)
		expect(result.results[0]._id).toBe("pkg-search-1");
		expect(result.results[1]._id).toBe("pkg-search-3");
		expect(result.results[2]._id).toBe("pkg-search-2");
	});

	it("pagination should work with sorted results", async () => {
		setupSearchMocks();

		const result = await broker.call("tourPackage.search", {
			query: "tour",
			sortBy: "popularity",
			page: 1,
			pageSize: 2,
		});

		expect(result.results).toHaveLength(2);
		expect(result.total).toBe(3);
		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(2);

		// First 2 of popularity sort: pkg-search-3, pkg-search-2
		expect(result.results[0]._id).toBe("pkg-search-3");
		expect(result.results[1]._id).toBe("pkg-search-2");
	});
});
