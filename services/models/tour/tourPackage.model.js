"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { SELLING_MODES, TRANSPORT_TYPES } = require("../../../utils/constants");

const TourPackageSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		description: {
			type: String,
		},
		slug: {
			type: String,
			unique: true,
			lowercase: true,
		},
		destinationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Destination",
			required: true,
		},
		destinations: [
			{
				destinationId: { type: mongoose.Schema.Types.ObjectId, ref: "Destination" },
				order: { type: Number },
				nightsStay: { type: Number },
				hotelPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: "HotelPartner" },
				diningIds: [{ type: mongoose.Schema.Types.ObjectId }],
				attractionIds: [{ type: mongoose.Schema.Types.ObjectId }],
			},
		],
		hotelPartnerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "HotelPartner",
		},
		attractionIds: [{ type: mongoose.Schema.Types.ObjectId }],
		diningIds: [{ type: mongoose.Schema.Types.ObjectId }],
		transportType: {
			type: String,
			enum: Object.values(TRANSPORT_TYPES),
		},
		images: {
			type: [String],
			default: [],
		},
		coverImage: { type: String },
		heroImages: { type: [String], default: [] },
		rating: { type: Number, default: 0, min: 0, max: 5 },
		reviewCount: { type: Number, default: 0 },
		tags: { type: [String], default: [] },
		country: { type: String },
		tourType: { type: String, enum: ["day_tour", "multi_day", "express"], default: "multi_day" },
		availabilitySchedule: { type: String },
		pickupIncluded: { type: Boolean, default: false },
		pickupLocation: { type: String },
		languages: { type: [String], default: ["English"] },
		cancellationPolicy: { type: String },
		bestFor: { type: [String], default: [] },
		difficulty: { type: String, enum: ["easy", "moderate", "challenging"], default: "easy" },
		minAge: { type: Number },
		guideId: { type: mongoose.Schema.Types.ObjectId, ref: "TourGuide" },
		sellingMode: {
			type: String,
			enum: Object.values(SELLING_MODES),
			default: SELLING_MODES.GROUP_BUY,
		},
		totalCapacity: {
			type: Number,
		},
		remainingCapacity: {
			type: Number,
		},
		durationDays: {
			type: Number,
			required: true,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		status: {
			type: String,
			enum: ["draft", "published", "archived"],
			default: "draft",
		},
		highlights: {
			type: [String],
			default: [],
		},
		inclusions: {
			type: [String],
			default: [],
		},
		exclusions: {
			type: [String],
			default: [],
		},
		itinerary: [
			{
				day: { type: Number },
				title: { type: String },
				description: { type: String },
				activities: [{ type: String }],
			},
		],
		startDate: {
			type: Date,
		},
		endDate: {
			type: Date,
		},
		bookingCutoffHours: { type: Number, default: 24 },
		waitlistEnabled: { type: Boolean, default: false },
		maxWaitlistSize: { type: Number, default: 20 },
		autoConfirmationHours: { type: Number, default: 48 },
		viewCount: { type: Number, default: 0 },
		bookingCount: { type: Number, default: 0 },
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	},
	{
		timestamps: true,
		collection: "tourpackages",
	}
);

TourPackageSchema.index({ slug: 1 });
TourPackageSchema.index({ slug: 1, organizationId: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: true } } });
TourPackageSchema.index({ destinationId: 1 });
TourPackageSchema.index({ isActive: 1, status: 1 });
TourPackageSchema.index({ sellingMode: 1 });
TourPackageSchema.index({ tags: 1 });
TourPackageSchema.index({ country: 1 });

TourPackageSchema.index({
	title: "text",
	description: "text",
	"highlights": "text",
}, {
	weights: { title: 10, description: 5, highlights: 3 },
	name: "tourpackage_text_search",
});

module.exports = {
	name: "tourPackage.model",
	mixins: [DbService("tourpackages")],
	model: TourPackageSchema,

	settings: {
		fields: [
			"_id",
			"title",
			"organizationId",
			"description",
			"slug",
			"destinationId",
			"destinations",
			"hotelPartnerId",
			"attractionIds",
			"diningIds",
			"transportType",
			"images",
			"coverImage",
			"heroImages",
			"rating",
			"reviewCount",
			"tags",
			"country",
			"tourType",
			"availabilitySchedule",
			"pickupIncluded",
			"pickupLocation",
			"languages",
			"cancellationPolicy",
			"bestFor",
			"difficulty",
			"minAge",
			"guideId",
			"sellingMode",
			"totalCapacity",
			"remainingCapacity",
			"durationDays",
			"isActive",
			"status",
			"highlights",
			"inclusions",
			"exclusions",
			"itinerary",
			"startDate",
			"endDate",
			"bookingCutoffHours",
			"waitlistEnabled",
			"maxWaitlistSize",
			"autoConfirmationHours",
			"viewCount",
			"bookingCount",
			"createdBy",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			title: "string",
			description: "string|optional",
			slug: "string|optional",
			destinationId: "string",
			destinations: "array|optional",
			hotelPartnerId: "string|optional",
			attractionIds: "array|optional",
			diningIds: "array|optional",
			transportType: "string|optional",
			images: "array|optional",
			coverImage: "string|optional",
			heroImages: "array|optional",
			rating: "number|optional",
			reviewCount: "number|optional",
			tags: "array|optional",
			country: "string|optional",
			tourType: "string|optional",
			availabilitySchedule: "string|optional",
			pickupIncluded: "boolean|optional",
			pickupLocation: "string|optional",
			languages: "array|optional",
			cancellationPolicy: "string|optional",
			bestFor: "array|optional",
			difficulty: "string|optional",
			minAge: "number|optional",
			guideId: "string|optional",
			sellingMode: "string|optional",
			totalCapacity: { type: "number", optional: true, convert: true },
			remainingCapacity: { type: "number", optional: true, convert: true },
			durationDays: "number",
			isActive: "boolean|optional",
			status: "string|optional",
			highlights: "array|optional",
			inclusions: "array|optional",
			exclusions: "array|optional",
			itinerary: "array|optional",
			startDate: "string|optional",
			endDate: "string|optional",
			createdBy: "string|optional",
		},
	},

	actions: {
		incrementField: {
			visibility: "public",
			params: {
				id: "string",
				field: "string",
				amount: { type: "number", optional: true, default: 1 },
			},
			async handler(ctx) {
				if (!this.adapter || !this.adapter.model) return null;
				const { id, field, amount } = ctx.params;
				const allowedFields = ["viewCount", "bookingCount", "remainingCapacity"];
				if (!allowedFields.includes(field)) return null;
				return this.adapter.model.findByIdAndUpdate(
					id,
					{ $inc: { [field]: amount } },
					{ new: true, lean: true }
				);
			},
		},
	},

	afterConnected() {
		this.logger.info("TourPackage model service connected to database");
	},
};
