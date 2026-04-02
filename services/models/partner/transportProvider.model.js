"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const TransportProviderSchema = new mongoose.Schema(
	{
		companyName: {
			type: String,
			required: true,
			trim: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		contactPerson: {
			type: String,
		},
		phone: {
			type: String,
		},
		email: {
			type: String,
		},
		commissionRate: {
			type: Number,
			default: 0,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
		collection: "transportproviders",
	}
);

module.exports = {
	name: "transportProvider.model",
	mixins: [DbService("transportproviders")],
	model: TransportProviderSchema,

	settings: {
		fields: [
			"_id",
			"companyName",
			"organizationId",
			"contactPerson",
			"phone",
			"email",
			"commissionRate",
			"isActive",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			companyName: "string",
			contactPerson: "string|optional",
			phone: "string|optional",
			email: "string|optional",
			commissionRate: { type: "number", optional: true, convert: true },
			isActive: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("TransportProvider model service connected to database");
	},
};
