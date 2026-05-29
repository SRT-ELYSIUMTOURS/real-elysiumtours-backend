"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const slugify = require("slugify");
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "blog",

	dependencies: ["blog.model"],

	actions: {
		// ─── Public ───────────────────────────────────────────────────────────────

		list: {
			auth: undefined,
			params: {
				category: { type: "string", optional: true },
				featured: { type: "boolean", optional: true, convert: true },
				page: { type: "number", optional: true, convert: true, default: 1 },
				pageSize: { type: "number", optional: true, convert: true, default: 12 },
				tags: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { category, featured, page, pageSize, tags } = ctx.params;

				const filter = { isPublished: true };
				if (category) filter.category = category;
				if (featured !== undefined) filter.isFeatured = featured;
				if (tags) filter.tags = { $in: tags.split(",").map((t) => t.trim()) };

				const skip = (page - 1) * pageSize;
				const [rows, total] = await Promise.all([
					ctx.call("blog.model.find", {
						query: filter,
						limit: pageSize,
						offset: skip,
						sort: "-publishedAt",
					}, { meta: ctx.meta }),
					ctx.call("blog.model.count", { query: filter }, { meta: ctx.meta }),
				]);

				return {
					rows,
					total,
					page,
					pageSize,
					totalPages: Math.ceil(total / pageSize),
				};
			},
		},

		getBySlug: {
			auth: undefined,
			params: { slug: "string" },
			async handler(ctx) {
				const { slug } = ctx.params;
				const results = await ctx.call(
					"blog.model.find",
					{ query: { slug, isPublished: true }, limit: 1 },
					{ meta: ctx.meta }
				);
				const post = Array.isArray(results) ? results[0] : null;
				if (!post) {
					throw new MoleculerClientError("Blog post not found.", 404, ERROR_CODES.NOT_FOUND || "NOT_FOUND");
				}
				// Increment view count asynchronously — do not await
				ctx.call("blog.model.update", { id: post._id, viewCount: (post.viewCount || 0) + 1 }, { meta: ctx.meta }).catch(() => {});
				return post;
			},
		},

		// ─── Admin ────────────────────────────────────────────────────────────────

		create: {
			auth: "required",
			params: {
				title: "string",
				category: { type: "string", optional: true },
				excerpt: { type: "string", optional: true },
				coverImage: { type: "string", optional: true },
				author: { type: "object", optional: true },
				readTime: { type: "string", optional: true },
				tags: { type: "array", optional: true },
				contentBlocks: { type: "array", optional: true },
				isFeatured: { type: "boolean", optional: true },
				isPublished: { type: "boolean", optional: true },
			},
			async handler(ctx) {
				const data = { ...ctx.params };
				data.slug = slugify(data.title, { lower: true, strict: true });
				if (data.isPublished && !data.publishedAt) {
					data.publishedAt = new Date();
				}
				return ctx.call("blog.model.create", data, { meta: ctx.meta });
			},
		},

		update: {
			auth: "required",
			params: {
				id: "string",
				title: { type: "string", optional: true },
				category: { type: "string", optional: true },
				excerpt: { type: "string", optional: true },
				coverImage: { type: "string", optional: true },
				author: { type: "object", optional: true },
				readTime: { type: "string", optional: true },
				tags: { type: "array", optional: true },
				contentBlocks: { type: "array", optional: true },
				isFeatured: { type: "boolean", optional: true },
				isPublished: { type: "boolean", optional: true },
			},
			async handler(ctx) {
				const { id, ...updates } = ctx.params;
				if (updates.title) {
					updates.slug = slugify(updates.title, { lower: true, strict: true });
				}
				if (updates.isPublished === true) {
					const existing = await ctx.call("blog.model.get", { id }, { meta: ctx.meta });
					if (!existing.publishedAt) updates.publishedAt = new Date();
				}
				return ctx.call("blog.model.update", { id, ...updates }, { meta: ctx.meta });
			},
		},

		togglePublish: {
			auth: "required",
			params: { id: "string" },
			async handler(ctx) {
				const post = await ctx.call("blog.model.get", { id: ctx.params.id }, { meta: ctx.meta });
				if (!post) {
					throw new MoleculerClientError("Blog post not found.", 404, ERROR_CODES.NOT_FOUND || "NOT_FOUND");
				}
				const nowPublished = !post.isPublished;
				const updates = { id: ctx.params.id, isPublished: nowPublished };
				if (nowPublished && !post.publishedAt) updates.publishedAt = new Date();
				return ctx.call("blog.model.update", updates, { meta: ctx.meta });
			},
		},

		delete: {
			auth: "required",
			params: { id: "string" },
			async handler(ctx) {
				await ctx.call("blog.model.remove", { id: ctx.params.id }, { meta: ctx.meta });
				return { success: true };
			},
		},
	},
};
