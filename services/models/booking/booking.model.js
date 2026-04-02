"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { BOOKING_STATUSES } = require("../../../utils/constants");

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
		totalAmount: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			default: "GHS",
		},
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
			status: "string|optional",
			commitmentFeeAmount: "number|optional",
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
