"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { QUOTE_STATUSES } = require("../../../utils/constants");

const CostLineSchema = new mongoose.Schema(
	{
		description: { type: String },
		amount: { type: Number },
	},
	{ _id: false }
);

const CostBreakdownSchema = new mongoose.Schema(
	{
		transport: { type: CostLineSchema },
		accommodation: { type: CostLineSchema },
		attractions: { type: CostLineSchema },
		dining: { type: CostLineSchema },
		platformFee: { type: CostLineSchema },
		subtotal: { type: Number },
		margin: { type: Number },
		marginPercent: { type: Number },
	},
	{ _id: false }
);

const QuoteSchema = new mongoose.Schema(
	{
		tourRequestId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "TourRequest",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		assignedStaffId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		costBreakdown: {
			type: CostBreakdownSchema,
		},
		totalPrice: {
			type: Number,
			required: true,
		},
		pricePerPerson: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			default: "GHS",
		},
		status: {
			type: String,
			enum: Object.values(QUOTE_STATUSES),
			default: QUOTE_STATUSES.PENDING,
		},
		sentAt: {
			type: Date,
		},
		respondedAt: {
			type: Date,
		},
		slaDeadline: {
			type: Date,
		},
		customerResponse: {
			type: String,
		},
		validUntil: {
			type: Date,
		},
		revisionNumber: {
			type: Number,
			default: 1,
		},
	},
	{
		timestamps: true,
		collection: "quotes",
	}
);

QuoteSchema.index({ tourRequestId: 1 });
QuoteSchema.index({ assignedStaffId: 1 });
QuoteSchema.index({ status: 1 });
QuoteSchema.index({ slaDeadline: 1 });

module.exports = {
	name: "quote.model",
	mixins: [DbService("quotes")],
	model: QuoteSchema,

	settings: {
		fields: [
			"_id",
			"tourRequestId",
			"organizationId",
			"assignedStaffId",
			"costBreakdown",
			"totalPrice",
			"pricePerPerson",
			"currency",
			"status",
			"sentAt",
			"respondedAt",
			"slaDeadline",
			"customerResponse",
			"validUntil",
			"revisionNumber",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			tourRequestId: "string",
			assignedStaffId: "string|optional",
			costBreakdown: "object|optional",
			totalPrice: "number",
			pricePerPerson: "number",
			currency: "string|optional",
			status: "string|optional",
			sentAt: "string|optional",
			respondedAt: "string|optional",
			slaDeadline: "string|optional",
			customerResponse: "string|optional",
			validUntil: "string|optional",
			revisionNumber: { type: "number", optional: true, convert: true },
		},
	},

	afterConnected() {
		this.logger.info("Quote model service connected to database");
	},
};
