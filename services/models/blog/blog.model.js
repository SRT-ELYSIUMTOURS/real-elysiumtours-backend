"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const BlogPostSchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true },
		slug: { type: String, unique: true, lowercase: true, trim: true },
		category: {
			type: String,
			enum: ["travel-guides", "destination-highlights", "local-guides", "travel-stories", "partner-spotlight"],
			default: "travel-guides",
		},
		excerpt: { type: String, trim: true },
		coverImage: { type: String },
		author: {
			name: { type: String, default: "Elysium Tours" },
			avatar: { type: String },
			bio: { type: String },
		},
		readTime: { type: String },
		tags: { type: [String], default: [] },
		contentBlocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
		isFeatured: { type: Boolean, default: false },
		isPublished: { type: Boolean, default: false },
		publishedAt: { type: Date },
		viewCount: { type: Number, default: 0 },
	},
	{
		timestamps: true,
		collection: "blogs",
	}
);

BlogPostSchema.index({ slug: 1 });
BlogPostSchema.index({ category: 1, isPublished: 1 });
BlogPostSchema.index({ isFeatured: 1, isPublished: 1 });
BlogPostSchema.index({ publishedAt: -1 });
BlogPostSchema.index({ tags: 1 });
BlogPostSchema.index(
	{ title: "text", excerpt: "text", tags: "text" },
	{ weights: { title: 10, excerpt: 3, tags: 2 }, name: "blog_text_search" }
);

module.exports = {
	name: "blog.model",
	mixins: [DbService("blogs")],
	model: BlogPostSchema,

	settings: {
		fields: [
			"_id",
			"title",
			"slug",
			"category",
			"excerpt",
			"coverImage",
			"author",
			"readTime",
			"tags",
			"contentBlocks",
			"isFeatured",
			"isPublished",
			"publishedAt",
			"viewCount",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			title: "string",
			slug: "string|optional",
			category: "string|optional",
			excerpt: "string|optional",
			coverImage: "string|optional",
			author: "object|optional",
			readTime: "string|optional",
			tags: "array|optional",
			contentBlocks: "array|optional",
			isFeatured: "boolean|optional",
			isPublished: "boolean|optional",
			publishedAt: "any|optional",
		},
	},

	afterConnected() {
		this.logger.info("Blog model service connected to database");
	},
};
