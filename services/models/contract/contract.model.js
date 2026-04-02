"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { CONTRACT_STATUSES } = require("../../../utils/constants");

const ContractSchema = new mongoose.Schema(
	{
		templateId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "ContractTemplate",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		bookingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Booking",
			required: true,
			unique: true,
		},
		customerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		renderedTitle: {
			type: String,
		},
		renderedBody: {
			type: String,
		},
		status: {
			type: String,
			enum: Object.values(CONTRACT_STATUSES),
			default: CONTRACT_STATUSES.DRAFT,
		},
		sentAt: {
			type: Date,
		},
		acceptedAt: {
			type: Date,
		},
		acceptedByIp: {
			type: String,
		},
		signatureToken: {
			type: String,
			unique: true,
		},
		expiresAt: {
			type: Date,
		},
		rejectedAt: {
			type: Date,
		},
		rejectionReason: {
			type: String,
		},
	},
	{
		timestamps: true,
		collection: "contracts",
	}
);

ContractSchema.index({ bookingId: 1 });
ContractSchema.index({ customerId: 1 });
ContractSchema.index({ signatureToken: 1 });
ContractSchema.index({ signatureToken: 1, organizationId: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: true } } });
ContractSchema.index({ status: 1 });

module.exports = {
	name: "contract.model",
	mixins: [DbService("contracts")],
	model: ContractSchema,

	settings: {
		fields: [
			"_id",
			"templateId",
			"organizationId",
			"bookingId",
			"customerId",
			"renderedTitle",
			"renderedBody",
			"status",
			"sentAt",
			"acceptedAt",
			"acceptedByIp",
			"signatureToken",
			"expiresAt",
			"rejectedAt",
			"rejectionReason",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			templateId: "string",
			bookingId: "string",
			customerId: "string",
			renderedTitle: "string|optional",
			renderedBody: "string|optional",
			status: "string|optional",
			sentAt: "string|optional",
			acceptedAt: "string|optional",
			acceptedByIp: "string|optional",
			signatureToken: "string|optional",
			expiresAt: "string|optional",
			rejectedAt: "string|optional",
			rejectionReason: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("Contract model service connected to database");
	},
};
