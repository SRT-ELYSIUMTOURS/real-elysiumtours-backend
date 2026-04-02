"use strict";

const {
	haversineDistance,
	toGeoJSON,
	fromGeoJSON,
	validateCoordinates,
	kmToMeters,
	metersToKm,
} = require("../../../utils/geo.utils");

describe("geo.utils", () => {
	describe("haversineDistance", () => {
		it("should calculate Accra to Cape Coast as approximately 145km", () => {
			// Accra: lat 5.6037, lng -0.1870
			// Cape Coast: lat 5.1036, lng -1.2466
			const distance = haversineDistance(5.6037, -0.1870, 5.1036, -1.2466);
			expect(distance).toBeGreaterThan(120);
			expect(distance).toBeLessThan(160);
		});

		it("should return 0 for the same point", () => {
			const distance = haversineDistance(5.6037, -0.1870, 5.6037, -0.1870);
			expect(distance).toBe(0);
		});
	});

	describe("toGeoJSON", () => {
		it("should return correct GeoJSON Point with [lng, lat] order", () => {
			const result = toGeoJSON(5.6037, -0.1870);
			expect(result).toEqual({
				type: "Point",
				coordinates: [-0.1870, 5.6037],
			});
		});
	});

	describe("fromGeoJSON", () => {
		it("should extract lat/lng correctly from GeoJSON", () => {
			const geoJSON = { type: "Point", coordinates: [-0.1870, 5.6037] };
			const result = fromGeoJSON(geoJSON);
			expect(result).toEqual({ lat: 5.6037, lng: -0.1870 });
		});

		it("should return null for invalid input", () => {
			expect(fromGeoJSON(null)).toBeNull();
			expect(fromGeoJSON({})).toBeNull();
		});
	});

	describe("validateCoordinates", () => {
		it("should return true for valid coordinates", () => {
			expect(validateCoordinates(5.6037, -0.1870)).toBe(true);
			expect(validateCoordinates(0, 0)).toBe(true);
			expect(validateCoordinates(-90, -180)).toBe(true);
			expect(validateCoordinates(90, 180)).toBe(true);
		});

		it("should return false for out-of-bounds coordinates", () => {
			expect(validateCoordinates(91, 0)).toBe(false);
			expect(validateCoordinates(-91, 0)).toBe(false);
			expect(validateCoordinates(0, 181)).toBe(false);
			expect(validateCoordinates(0, -181)).toBe(false);
		});

		it("should return false for non-numeric inputs", () => {
			expect(validateCoordinates("5", "0")).toBe(false);
			expect(validateCoordinates(null, 0)).toBe(false);
		});
	});

	describe("kmToMeters", () => {
		it("should convert 10km to 10000m", () => {
			expect(kmToMeters(10)).toBe(10000);
		});
	});

	describe("metersToKm", () => {
		it("should convert 5000m to 5km", () => {
			expect(metersToKm(5000)).toBe(5);
		});
	});
});
