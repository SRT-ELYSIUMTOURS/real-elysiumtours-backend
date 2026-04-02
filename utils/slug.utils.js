"use strict";

const slugify = require("slugify");

/**
 * Generate a URL-friendly slug from the given text.
 *
 * @param {string} text - The source text to slugify.
 * @returns {string} A lowercase, strict slug.
 */
function generateSlug(text) {
	return slugify(text, { lower: true, strict: true, trim: true });
}

/**
 * Generate a unique slug by appending a random 4-character suffix
 * when the base slug already exists in the provided list.
 *
 * @param {string} text - The source text to slugify.
 * @param {string[]} existingSlugs - Array of slugs already in use.
 * @returns {string} A unique slug.
 */
function generateUniqueSlug(text, existingSlugs) {
	const base = generateSlug(text);

	if (!existingSlugs || !existingSlugs.includes(base)) {
		return base;
	}

	const suffix = Math.random().toString(36).substring(2, 6);
	return `${base}-${suffix}`;
}

module.exports = {
	generateSlug,
	generateUniqueSlug,
};
