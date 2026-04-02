"use strict";

/**
 * Calculate great-circle distance between two points using Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
	const R = 6371; // Earth radius in km
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
		Math.sin(dLng / 2) * Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function toRad(deg) { return deg * (Math.PI / 180); }

function toGeoJSON(lat, lng) {
	return { type: "Point", coordinates: [lng, lat] }; // GeoJSON is [lng, lat]
}

function fromGeoJSON(geoJSON) {
	if (!geoJSON || !geoJSON.coordinates) return null;
	return { lat: geoJSON.coordinates[1], lng: geoJSON.coordinates[0] };
}

function validateCoordinates(lat, lng) {
	return typeof lat === "number" && typeof lng === "number" &&
		lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function kmToMeters(km) { return km * 1000; }
function metersToKm(m) { return m / 1000; }

module.exports = { haversineDistance, toGeoJSON, fromGeoJSON, validateCoordinates, kmToMeters, metersToKm };
