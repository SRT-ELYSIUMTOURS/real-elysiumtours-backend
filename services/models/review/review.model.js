"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const ReviewSchema = new mongoose.Schema(
	{
		tourPackageId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "TourPackage",
		},
		partnerId: {
			type: mongoose.Schema.Types.ObjectId,
			index: true,
		},
		partnerCategory: {
			type: String,
			trim: true,
		},
		customerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		organizationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Organization",
			index: true,
		},
		bookingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Booking",
		},
		rating: {
			type: Number,
			required: true,
			min: 1,
			max: 5,
		},
		title: {
			type: String,
			trim: true,
		},
		comment: {
			type: String,
			required: true,
			trim: true,
		},
		images: {
			type: [String],
			default: [],
		},
		isVerified: {
			type: Boolean,
			default: false,
		},
		isPublished: {
			type: Boolean,
			default: true,
		},
		response: {
			text: { type: String },
			respondedBy: { type: mongoose.Schema.Types.ObjectId },
			respondedAt: { type: Date },
		},
	},
	{
		timestamps: true,
		collection: "reviews",
	}
);

ReviewSchema.index({ tourPackageId: 1, createdAt: -1 });
ReviewSchema.index({ customerId: 1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index({ isPublished: 1 });

module.exports = {
	name: "review.model",
	mixins: [DbService("reviews")],
	model: ReviewSchema,

	settings: {
		fields: [
			"_id",
			"tourPackageId",
			"partnerId",
			"partnerCategory",
			"customerId",
			"organizationId",
			"bookingId",
			"rating",
			"title",
			"comment",
			"images",
			"isVerified",
			"isPublished",
			"response",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			tourPackageId: "string|optional",
			partnerId: "string|optional",
			partnerCategory: "string|optional",
			customerId: "string",
			organizationId: "string|optional",
			bookingId: "string|optional",
			rating: "number",
			title: "string|optional",
			comment: "string",
			images: "array|optional",
			isVerified: "boolean|optional",
			isPublished: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("Review model service connected to database");
	},
};
