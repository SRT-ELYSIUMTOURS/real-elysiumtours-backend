"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const DestinationSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		slug: {
			type: String,
			unique: true,
			lowercase: true,
		},
		region: {
			type: String,
			required: true,
		},
		description: {
			type: String,
		},
		gpsCoords: {
			lat: { type: Number },
			lng: { type: Number },
		},
		location: {
			type: { type: String, enum: ["Point"] },
			coordinates: { type: [Number] },
		},
		images: {
			type: [String],
			default: [],
		},
		highlights: {
			type: [String],
			default: [],
		},
		country: { type: String, required: true, default: "Ghana" },
		subtitle: { type: String },
		coverImage: { type: String },
		tourCount: { type: Number, default: 0 },
		weather: {
			avgTemp: { type: Number },
			rainyMonths: { type: [String], default: [] },
			bestMonths: { type: [String], default: [] },
		},
		bestTimeToVisit: { type: String },
		travelTips: { type: [String], default: [] },
		aboutText: { type: String },
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
		collection: "destinations",
	}
);

DestinationSchema.index({ slug: 1 });
DestinationSchema.index({ slug: 1, organizationId: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: true } } });
DestinationSchema.index({ name: 1, organizationId: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: true } } });
DestinationSchema.index({ region: 1 });
DestinationSchema.index({ isActive: 1 });
DestinationSchema.index({ country: 1 });
DestinationSchema.index({ location: "2dsphere" });

DestinationSchema.index({
	name: "text",
	description: "text",
	region: "text",
	country: "text",
	"highlights": "text",
}, {
	weights: { name: 10, country: 5, region: 5, description: 3, highlights: 2 },
	name: "destination_text_search",
});

module.exports = {
	name: "destination.model",
	mixins: [DbService("destinations")],
	model: DestinationSchema,

	settings: {
		fields: [
			"_id",
			"name",
			"organizationId",
			"slug",
			"region",
			"description",
			"gpsCoords",
			"location",
			"images",
			"highlights",
			"country",
			"subtitle",
			"coverImage",
			"tourCount",
			"weather",
			"bestTimeToVisit",
			"travelTips",
			"aboutText",
			"isActive",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			name: "string",
			slug: "string|optional",
			region: "string",
			description: "string|optional",
			gpsCoords: "object|optional",
			images: "array|optional",
			highlights: "array|optional",
			country: "string|optional",
			subtitle: "string|optional",
			coverImage: "string|optional",
			tourCount: "number|optional",
			weather: "object|optional",
			bestTimeToVisit: "string|optional",
			travelTips: "array|optional",
			aboutText: "string|optional",
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
		this.logger.info("Destination model service connected to database");
	},
};
