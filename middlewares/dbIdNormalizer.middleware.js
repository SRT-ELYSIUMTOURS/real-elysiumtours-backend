"use strict";

const mongoose = require("mongoose");
const { Types } = mongoose;

/**
 * Check whether a value is an instance of mongoose ObjectId.
 */
function isObjectId(value) {
	return value instanceof Types.ObjectId;
}

/**
 * Recursively convert ObjectIds to strings in an action response.
 * Handles plain objects, arrays, Mongoose documents, and nested structures.
 *
 * Also converts Date objects to ISO strings to prevent character-by-character
 * serialization when dates pass through JSON.stringify on Mongoose lean() docs.
 */
function normalizeResponse(data) {
	if (data == null) return data;

	if (isObjectId(data)) {
		return data.toString();
	}

	if (data instanceof Date) {
		return data.toISOString();
	}

	if (Buffer.isBuffer(data)) {
		return data;
	}

	if (Array.isArray(data)) {
		return data.map((item) => normalizeResponse(item));
	}

	if (typeof data === "object") {
		// Handle Mongoose documents that expose .toJSON / .toObject
		const plain = typeof data.toJSON === "function" ? data.toJSON() : data;

		const result = {};
		for (const key of Object.keys(plain)) {
			const value = plain[key];
			if (isObjectId(value)) {
				result[key] = value.toString();
			} else if (value instanceof Date) {
				result[key] = value.toISOString();
			} else if (Array.isArray(value)) {
				result[key] = value.map((item) => normalizeResponse(item));
			} else if (value && typeof value === "object") {
				result[key] = normalizeResponse(value);
			} else {
				result[key] = value;
			}
		}
		return result;
	}

	return data;
}

/**
 * DbIdNormalizer Middleware
 *
 * Converts ObjectId and Date values in action responses to strings.
 *
 * DESIGN NOTE: We intentionally do NOT convert string IDs to ObjectIds
 * on the inbound (request) path. Mongoose handles string-to-ObjectId
 * conversion automatically when querying, and converting them in the
 * middleware causes issues with moleculer-db's built-in get/update/remove
 * actions which expect `id` as a string. This was discovered during E2E
 * testing against real MongoDB (2026-04-01).
 */
module.exports = {
	name: "DbIdNormalizer",

	localAction(handler) {
		return function DbIdNormalizerMiddleware(ctx) {
			// No inbound conversion — Mongoose handles string→ObjectId natively
			return handler(ctx).then((res) => {
				if (res == null) return res;
				return normalizeResponse(res);
			});
		};
	},
};
