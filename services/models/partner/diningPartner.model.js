"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const DiningPartnerSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		destinationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Destination",
			required: true,
		},
		cuisineType: {
			type: String,
		},
		tier: {
			type: String,
			enum: ["budget", "standard", "premium"],
			default: "standard",
		},
		commissionRate: {
			type: Number,
			default: 0,
		},
		contactInfo: {
			contactPerson: { type: String },
			phone: { type: String },
			email: { type: String },
			address: { type: String },
		},
		location: {
			type: { type: String, enum: ["Point"] },
			coordinates: { type: [Number] },
		},
		menuOptions: [
			{
				name: { type: String },
				description: { type: String },
				pricePerPerson: { type: Number },
			},
		],
		images: {
			type: [String],
			default: [],
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
		collection: "diningpartners",
	}
);

DiningPartnerSchema.index({ destinationId: 1 });
DiningPartnerSchema.index({ cuisineType: 1 });
DiningPartnerSchema.index({ isActive: 1 });
DiningPartnerSchema.index({ location: "2dsphere" });

module.exports = {
	name: "diningPartner.model",
	mixins: [DbService("diningpartners")],
	model: DiningPartnerSchema,

	settings: {
		fields: [
			"_id",
			"name",
			"organizationId",
			"destinationId",
			"cuisineType",
			"tier",
			"commissionRate",
			"contactInfo",
			"location",
			"menuOptions",
			"images",
			"isActive",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			name: "string",
			destinationId: "string",
			cuisineType: "string|optional",
			tier: "string|optional",
			commissionRate: { type: "number", optional: true, convert: true },
			contactInfo: "object|optional",
			menuOptions: "array|optional",
			images: "array|optional",
			isActive: "boolean|optional",
		},
	},

	actions: {
		findByLocation: {
			visibility: "public",
			params: {
				lng: "number",
				lat: "number",
				maxDistanceMeters: { type: "number", optional: true, default: 10000 },
				limit: { type: "number", optional: true, default: 20 },
			},
			async handler(ctx) {
				if (!this.adapter || !this.adapter.model) return [];
				const { lng, lat, maxDistanceMeters, limit } = ctx.params;
				return this.adapter.model.aggregate([
					{
						$geoNear: {
							near: { type: "Point", coordinates: [lng, lat] },
							distanceField: "distance",
							maxDistance: maxDistanceMeters,
							spherical: true,
							query: { isActive: true },
						},
					},
					{ $limit: limit },
				]);
			},
		},
	},

	afterConnected() {
		this.logger.info("DiningPartner model service connected to database");
	},
};
