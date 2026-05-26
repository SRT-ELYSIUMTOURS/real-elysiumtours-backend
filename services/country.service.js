"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const slugify = require("slugify");
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "country",

	dependencies: ["country.model"],

	actions: {
		/**
		 * List all countries with optional isActive filter.
		 * Public action.
		 */
		list: {
			auth: undefined,
			params: {
				isActive: { type: "boolean", optional: true, convert: true },
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { isActive, page, pageSize } = ctx.params;
				const query = {};

				if (typeof isActive === "boolean") query.isActive = isActive;

				const params = { query };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("country.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get a single country by ID.
		 * Public action.
		 */
		get: {
			auth: undefined,
			params: {
				id: "string",
			},
			async handler(ctx) {
				const country = await ctx.call(
					"country.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!country) {
					throw new MoleculerClientError(
						"Country not found.",
						404,
						ERROR_CODES.COUNTRY_NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return country;
			},
		},

		/**
		 * Get a country by slug.
		 * Public action.
		 */
		getBySlug: {
			auth: undefined,
			params: {
				slug: "string",
			},
			async handler(ctx) {
				const results = await ctx.call(
					"country.model.find",
					{ query: { slug: ctx.params.slug } },
					{ meta: ctx.meta }
				);

				if (!results || results.length === 0) {
					throw new MoleculerClientError(
						"Country not found.",
						404,
						ERROR_CODES.COUNTRY_NOT_FOUND,
						{ slug: ctx.params.slug }
					);
				}

				return results[0];
			},
		},

		/**
		 * Create a new country record.
		 * Requires admin role.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				flagColors: "array|optional",
				currency: "string|optional",
				languages: "string|optional",
				mainAirport: "string|optional",
				timeZone: "string|optional",
				heroTitle: "string|optional",
				heroSubtitle: "string|optional",
				whyTitle: "string|optional",
				whyParagraphs: "array|optional",
				whyStats: "array|optional",
				whyImage: "string|optional",
				whyImageTitle: "string|optional",
				whyImageSubtitle: "string|optional",
			},
			async handler(ctx) {
				const { name, ...rest } = ctx.params;

				const slug = slugify(name, { lower: true, strict: true });

				const country = await ctx.call(
					"country.model.create",
					{
						name,
						slug,
						...rest,
					},
					{ meta: ctx.meta }
				);

				this.broker.broadcast("country.created", { country });
				return country;
			},
		},

		/**
		 * Update a country record.
		 * Requires admin role.
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				name: "string|optional",
				flagColors: "array|optional",
				currency: "string|optional",
				languages: "string|optional",
				mainAirport: "string|optional",
				timeZone: "string|optional",
				heroTitle: "string|optional",
				heroSubtitle: "string|optional",
				whyTitle: "string|optional",
				whyParagraphs: "array|optional",
				whyStats: "array|optional",
				whyImage: "string|optional",
				whyImageTitle: "string|optional",
				whyImageSubtitle: "string|optional",
				isActive: { type: "boolean", optional: true, convert: true },
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"country.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Country not found.",
						404,
						ERROR_CODES.COUNTRY_NOT_FOUND,
						{ id }
					);
				}

				if (updateFields.name) {
					updateFields.slug = slugify(updateFields.name, { lower: true, strict: true });
				}

				return ctx.call(
					"country.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Toggle the isActive field of a country.
		 * Requires admin role.
		 */
		toggleActive: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const existing = await ctx.call(
					"country.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Country not found.",
						404,
						ERROR_CODES.COUNTRY_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"country.model.update",
					{ id, isActive: !existing.isActive },
					{ meta: ctx.meta }
				);
			},
		},
	},

	events: {
		"country.created"(payload) {
			this.logger.info("Country created:", payload.country?.name || payload);
		},
	},
};
