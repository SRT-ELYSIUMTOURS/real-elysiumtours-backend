"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");
const PaginateMixin = require("../mixins/paginate.mixin");

module.exports = {
	name: "gallery",

	mixins: [PaginateMixin],

	dependencies: ["galleryItem.model"],

	actions: {
		/**
		 * List gallery items with optional filters.
		 * Public action.
		 */
		list: {
			auth: undefined,
			params: {
				category: "string|optional",
				type: { type: "enum", values: ["photo", "video"], optional: true },
				destinationId: "string|optional",
				tourPackageId: "string|optional",
				isPublished: "boolean|optional",
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { category, type, destinationId, tourPackageId, isPublished, page, pageSize } = ctx.params;
				const query = {};

				if (category) query.category = category;
				if (type) query.type = type;
				if (destinationId) query.destinationId = destinationId;
				if (tourPackageId) query.tourPackageId = tourPackageId;
				if (typeof isPublished === "boolean") query.isPublished = isPublished;

				const params = { query };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("galleryItem.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get a single gallery item by ID.
		 * Public action.
		 */
		get: {
			auth: undefined,
			params: {
				id: "string",
			},
			async handler(ctx) {
				const item = await ctx.call(
					"galleryItem.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!item) {
					throw new MoleculerClientError(
						"Gallery item not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return item;
			},
		},

		/**
		 * Create a new gallery item.
		 * Requires admin role.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				title: "string",
				type: { type: "enum", values: ["photo", "video"], optional: true },
				url: "string",
				thumbnailUrl: "string|optional",
				videoUrl: "string|optional",
				destinationId: "string|optional",
				tourPackageId: "string|optional",
				category: "string|optional",
				tags: "array|optional",
				caption: "string|optional",
				sortOrder: { type: "number", optional: true, convert: true },
				isPublished: "boolean|optional",
			},
			async handler(ctx) {
				const {
					title, type, url, thumbnailUrl, videoUrl,
					destinationId, tourPackageId, category, tags,
					caption, sortOrder, isPublished,
				} = ctx.params;

				const item = await ctx.call(
					"galleryItem.model.create",
					{
						title,
						type: type || "photo",
						url,
						thumbnailUrl,
						videoUrl,
						destinationId,
						tourPackageId,
						category,
						tags: tags || [],
						caption,
						sortOrder: sortOrder || 0,
						isPublished: typeof isPublished === "boolean" ? isPublished : true,
					},
					{ meta: ctx.meta }
				);

				this.broker.broadcast("gallery.created", { item });
				return item;
			},
		},

		/**
		 * Update a gallery item.
		 * Requires admin role.
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				title: "string|optional",
				type: { type: "enum", values: ["photo", "video"], optional: true },
				url: "string|optional",
				thumbnailUrl: "string|optional",
				videoUrl: "string|optional",
				destinationId: "string|optional",
				tourPackageId: "string|optional",
				category: "string|optional",
				tags: "array|optional",
				caption: "string|optional",
				sortOrder: { type: "number", optional: true, convert: true },
				isPublished: "boolean|optional",
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"galleryItem.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Gallery item not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"galleryItem.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Remove a gallery item.
		 * Requires admin role.
		 */
		remove: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const existing = await ctx.call(
					"galleryItem.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Gallery item not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id }
					);
				}

				await ctx.call("galleryItem.model.remove", { id }, { meta: ctx.meta });
				return { success: true, message: "Gallery item removed." };
			},
		},

		/**
		 * Toggle the isPublished field of a gallery item.
		 * Requires admin role.
		 */
		togglePublished: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const existing = await ctx.call(
					"galleryItem.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Gallery item not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"galleryItem.model.update",
					{ id, isPublished: !existing.isPublished },
					{ meta: ctx.meta }
				);
			},
		},
	},

	events: {
		"gallery.created"(payload) {
			this.logger.info("Gallery item created:", payload.item?.title || payload);
		},
	},
};
