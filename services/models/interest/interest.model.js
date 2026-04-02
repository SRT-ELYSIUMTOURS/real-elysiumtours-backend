"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { INTEREST_STATUSES } = require("../../../utils/constants");

const InterestSchema = new mongoose.Schema(
	{
		customerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		tourPackageId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "TourPackage",
		},
		destinationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Destination",
		},
		preferredDates: {
			startDate: { type: Date },
			endDate: { type: Date },
		},
		groupSize: {
			type: Number,
			min: 1,
		},
		contactPreference: {
			type: String,
			enum: ["email", "phone", "whatsapp"],
			default: "email",
		},
		notes: {
			type: String,
		},
		status: {
			type: String,
			enum: Object.values(INTEREST_STATUSES),
			default: INTEREST_STATUSES.ACTIVE,
		},
		convertedBookingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Booking",
		},
		notifiedAt: {
			type: Date,
		},
	},
	{
		timestamps: true,
		collection: "interests",
	}
);

InterestSchema.index({ customerId: 1 });
InterestSchema.index({ tourPackageId: 1 });
InterestSchema.index({ destinationId: 1 });
InterestSchema.index({ status: 1 });

module.exports = {
	name: "interest.model",
	mixins: [DbService("interests")],
	model: InterestSchema,

	settings: {
		fields: [
			"_id",
			"customerId",
			"organizationId",
			"tourPackageId",
			"destinationId",
			"preferredDates",
			"groupSize",
			"contactPreference",
			"notes",
			"status",
			"convertedBookingId",
			"notifiedAt",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			customerId: "string",
			tourPackageId: "string|optional",
			destinationId: "string|optional",
			preferredDates: "object|optional",
			groupSize: { type: "number", optional: true, convert: true },
			contactPreference: "string|optional",
			notes: "string|optional",
			status: "string|optional",
			convertedBookingId: "string|optional",
			notifiedAt: "date|optional",
		},
	},

	afterConnected() {
		this.logger.info("Interest model service connected to database");
	},
};
