"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const GalleryItemSchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true },
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		type: { type: String, enum: ["photo", "video"], default: "photo" },
		url: { type: String, required: true },
		thumbnailUrl: { type: String },
		videoUrl: { type: String },
		destinationId: { type: mongoose.Schema.Types.ObjectId, ref: "Destination" },
		tourPackageId: { type: mongoose.Schema.Types.ObjectId, ref: "TourPackage" },
		category: { type: String },
		tags: { type: [String], default: [] },
		caption: { type: String },
		sortOrder: { type: Number, default: 0 },
		isPublished: { type: Boolean, default: true },
	},
	{ timestamps: true, collection: "galleryitems" }
);

GalleryItemSchema.index({ organizationId: 1, isPublished: 1 });
GalleryItemSchema.index({ category: 1 });
GalleryItemSchema.index({ destinationId: 1 });
GalleryItemSchema.index({ tourPackageId: 1 });

module.exports = {
	name: "galleryItem.model",
	mixins: [DbService("galleryitems")],
	model: GalleryItemSchema,

	settings: {
		fields: [
			"_id", "title", "organizationId", "type", "url", "thumbnailUrl", "videoUrl",
			"destinationId", "tourPackageId", "category", "tags", "caption",
			"sortOrder", "isPublished", "createdAt", "updatedAt",
		],
		entityValidator: {
			title: "string",
			type: "string|optional",
			url: "string",
			thumbnailUrl: "string|optional",
			videoUrl: "string|optional",
			destinationId: "string|optional",
			tourPackageId: "string|optional",
			category: "string|optional",
			tags: "array|optional",
			caption: "string|optional",
			sortOrder: "number|optional",
			isPublished: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("GalleryItem model service connected to database");
	},
};
