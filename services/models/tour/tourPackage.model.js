"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const {
	SELLING_MODES,
	TRANSPORT_TYPES,
	HOTEL_TIERS,
	ROOM_TYPES,
	CURRENCIES,
} = require("../../../utils/constants");

// Sub-schema: per-destination hotel override inside an accommodation option.
// Multi-destination tours (e.g. Achimota Tour 1) use this to say
// "the Standard tier maps to Hotel A in Tamale and Hotel B in Kumasi".
const AccommodationDestinationHotelSchema = new mongoose.Schema(
	{
		destinationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Destination",
			required: true,
		},
		hotelPartnerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "HotelPartner",
			required: true,
		},
		nights: { type: Number },
	},
	{ _id: false }
);

// Sub-schema: room-type pricing inside an accommodation option.
// Optional group-size brackets allow per-tier group discounts later
// without forcing a separate PackagePricing row.
const AccommodationPricingRowSchema = new mongoose.Schema(
	{
		roomType: {
			type: String,
			enum: Object.values(ROOM_TYPES),
			required: true,
		},
		minGroupSize: { type: Number, default: 1 },
		maxGroupSize: { type: Number, default: 1000 },
		pricePerPerson: { type: Number, required: true },
	},
	{ _id: false }
);

// Sub-schema: one accommodation tier choice on a tour package.
// E.g. Achimota Tour 1 has three: Standard / Premium / Luxury.
const AccommodationOptionSchema = new mongoose.Schema(
	{
		label: { type: String, required: true, trim: true },
		tier: {
			type: String,
			enum: Object.values(HOTEL_TIERS),
		},
		hotelPartnerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "HotelPartner",
		},
		destinationHotels: { type: [AccommodationDestinationHotelSchema], default: [] },
		pricing: { type: [AccommodationPricingRowSchema], default: [] },
		description: { type: String },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: false }
);

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
		// Currency in which this package's prices are quoted to customers.
		// Settlement still happens in GHS — see services/payment.service.js for FX-lock at payment.
		displayCurrency: {
			type: String,
			enum: Object.values(CURRENCIES),
			default: CURRENCIES.GHS,
		},
		// Customer-facing accommodation tier choices (Option B pricing model).
		// When non-empty, this replaces packagePricing rows as the source of truth for price.
		// Each option pins a hotel partner (or per-destination map for multi-city tours)
		// and a room-type price matrix.
		accommodationOptions: { type: [AccommodationOptionSchema], default: [] },
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
		tourHighlights: [
			{
				title: { type: String },
				description: { type: String },
			},
		],
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
				preview: { type: String },
				localContext: { type: String },
				activities: [
					{
						time: { type: String },
						activity: { type: String },
						tag: { type: String },
					},
				],
			},
		],
		importantInformation: {
			blocks: [
				{
					title: { type: String },
					body: { type: String },
				},
			],
			footerNote: { type: String },
		},
		bookingAddOns: [
			{
				id: { type: String },
				label: { type: String },
				priceGhc: { type: Number },
			},
		],
		categoryRatings: [
			{
				label: { type: String },
				score: { type: Number },
			},
		],
		businessAmenities: {
			items: { type: [String], default: [] },
			corporateBookingBenefits: {
				title: { type: String },
				items: { type: [String], default: [] },
			},
		},
		meetingPoint: {
			lat: { type: Number },
			lng: { type: Number },
		},
		meetingPointLabel: { type: String },
		heroMainImage: { type: String },
		heroTopRight: { type: String },
		heroBottomLeft: { type: String },
		heroBottomRight: { type: String },
		featureType: { type: String },
		featureLabel: { type: String },
		statusBadge: {
			label: { type: String },
			color: { type: String },
		},
		availabilityBadge: { type: String },
		basePrice: { type: Number },
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
		featured: { type: Boolean, default: false },
		category: { type: String, enum: ["leisure", "business", "ekolure"] },
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
TourPackageSchema.index({ category: 1 });

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
			"displayCurrency",
			"accommodationOptions",
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
			"tourHighlights",
			"inclusions",
			"exclusions",
			"itinerary",
			"importantInformation",
			"bookingAddOns",
			"categoryRatings",
			"businessAmenities",
			"meetingPoint",
			"meetingPointLabel",
			"heroMainImage",
			"heroTopRight",
			"heroBottomLeft",
			"heroBottomRight",
			"featureType",
			"featureLabel",
			"statusBadge",
			"availabilityBadge",
			"basePrice",
			"startDate",
			"endDate",
			"bookingCutoffHours",
			"waitlistEnabled",
			"maxWaitlistSize",
			"autoConfirmationHours",
			"featured",
			"category",
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
			displayCurrency: "string|optional",
			accommodationOptions: "array|optional",
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
			tourHighlights: "array|optional",
			inclusions: "array|optional",
			exclusions: "array|optional",
			itinerary: "array|optional",
			importantInformation: "object|optional",
			bookingAddOns: "array|optional",
			categoryRatings: "array|optional",
			businessAmenities: "object|optional",
			meetingPoint: "object|optional",
			meetingPointLabel: "string|optional",
			heroMainImage: "string|optional",
			heroTopRight: "string|optional",
			heroBottomLeft: "string|optional",
			heroBottomRight: "string|optional",
			featureType: "string|optional",
			featureLabel: "string|optional",
			statusBadge: "object|optional",
			availabilityBadge: "string|optional",
			basePrice: { type: "number", optional: true, convert: true },
			featured: "boolean|optional",
			category: "string|optional",
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
