"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { TOUR_REQUEST_STATUSES, TRANSPORT_TYPES, HOTEL_TIERS } = require("../../../utils/constants");

const TourRequestDestinationSchema = new mongoose.Schema(
	{
		destinationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Destination",
			required: true,
		},
		order: {
			type: Number,
		},
		nightsStay: {
			type: Number,
		},
		hotelPreference: {
			type: String,
			enum: Object.values(HOTEL_TIERS),
		},
		selectedAttractions: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Attraction",
			},
		],
		diningPreferences: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "DiningPartner",
			},
		],
	},
	{ _id: false }
);

const TourRequestSchema = new mongoose.Schema(
	{
		customerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		destinations: {
			type: [TourRequestDestinationSchema],
			default: [],
		},
		groupSize: {
			type: Number,
			required: true,
			min: 1,
		},
		transportPreference: {
			type: String,
			enum: Object.values(TRANSPORT_TYPES),
		},
		preferredStartDate: {
			type: Date,
		},
		durationDays: {
			type: Number,
			required: true,
		},
		specialRequests: {
			type: String,
		},
		status: {
			type: String,
			enum: Object.values(TOUR_REQUEST_STATUSES),
			default: TOUR_REQUEST_STATUSES.DRAFT,
		},
		submittedAt: {
			type: Date,
		},
		referenceNumber: {
			type: String,
			unique: true,
		},
	},
	{
		timestamps: true,
		collection: "tourrequests",
	}
);

TourRequestSchema.index({ customerId: 1 });
TourRequestSchema.index({ status: 1 });
TourRequestSchema.index({ referenceNumber: 1, organizationId: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: true } } });
TourRequestSchema.index({ submittedAt: -1 });
TourRequestSchema.index({ referenceNumber: 1 });

module.exports = {
	name: "tourRequest.model",
	mixins: [DbService("tourrequests")],
	model: TourRequestSchema,

	settings: {
		fields: [
			"_id",
			"customerId",
			"organizationId",
			"destinations",
			"groupSize",
			"transportPreference",
			"preferredStartDate",
			"durationDays",
			"specialRequests",
			"status",
			"submittedAt",
			"referenceNumber",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			customerId: "string",
			destinations: "array|optional",
			groupSize: "number|integer|positive",
			transportPreference: "string|optional",
			preferredStartDate: "string|optional",
			durationDays: "number|integer|positive",
			specialRequests: "string|optional",
			status: "string|optional",
			submittedAt: "string|optional",
			referenceNumber: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("TourRequest model service connected to database");
	},
};
