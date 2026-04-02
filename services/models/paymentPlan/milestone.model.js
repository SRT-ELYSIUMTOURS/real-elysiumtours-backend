"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { MILESTONE_STATUSES } = require("../../../utils/constants");

const MilestoneSchema = new mongoose.Schema(
	{
		paymentPlanId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "PaymentPlan",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		bookingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Booking",
			required: true,
		},
		milestoneNumber: {
			type: Number,
			required: true,
		},
		label: {
			type: String,
		},
		amount: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			default: "GHS",
		},
		dueDate: {
			type: Date,
			required: true,
		},
		status: {
			type: String,
			enum: Object.values(MILESTONE_STATUSES),
			default: MILESTONE_STATUSES.PENDING,
		},
		paidAt: {
			type: Date,
		},
		paymentId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Payment",
		},
		reminderSentAt: {
			type: Date,
		},
		isOverdue: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
		collection: "milestones",
	}
);

MilestoneSchema.index({ paymentPlanId: 1, milestoneNumber: 1 });
MilestoneSchema.index({ bookingId: 1 });
MilestoneSchema.index({ status: 1 });
MilestoneSchema.index({ dueDate: 1 });

module.exports = {
	name: "milestone.model",
	mixins: [DbService("milestones")],
	model: MilestoneSchema,

	settings: {
		fields: [
			"_id",
			"paymentPlanId",
			"organizationId",
			"bookingId",
			"milestoneNumber",
			"label",
			"amount",
			"currency",
			"dueDate",
			"status",
			"paidAt",
			"paymentId",
			"reminderSentAt",
			"isOverdue",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			paymentPlanId: "string",
			bookingId: "string",
			milestoneNumber: "number",
			label: "string|optional",
			amount: "number",
			currency: "string|optional",
			dueDate: "string",
			status: "string|optional",
			paidAt: "string|optional",
			paymentId: "string|optional",
			reminderSentAt: "string|optional",
			isOverdue: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("Milestone model service connected to database");
	},
};
