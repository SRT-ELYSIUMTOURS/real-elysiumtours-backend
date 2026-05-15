"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { PAYMENT_STATUSES, CURRENCIES, SETTLEMENT_CURRENCY } = require("../../../utils/constants");

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
		// `amount` and `currency` mirror the customer-facing values shown on checkout
		// (e.g. USD 1500). For the actual Paystack charge in pesewas see amountGHS.
		amount: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			default: "GHS",
		},
		// Customer-facing display currency (e.g. "USD") — duplicates booking.displayCurrency
		// for query convenience.
		displayCurrency: {
			type: String,
			enum: Object.values(CURRENCIES),
		},
		// Amount in customer's display currency at the time of payment initiation.
		// Equal to `amount` once we phase out the legacy field.
		amountInDisplayCurrency: { type: Number },
		// Settlement currency — always GHS for Paystack-Ghana merchants.
		settlementCurrency: {
			type: String,
			enum: Object.values(CURRENCIES),
			default: SETTLEMENT_CURRENCY,
		},
		// Amount actually charged via Paystack, in GHS (major unit).
		// Equal to amountInDisplayCurrency * fxRate, rounded to 2 dp.
		amountGHS: { type: Number },
		// USD→GHS (or other→GHS) rate locked at the moment of initiation.
		fxRate: { type: Number },
		fxLockedAt: { type: Date },
		// Reference back to the ForexRate document used at lock time, for audit.
		fxRateRef: { type: mongoose.Schema.Types.ObjectId, ref: "ForexRate" },
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
			"displayCurrency",
			"amountInDisplayCurrency",
			"settlementCurrency",
			"amountGHS",
			"fxRate",
			"fxLockedAt",
			"fxRateRef",
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
			displayCurrency: "string|optional",
			amountInDisplayCurrency: { type: "number", optional: true, convert: true },
			settlementCurrency: "string|optional",
			amountGHS: { type: "number", optional: true, convert: true },
			fxRate: { type: "number", optional: true, convert: true },
			fxLockedAt: "string|optional",
			fxRateRef: "string|optional",
			provider: "string|optional",
			paymentType: "string",
			transactionRef: "string|optional",
			paystackReference: "string|optional",
			accessCode: "string|optional",
			authorizationUrl: "string|optional",
			status: "string|optional",
			paidAt: "string|optional",
			metadata: "object|optional",
			refundedAmount: { type: "number", optional: true, convert: true },
			refundReason: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("Payment model service connected to database");
	},
};
