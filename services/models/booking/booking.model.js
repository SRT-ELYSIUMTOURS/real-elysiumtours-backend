"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { BOOKING_STATUSES, ROOM_TYPES, CURRENCIES } = require("../../../utils/constants");

const BookingSchema = new mongoose.Schema(
	{
		customerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		packageId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "TourPackage",
		},
		quoteId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Quote",
		},
		bookingType: {
			type: String,
			enum: ["packaged", "dynamic", "interest"],
			required: true,
		},
		bookingRef: {
			type: String,
			unique: true,
			required: true,
		},
		groupSize: {
			type: Number,
			required: true,
			min: 1,
		},
		tourDate: {
			type: Date,
		},
		endDate: {
			type: Date,
		},
		// Total amount in the customer's display currency (could be USD, GHS, etc.).
		// Settlement is always in GHS — see Payment.amountGHS for what the customer is actually charged.
		totalAmount: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			default: "GHS",
		},
		// Customer-facing currency for this booking — mirrors the chosen tour package's displayCurrency.
		// Kept distinct from `currency` (which is treated as legacy) so we can phase the field cleanly.
		displayCurrency: {
			type: String,
			enum: Object.values(CURRENCIES),
			default: CURRENCIES.GHS,
		},
		// Accommodation choice (Option B pricing model). Set when the package has accommodationOptions[].
		// Stores the subdocument _id from TourPackage.accommodationOptions and the selected roomType.
		accommodationOptionId: {
			type: mongoose.Schema.Types.ObjectId,
		},
		accommodationLabel: { type: String },
		accommodationTier: { type: String },
		roomType: {
			type: String,
			enum: Object.values(ROOM_TYPES),
		},
		pricePerPerson: { type: Number },
		status: {
			type: String,
			enum: Object.values(BOOKING_STATUSES),
			default: BOOKING_STATUSES.PENDING_PAYMENT,
		},
		commitmentFeeAmount: {
			type: Number,
		},
		commitmentFeePaid: {
			type: Boolean,
			default: false,
		},
		specialRequests: {
			type: String,
		},
		cancellationReason: {
			type: String,
		},
		cancelledAt: {
			type: Date,
		},
		confirmedAt: {
			type: Date,
		},
		partnerConfirmations: [{
			partnerId: { type: mongoose.Schema.Types.ObjectId },
			partnerType: { type: String, enum: ["hotel", "transport", "attraction", "dining"] },
			partnerName: { type: String },
			inventoryModel: { type: String, enum: ["on_request", "free_sale", "allotment"] },
			status: { type: String, enum: ["pending", "confirmed", "rejected", "auto_confirmed"], default: "pending" },
			confirmedAt: { type: Date },
			confirmedBy: { type: mongoose.Schema.Types.ObjectId },
			notes: { type: String },
		}],
	},
	{
		timestamps: true,
		collection: "bookings",
	}
);

BookingSchema.index({ customerId: 1 });
BookingSchema.index({ bookingRef: 1 });
BookingSchema.index({ bookingRef: 1, organizationId: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: true } } });
BookingSchema.index({ status: 1 });
BookingSchema.index({ packageId: 1 });
BookingSchema.index({ quoteId: 1 });
BookingSchema.index({ tourDate: 1 });

module.exports = {
	name: "booking.model",
	mixins: [DbService("bookings")],
	model: BookingSchema,

	settings: {
		fields: [
			"_id",
			"customerId",
			"organizationId",
			"packageId",
			"quoteId",
			"bookingType",
			"bookingRef",
			"groupSize",
			"tourDate",
			"endDate",
			"totalAmount",
			"currency",
			"displayCurrency",
			"accommodationOptionId",
			"accommodationLabel",
			"accommodationTier",
			"roomType",
			"pricePerPerson",
			"status",
			"commitmentFeeAmount",
			"commitmentFeePaid",
			"specialRequests",
			"cancellationReason",
			"cancelledAt",
			"confirmedAt",
			"partnerConfirmations",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			customerId: "string",
			packageId: "string|optional",
			quoteId: "string|optional",
			bookingType: "string",
			bookingRef: "string",
			groupSize: "number|integer|positive",
			tourDate: "string|optional",
			endDate: "string|optional",
			totalAmount: "number",
			currency: "string|optional",
			displayCurrency: "string|optional",
			accommodationOptionId: "string|optional",
			accommodationLabel: "string|optional",
			accommodationTier: "string|optional",
			roomType: "string|optional",
			pricePerPerson: { type: "number", optional: true, convert: true },
			status: "string|optional",
			commitmentFeeAmount: { type: "number", optional: true, convert: true },
			commitmentFeePaid: "boolean|optional",
			specialRequests: "string|optional",
			cancellationReason: "string|optional",
			cancelledAt: "string|optional",
			confirmedAt: "string|optional",
			partnerConfirmations: "array|optional",
		},
	},

	afterConnected() {
		this.logger.info("Booking model service connected to database");
	},
};
