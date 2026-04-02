"use strict";

const crypto = require("crypto");

/**
 * Generate a unique booking reference in the format ELY-YYYYMMDD-XXXX
 * where XXXX is 4 random uppercase hex characters.
 * @returns {string}
 */
function generateBookingRef() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const datePart = `${year}${month}${day}`;
	const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();
	return `ELY-${datePart}-${randomPart}`;
}

module.exports = { generateBookingRef };
