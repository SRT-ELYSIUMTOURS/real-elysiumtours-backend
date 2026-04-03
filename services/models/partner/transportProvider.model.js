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
		coverImage: { type: String },
		rating: { type: Number, default: 0, min: 0, max: 5 },
		reviewCount: { type: Number, default: 0 },
		serviceAreas: { type: [String], default: [] },
		baseRatePerKm: { type: Number },
		description: { type: String },
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
			"coverImage",
			"rating",
			"reviewCount",
			"serviceAreas",
			"baseRatePerKm",
			"description",
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
			coverImage: "string|optional",
			rating: "number|optional",
			reviewCount: "number|optional",
			serviceAreas: "array|optional",
			baseRatePerKm: "number|optional",
			description: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("TransportProvider model service connected to database");
	},
};
