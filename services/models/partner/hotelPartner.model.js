"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { HOTEL_TIERS, PARTNER_INVENTORY_MODELS } = require("../../../utils/constants");

const HotelPartnerSchema = new mongoose.Schema(
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
		tier: {
			type: String,
			enum: Object.values(HOTEL_TIERS),
			required: true,
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
		inventoryModel: {
			type: String,
			enum: Object.values(PARTNER_INVENTORY_MODELS),
			default: "on_request",
		},
		contractStatus: {
			type: String,
			enum: ["none", "pending", "active", "expired"],
			default: "none",
		},
		rateData: {
			standardRate: { type: Number },
			seasonalRates: [
				{
					season: { type: String },
					rate: { type: Number },
					startDate: { type: Date },
					endDate: { type: Date },
				},
			],
		},
		availabilityStatus: {
			type: String,
			enum: ["available", "limited", "unavailable"],
			default: "available",
		},
		closeOutDates: [
			{
				startDate: { type: Date },
				endDate: { type: Date },
				reason: { type: String },
			},
		],
		amenities: {
			type: [String],
			default: [],
		},
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
		collection: "hotelpartners",
	}
);

HotelPartnerSchema.index({ destinationId: 1 });
HotelPartnerSchema.index({ tier: 1 });
HotelPartnerSchema.index({ isActive: 1 });
HotelPartnerSchema.index({ inventoryModel: 1 });
HotelPartnerSchema.index({ location: "2dsphere" });

module.exports = {
	name: "hotelPartner.model",
	mixins: [DbService("hotelpartners")],
	model: HotelPartnerSchema,

	settings: {
		fields: [
			"_id",
			"name",
			"organizationId",
			"destinationId",
			"tier",
			"commissionRate",
			"contactInfo",
			"location",
			"inventoryModel",
			"contractStatus",
			"rateData",
			"availabilityStatus",
			"closeOutDates",
			"amenities",
			"images",
			"isActive",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			name: "string",
			destinationId: "string",
			tier: "string",
			commissionRate: "number|optional",
			contactInfo: "object|optional",
			inventoryModel: "string|optional",
			contractStatus: "string|optional",
			rateData: "object|optional",
			availabilityStatus: "string|optional",
			closeOutDates: "array|optional",
			amenities: "array|optional",
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
		this.logger.info("HotelPartner model service connected to database");
	},
};
