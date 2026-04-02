"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { PAYMENT_STATUSES } = require("../../../utils/constants");

const PaymentSchema = new mongoose.Schema(
	{
		bookingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Booking",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		customerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		amount: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			default: "GHS",
		},
		provider: {
			type: String,
			default: "paystack",
		},
		paymentType: {
			type: String,
			enum: ["commitment_fee", "milestone", "full_payment", "refund"],
			required: true,
		},
		transactionRef: {
			type: String,
			unique: true,
		},
		paystackReference: {
			type: String,
		},
		accessCode: {
			type: String,
		},
		authorizationUrl: {
			type: String,
		},
		status: {
			type: String,
			enum: Object.values(PAYMENT_STATUSES),
			default: PAYMENT_STATUSES.PENDING,
		},
		paidAt: {
			type: Date,
		},
		metadata: {
			type: mongoose.Schema.Types.Mixed,
		},
		refundedAmount: {
			type: Number,
			default: 0,
		},
		refundReason: {
			type: String,
		},
	},
	{
		timestamps: true,
		collection: "payments",
	}
);

PaymentSchema.index({ bookingId: 1 });
PaymentSchema.index({ customerId: 1 });
PaymentSchema.index({ transactionRef: 1 });
PaymentSchema.index({ transactionRef: 1, organizationId: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: true } } });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ paymentType: 1 });

module.exports = {
	name: "payment.model",
	mixins: [DbService("payments")],
	model: PaymentSchema,

	settings: {
		fields: [
			"_id",
			"bookingId",
			"organizationId",
			"customerId",
			"amount",
			"currency",
			"provider",
			"paymentType",
			"transactionRef",
			"paystackReference",
			"accessCode",
			"authorizationUrl",
			"status",
			"paidAt",
			"metadata",
			"refundedAmount",
			"refundReason",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			bookingId: "string",
			customerId: "string",
			amount: "number",
			currency: "string|optional",
			provider: "string|optional",
			paymentType: "string",
			transactionRef: "string|optional",
			paystackReference: "string|optional",
			accessCode: "string|optional",
			authorizationUrl: "string|optional",
			status: "string|optional",
			paidAt: "string|optional",
			metadata: "object|optional",
			refundedAmount: "number|optional",
			refundReason: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("Payment model service connected to database");
	},
};
