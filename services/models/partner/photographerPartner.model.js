"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const PhotographerPartnerSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		bio: {
			type: String,
		},
		specialties: {
			type: [String],
			default: [],
		},
		portfolio: {
			type: [String],
			default: [],
		},
		coverImage: { type: String },
		avatar: { type: String },
		rating: { type: Number, default: 0, min: 0, max: 5 },
		reviewCount: { type: Number, default: 0 },
		languages: {
			type: [String],
			default: ["English"],
		},
		baseRatePerDay: {
			type: Number,
			default: 0,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		contactInfo: {
			phone: { type: String },
			email: { type: String },
			website: { type: String },
		},
	},
	{
		timestamps: true,
		collection: "photographerpartners",
	}
);

PhotographerPartnerSchema.index({ organizationId: 1 });
PhotographerPartnerSchema.index({ isActive: 1 });

module.exports = {
	name: "photographerPartner.model",
	mixins: [DbService("photographerpartners")],
	model: PhotographerPartnerSchema,

	settings: {
		fields: [
			"_id",
			"name",
			"organizationId",
			"bio",
			"specialties",
			"portfolio",
			"coverImage",
			"avatar",
			"rating",
			"reviewCount",
			"languages",
			"baseRatePerDay",
			"isActive",
			"contactInfo",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			name: "string",
			organizationId: "string|optional",
			bio: "string|optional",
			specialties: "array|optional",
			portfolio: "array|optional",
			coverImage: "string|optional",
			avatar: "string|optional",
			rating: { type: "number", optional: true, convert: true },
			reviewCount: { type: "number", optional: true, convert: true },
			languages: "array|optional",
			baseRatePerDay: { type: "number", optional: true, convert: true },
			isActive: "boolean|optional",
			contactInfo: "object|optional",
		},
	},

	afterConnected() {
		this.logger.info("PhotographerPartner model service connected to database");
	},
};
