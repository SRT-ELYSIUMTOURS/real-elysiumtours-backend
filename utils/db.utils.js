"use strict";

const mongoose = require("mongoose");
const { Types } = mongoose;

const HEX_24_REGEX = /^[a-fA-F0-9]{24}$/;

/**
 * Returns true if `id` is a valid MongoDB ObjectId.
 * Accepts both strings (24-char hex) and ObjectId instances.
 *
 * @param {*} id
 * @returns {boolean}
 */
function isValidId(id) {
	if (id instanceof Types.ObjectId) return true;
	if (typeof id === "string" && HEX_24_REGEX.test(id)) {
		return Types.ObjectId.isValid(id);
	}
	return false;
}

/**
 * Converts a string to a mongoose ObjectId.
 * If the value is already an ObjectId instance it is returned as-is.
 * Throws if the value is not a valid ObjectId.
 *
 * @param {string|Types.ObjectId} id
 * @returns {Types.ObjectId}
 */
function normalizeId(id) {
	if (id instanceof Types.ObjectId) return id;
	if (typeof id === "string" && HEX_24_REGEX.test(id) && Types.ObjectId.isValid(id)) {
		return new Types.ObjectId(id);
	}
	throw new Error(`Invalid ObjectId: ${id}`);
}

/**
 * Converts a mongoose ObjectId (or any value with a .toString()) to a string.
 *
 * @param {Types.ObjectId|string} id
 * @returns {string}
 */
function toStringId(id) {
	if (id == null) return id;
	return id.toString();
}

/**
 * Returns true if `value` is an instance of mongoose.Types.ObjectId.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isObjectId(value) {
	return value instanceof Types.ObjectId;
}

module.exports = {
	isValidId,
	normalizeId,
	toStringId,
	isObjectId,
};
