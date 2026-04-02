"use strict";

const { ServiceBroker } = require("moleculer");
const { MoleculerClientError } = require("moleculer").Errors;
const HotelPartnerService = require("../../../services/hotelPartner.service");
const AttractionService = require("../../../services/attraction.service");
const DiningService = require("../../../services/dining.service");
const DestinationService = require("../../../services/destination.service");
const TourPackageService = require("../../../services/tourPackage.service");
const { ERROR_CODES } = require("../../../utils/constants");

// ---- Test data ----

const mockHotelGeo = {
	_id: "hotel-geo-1",
	name: "Cape Coast Hotel",
	distance: 2500, // meters
	location: { type: "Point", coordinates: [-1.246, 5.109] },
};

const mockHotelGeo2 = {
	_id: "hotel-geo-2",
	name: "Elmina Beach Hotel",
	distance: 7800,
	location: { type: "Point", coordinates: [-1.350, 5.084] },
};

const mockAttractionGeo = {
	_id: "attr-geo-1",
	name: "Cape Coast Castle",
	distance: 1200,
	location: { type: "Point", coordinates: [-1.241, 5.103] },
};

const mockAttractionGeo2 = {
	_id: "attr-geo-2",
	name: "Kakum National Park",
	distance: 15000,
	location: { type: "Point", coordinates: [-1.383, 5.350] },
};

const mockDiningGeo = {
	_id: "dining-geo-1",
	name: "Oasis Beach Resort Restaurant",
	distance: 3100,
	location: { type: "Point", coordinates: [-1.252, 5.115] },
};

const mockDestinationWithCoords = {
	_id: "dest-geo-1",
	name: "Cape Coast",
	region: "Central",
	isActive: true,
	gpsCoords: { lat: 5.1036, lng: -1.2466 },
	location: { type: "Point", coordinates: [-1.2466, 5.1036] },
};

const mockDestinationNoCoords = {
	_id: "dest-no-coords",
	name: "Unknown Spot",
	region: "Northern",
	isActive: true,
};

const mockPackageForProximity = {
	_id: "pkg-prox-1",
	title: "Cape Coast Explorer",
	hotelPartnerId: "hotel-geo-1",
	attractionIds: ["attr-geo-1", "attr-geo-2"],
	destinationId: "dest-geo-1",
	isActive: true,
	status: "published",
};

const mockHotelForProximity = {
	_id: "hotel-geo-1",
	name: "Cape Coast Hotel",
	location: { type: "Point", coordinates: [-1.246, 5.109] },
};

const mockAttrForProximity1 = {
	_id: "attr-geo-1",
	name: "Cape Coast Castle",
	location: { type: "Point", coordinates: [-1.241, 5.103] },
};

const mockAttrForProximity2 = {
	_id: "attr-geo-2",
	name: "Kakum National Park",
	location: { type: "Point", coordinates: [-1.383, 5.350] },
};

// ---- Model mock results store ----
let modelCallResults = {};

// ---- Broker factories ----

function createPartnerFindNearbyBroker(ServiceDef) {
	const broker = new ServiceBroker({ logger: false, validator: true });

	// Mock model services used by the partner services
	broker.createService({
		name: "hotelPartner.model",
		actions: {
			get: { handler(ctx) { return resolveResult("hotelPartner.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("hotelPartner.model.find", ctx.params); } },
			findByLocation: { handler(ctx) { return resolveResult("hotelPartner.model.findByLocation", ctx.params); } },
			update: { handler(ctx) { return resolveResult("hotelPartner.model.update", ctx.params); } },
		},
	});

	broker.createService({
		name: "attraction.model",
		actions: {
			get: { handler(ctx) { return resolveResult("attraction.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("attraction.model.find", ctx.params); } },
			findByLocation: { handler(ctx) { return resolveResult("attraction.model.findByLocation", ctx.params); } },
		},
	});

	broker.createService({
		name: "diningPartner.model",
		actions: {
			get: { handler(ctx) { return resolveResult("diningPartner.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("diningPartner.model.find", ctx.params); } },
			findByLocation: { handler(ctx) { return resolveResult("diningPartner.model.findByLocation", ctx.params); } },
		},
	});

	broker.createService({
		name: "destination.model",
		actions: {
			get: { handler(ctx) { return resolveResult("destination.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("destination.model.find", ctx.params); } },
			create: { handler(ctx) { return resolveResult("destination.model.create", ctx.params); } },
			update: { handler(ctx) { return resolveResult("destination.model.update", ctx.params); } },
		},
	});

	// Load the real service under test
	broker.createService(ServiceDef);

	return broker;
}

function createTourPackageBroker() {
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
			findByLocation: { handler(ctx) { return resolveResult("hotelPartner.model.findByLocation", ctx.params); } },
		},
	});

	broker.createService({
		name: "attraction.model",
		actions: {
			get: { handler(ctx) { return resolveResult("attraction.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("attraction.model.find", ctx.params); } },
			findByLocation: { handler(ctx) { return resolveResult("attraction.model.findByLocation", ctx.params); } },
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

function resolveResult(key, params) {
	if (typeof modelCallResults[key] === "function") {
		return modelCallResults[key](params);
	}
	return modelCallResults[key] || null;
}

// ==============================================================
// Tests
// ==============================================================

describe("Geospatial findNearby actions", () => {
	// ---- hotelPartner.findNearby ----
	describe("hotelPartner.findNearby", () => {
		let broker;

		beforeAll(async () => {
			broker = createPartnerFindNearbyBroker(HotelPartnerService);
			await broker.start();
		});
		afterAll(() => broker.stop());
		beforeEach(() => { modelCallResults = {}; });

		it("should return hotels with distanceKm", async () => {
			modelCallResults["hotelPartner.model.findByLocation"] = () => [
				{ ...mockHotelGeo },
				{ ...mockHotelGeo2 },
			];

			const results = await broker.call("hotelPartner.findNearby", {
				lat: 5.1036,
				lng: -1.2466,
				maxDistanceKm: 10,
			});

			expect(Array.isArray(results)).toBe(true);
			expect(results).toHaveLength(2);
			expect(results[0].distanceKm).toBe("2.50");
			expect(results[0].name).toBe("Cape Coast Hotel");
			expect(results[1].distanceKm).toBe("7.80");
		});
	});

	// ---- attraction.findNearby ----
	describe("attraction.findNearby", () => {
		let broker;

		beforeAll(async () => {
			broker = createPartnerFindNearbyBroker(AttractionService);
			await broker.start();
		});
		afterAll(() => broker.stop());
		beforeEach(() => { modelCallResults = {}; });

		it("should return attractions with distanceKm", async () => {
			modelCallResults["attraction.model.findByLocation"] = () => [
				{ ...mockAttractionGeo },
				{ ...mockAttractionGeo2 },
			];

			const results = await broker.call("attraction.findNearby", {
				lat: 5.1036,
				lng: -1.2466,
				maxDistanceKm: 20,
			});

			expect(Array.isArray(results)).toBe(true);
			expect(results).toHaveLength(2);
			expect(results[0].distanceKm).toBe("1.20");
			expect(results[0].name).toBe("Cape Coast Castle");
			expect(results[1].distanceKm).toBe("15.00");
		});
	});

	// ---- dining.findNearby ----
	describe("dining.findNearby", () => {
		let broker;

		beforeAll(async () => {
			broker = createPartnerFindNearbyBroker(DiningService);
			await broker.start();
		});
		afterAll(() => broker.stop());
		beforeEach(() => { modelCallResults = {}; });

		it("should return dining partners with distanceKm", async () => {
			modelCallResults["diningPartner.model.findByLocation"] = () => [
				{ ...mockDiningGeo },
			];

			const results = await broker.call("dining.findNearby", {
				lat: 5.1036,
				lng: -1.2466,
				maxDistanceKm: 5,
			});

			expect(Array.isArray(results)).toBe(true);
			expect(results).toHaveLength(1);
			expect(results[0].distanceKm).toBe("3.10");
			expect(results[0].name).toBe("Oasis Beach Resort Restaurant");
		});
	});

	// ---- destination.findNearbyPartners ----
	describe("destination.findNearbyPartners", () => {
		let broker;

		beforeAll(async () => {
			broker = createPartnerFindNearbyBroker(DestinationService);
			await broker.start();
		});
		afterAll(() => broker.stop());
		beforeEach(() => { modelCallResults = {}; });

		it("should return all partner types for a destination with coordinates", async () => {
			modelCallResults["destination.model.get"] = () => ({
				...mockDestinationWithCoords,
			});
			modelCallResults["hotelPartner.model.findByLocation"] = () => [
				{ ...mockHotelGeo },
			];
			modelCallResults["attraction.model.findByLocation"] = () => [
				{ ...mockAttractionGeo },
			];
			modelCallResults["diningPartner.model.findByLocation"] = () => [
				{ ...mockDiningGeo },
			];

			const result = await broker.call("destination.findNearbyPartners", {
				destinationId: "dest-geo-1",
			});

			expect(result.hotels).toBeDefined();
			expect(result.attractions).toBeDefined();
			expect(result.dining).toBeDefined();
			expect(result.hotels).toHaveLength(1);
			expect(result.attractions).toHaveLength(1);
			expect(result.dining).toHaveLength(1);
			expect(result.hotels[0].distanceKm).toBe("2.50");
			expect(result.attractions[0].distanceKm).toBe("1.20");
			expect(result.dining[0].distanceKm).toBe("3.10");
		});

		it("should throw DESTINATION_NOT_FOUND for invalid id", async () => {
			modelCallResults["destination.model.get"] = () => null;

			await expect(
				broker.call("destination.findNearbyPartners", {
					destinationId: "nonexistent-dest",
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.DESTINATION_NOT_FOUND,
			});
		});

		it("should return empty arrays when destination has no coordinates", async () => {
			modelCallResults["destination.model.get"] = () => ({
				...mockDestinationNoCoords,
			});

			const result = await broker.call("destination.findNearbyPartners", {
				destinationId: "dest-no-coords",
			});

			expect(result.hotels).toEqual([]);
			expect(result.attractions).toEqual([]);
			expect(result.dining).toEqual([]);
			expect(result.message).toBeDefined();
		});
	});

	// ---- tourPackage.getProximityMap ----
	describe("tourPackage.getProximityMap", () => {
		let broker;

		beforeAll(async () => {
			broker = createTourPackageBroker();
			await broker.start();
		});
		afterAll(() => broker.stop());
		beforeEach(() => { modelCallResults = {}; });

		it("should return locations and distances for a package", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({
				...mockPackageForProximity,
			});
			modelCallResults["hotelPartner.model.get"] = (params) => {
				if (params.id === "hotel-geo-1") return { ...mockHotelForProximity };
				return null;
			};
			modelCallResults["attraction.model.get"] = (params) => {
				if (params.id === "attr-geo-1") return { ...mockAttrForProximity1 };
				if (params.id === "attr-geo-2") return { ...mockAttrForProximity2 };
				return null;
			};

			const result = await broker.call("tourPackage.getProximityMap", {
				packageId: "pkg-prox-1",
			});

			expect(result.packageId).toBe("pkg-prox-1");
			expect(Array.isArray(result.locations)).toBe(true);
			expect(result.locations).toHaveLength(3); // 1 hotel + 2 attractions
			expect(result.locations[0].type).toBe("hotel");
			expect(result.locations[1].type).toBe("attraction");
			expect(result.locations[2].type).toBe("attraction");

			// Should have 3 distance pairs: hotel-attr1, hotel-attr2, attr1-attr2
			expect(Array.isArray(result.distances)).toBe(true);
			expect(result.distances).toHaveLength(3);
			for (const d of result.distances) {
				expect(d.from).toBeDefined();
				expect(d.to).toBeDefined();
				expect(typeof d.distanceKm).toBe("number");
				expect(d.distanceKm).toBeGreaterThan(0);
			}
		});

		it("should throw PACKAGE_NOT_FOUND for invalid package", async () => {
			modelCallResults["tourPackage.model.get"] = () => null;

			await expect(
				broker.call("tourPackage.getProximityMap", {
					packageId: "nonexistent-pkg",
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PACKAGE_NOT_FOUND,
			});
		});
	});

	// ---- tourPackage.incrementViewCount ----
	describe("tourPackage.incrementViewCount", () => {
		let broker;

		beforeAll(async () => {
			broker = createTourPackageBroker();
			await broker.start();
		});
		afterAll(() => broker.stop());
		beforeEach(() => { modelCallResults = {}; });

		it("should increment view count via model incrementField", async () => {
			let calledWith = null;
			modelCallResults["tourPackage.model.incrementField"] = (params) => {
				calledWith = params;
				return { _id: params.id, viewCount: 42 };
			};

			const result = await broker.call("tourPackage.incrementViewCount", {
				packageId: "pkg-prox-1",
			});

			expect(calledWith).toBeDefined();
			expect(calledWith.id).toBe("pkg-prox-1");
			expect(calledWith.field).toBe("viewCount");
			expect(result.viewCount).toBe(42);
		});
	});
});
