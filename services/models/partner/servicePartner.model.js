"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const ServicePartnerSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		serviceType: {
			type: String,
			enum: [
				"travel_insurance",
				"visa_support",
				"health_cover",
				"currency_exchange",
				"emergency_assist",
				"other",
			],
			default: "other",
		},
		description: {
			type: String,
		},
		coverImage: { type: String },
		images: {
			type: [String],
			default: [],
		},
		rating: { type: Number, default: 0, min: 0, max: 5 },
		reviewCount: { type: Number, default: 0 },
		isActive: {
			type: Boolean,
			default: true,
		},
		contactInfo: {
			phone: { type: String },
			email: { type: String },
			website: { type: String },
		},
		priceRange: { type: String },
	},
	{
		timestamps: true,
		collection: "servicepartners",
	}
);

ServicePartnerSchema.index({ serviceType: 1 });
ServicePartnerSchema.index({ isActive: 1 });

module.exports = {
	name: "servicePartner.model",
	mixins: [DbService("servicepartners")],
	model: ServicePartnerSchema,

	settings: {
		fields: [
			"_id",
			"name",
			"organizationId",
			"serviceType",
			"description",
			"coverImage",
			"images",
			"rating",
			"reviewCount",
			"isActive",
			"contactInfo",
			"priceRange",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			name: "string",
			organizationId: "string|optional",
			serviceType: "string|optional",
			description: "string|optional",
			coverImage: "string|optional",
			images: "array|optional",
			rating: { type: "number", optional: true, convert: true },
			reviewCount: { type: "number", optional: true, convert: true },
			isActive: "boolean|optional",
			contactInfo: "object|optional",
			priceRange: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("ServicePartner model service connected to database");
	},
};
