"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { PAYMENT_PLAN_STATUSES } = require("../../../utils/constants");

const PaymentPlanSchema = new mongoose.Schema(
	{
		bookingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Booking",
			required: true,
			unique: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		customerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		totalAmount: {
			type: Number,
			required: true,
		},
		paidAmount: {
			type: Number,
			default: 0,
		},
		remainingAmount: {
			type: Number,
		},
		currency: {
			type: String,
			default: "GHS",
		},
		commitmentFeePercent: {
			type: Number,
			required: true,
		},
		commitmentFeeAmount: {
			type: Number,
			required: true,
		},
		numberOfMilestones: {
			type: Number,
			required: true,
		},
		status: {
			type: String,
			enum: Object.values(PAYMENT_PLAN_STATUSES),
			default: PAYMENT_PLAN_STATUSES.ACTIVE,
		},
		completedAt: {
			type: Date,
		},
	},
	{
		timestamps: true,
		collection: "paymentplans",
	}
);

PaymentPlanSchema.index({ bookingId: 1 });
PaymentPlanSchema.index({ customerId: 1 });
PaymentPlanSchema.index({ status: 1 });

module.exports = {
	name: "paymentPlan.model",
	mixins: [DbService("paymentplans")],
	model: PaymentPlanSchema,

	settings: {
		fields: [
			"_id",
			"bookingId",
			"organizationId",
			"customerId",
			"totalAmount",
			"paidAmount",
			"remainingAmount",
			"currency",
			"commitmentFeePercent",
			"commitmentFeeAmount",
			"numberOfMilestones",
			"status",
			"completedAt",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			bookingId: "string",
			customerId: "string",
			totalAmount: "number",
			paidAmount: { type: "number", optional: true, convert: true },
			remainingAmount: { type: "number", optional: true, convert: true },
			currency: "string|optional",
			commitmentFeePercent: "number",
			commitmentFeeAmount: "number",
			numberOfMilestones: "number",
			status: "string|optional",
			completedAt: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("PaymentPlan model service connected to database");
	},
};
