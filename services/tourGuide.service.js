"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");
const PaginateMixin = require("../mixins/paginate.mixin");

module.exports = {
	name: "tourGuide",

	mixins: [PaginateMixin],

	dependencies: ["tourGuide.model"],

	actions: {
		/**
		 * List tour guides with optional filters.
		 * Public action.
		 */
		list: {
			auth: undefined,
			params: {
				isActive: { type: "boolean", optional: true, convert: true },
				country: "string|optional",
				sort: "string|optional",
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { isActive, country, sort, page, pageSize } = ctx.params;
				const query = {};

				if (typeof isActive === "boolean") query.isActive = isActive;
				if (country) query.country = new RegExp(`^${country}$`, "i");

				const SORT_MAP = {
					rating_desc: "-rating",
					rating_asc: "rating",
					name_asc: "name",
					name_desc: "-name",
				};

				const params = { query };
				if (sort && SORT_MAP[sort]) params.sort = SORT_MAP[sort];
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("tourGuide.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get a single tour guide by ID.
		 * Public action.
		 */
		get: {
			auth: undefined,
			params: {
				id: "string",
			},
			async handler(ctx) {
				const guide = await ctx.call(
					"tourGuide.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!guide) {
					throw new MoleculerClientError(
						"Tour guide not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return guide;
			},
		},

		/**
		 * Create a new tour guide.
		 * Requires admin role.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				email: "string|optional",
				phone: "string|optional",
				specialities: "array|optional",
				languages: "array|optional",
				bio: "string|optional",
				avatar: "string|optional",
				country: "string|optional",
				rating: { type: "number", optional: true, convert: true },
				reviewCount: { type: "number", optional: true, convert: true },
				isActive: { type: "boolean", optional: true, convert: true },
			},
			async handler(ctx) {
				const {
					name, email, phone, specialities, languages,
					bio, avatar, country, rating, reviewCount, isActive,
				} = ctx.params;

				const guide = await ctx.call(
					"tourGuide.model.create",
					{
						name,
						email,
						phone,
						specialities: specialities || [],
						languages: languages || ["English"],
						bio,
						avatar,
						country,
						rating: rating || 0,
						reviewCount: reviewCount || 0,
						isActive: typeof isActive === "boolean" ? isActive : true,
					},
					{ meta: ctx.meta }
				);

				this.broker.broadcast("tourGuide.created", { guide });
				return guide;
			},
		},

		/**
		 * Update a tour guide.
		 * Requires admin role.
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				name: "string|optional",
				email: "string|optional",
				phone: "string|optional",
				specialities: "array|optional",
				languages: "array|optional",
				bio: "string|optional",
				avatar: "string|optional",
				country: "string|optional",
				rating: { type: "number", optional: true, convert: true },
				reviewCount: { type: "number", optional: true, convert: true },
				isActive: { type: "boolean", optional: true, convert: true },
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"tourGuide.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Tour guide not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"tourGuide.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Toggle the isActive field of a tour guide.
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
					"tourGuide.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Tour guide not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"tourGuide.model.update",
					{ id, isActive: !existing.isActive },
					{ meta: ctx.meta }
				);
			},
		},
	},

	events: {
		"tourGuide.created"(payload) {
			this.logger.info("Tour guide created:", payload.guide?.name || payload);
		},
	},
};
