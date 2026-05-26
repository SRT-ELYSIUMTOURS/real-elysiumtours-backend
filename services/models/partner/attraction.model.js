"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const AttractionSchema = new mongoose.Schema(
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
		category: {
			type: String,
		},
		entryFee: {
			type: Number,
			default: 0,
		},
		description: {
			type: String,
		},
		images: {
			type: [String],
			default: [],
		},
		coverImage: { type: String },
		rating: { type: Number, default: 0, min: 0, max: 5 },
		reviewCount: { type: Number, default: 0 },
		duration: { type: String },
		suitableFor: { type: [String], default: [] },
		isActive: {
			type: Boolean,
			default: true,
		},
		operatingHours: {
			open:     { type: String },
			close:    { type: String },
			weekdays: { type: String },
		},
		contactInfo: {
			phone: { type: String },
			email: { type: String },
		},
		location: {
			type: { type: String, enum: ["Point"] },
			coordinates: { type: [Number] },
		},
	},
	{
		timestamps: true,
		collection: "attractions",
	}
);

AttractionSchema.index({ destinationId: 1 });
AttractionSchema.index({ category: 1 });
AttractionSchema.index({ isActive: 1 });
AttractionSchema.index({ location: "2dsphere" });

module.exports = {
	name: "attraction.model",
	mixins: [DbService("attractions")],
	model: AttractionSchema,

	settings: {
		fields: [
			"_id",
			"name",
			"organizationId",
			"destinationId",
			"category",
			"entryFee",
			"description",
			"images",
			"coverImage",
			"rating",
			"reviewCount",
			"duration",
			"suitableFor",
			"isActive",
			"operatingHours",
			"contactInfo",
			"location",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			name: "string",
			destinationId: "string",
			category: "string|optional",
			entryFee: { type: "number", optional: true, convert: true },
			description: "string|optional",
			images: "array|optional",
			coverImage: "string|optional",
			rating: "number|optional",
			reviewCount: "number|optional",
			duration: "string|optional",
			suitableFor: "array|optional",
			isActive: "boolean|optional",
			operatingHours: "object|optional",
			contactInfo: "object|optional",
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
		this.logger.info("Attraction model service connected to database");
	},
};
