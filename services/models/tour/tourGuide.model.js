"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const TourGuideSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		email: { type: String, trim: true, lowercase: true },
		phone: { type: String, trim: true },
		specialities: { type: [String], default: [] },
		languages: { type: [String], default: ["English"] },
		bio: { type: String },
		avatar: { type: String },
		galleryImages: { type: [String], default: [] },
		country: { type: String, trim: true },
		rating: { type: Number, default: 0, min: 0, max: 5 },
		reviewCount: { type: Number, default: 0 },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true, collection: "tourguides" }
);

TourGuideSchema.index({ organizationId: 1, isActive: 1 });
TourGuideSchema.index({ country: 1 });

module.exports = {
	name: "tourGuide.model",
	mixins: [DbService("tourguides")],
	model: TourGuideSchema,

	settings: {
		fields: [
			"_id", "name", "organizationId", "email", "phone", "specialities",
			"languages", "bio", "avatar", "galleryImages", "country", "rating", "reviewCount", "isActive",
			"createdAt", "updatedAt",
		],
		entityValidator: {
			name: "string",
			email: "string|optional",
			phone: "string|optional",
			specialities: "array|optional",
			languages: "array|optional",
			bio: "string|optional",
			avatar: "string|optional",
			galleryImages: "array|optional",
			country: "string|optional",
			rating: "number|optional",
			reviewCount: "number|optional",
			isActive: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("TourGuide model service connected to database");
	},
};
