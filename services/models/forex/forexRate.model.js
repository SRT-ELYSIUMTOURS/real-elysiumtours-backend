"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { CURRENCIES } = require("../../../utils/constants");

const ForexRateSchema = new mongoose.Schema(
	{
		fromCurrency: {
			type: String,
			enum: Object.values(CURRENCIES),
			required: true,
		},
		toCurrency: {
			type: String,
			enum: Object.values(CURRENCIES),
			required: true,
		},
		// Mid-market rate (or admin-entered customer rate). Multiplied against
		// the source amount to produce the converted amount.
		rate: { type: Number, required: true },
		// Optional markup applied on top of an interbank/source rate.
		// effectiveRate = rate * (1 + markupPercent/100). When 0 or null,
		// `rate` is already the effective rate.
		markupPercent: { type: Number, default: 0 },
		// Date this rate becomes active. Lookups pick the most recent record
		// where effectiveDate <= now.
		effectiveDate: { type: Date, required: true, default: () => new Date() },
		expiresAt: { type: Date },
		source: { type: String, default: "manual" },
		note: { type: String },
		organizationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Organization",
			index: true,
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		isActive: { type: Boolean, default: true },
	},
	{
		timestamps: true,
		collection: "forexrates",
	}
);

ForexRateSchema.index({ fromCurrency: 1, toCurrency: 1, effectiveDate: -1 });
ForexRateSchema.index({ isActive: 1 });

module.exports = {
	name: "forexRate.model",
	mixins: [DbService("forexrates")],
	model: ForexRateSchema,

	settings: {
		fields: [
			"_id",
			"fromCurrency",
			"toCurrency",
			"rate",
			"markupPercent",
			"effectiveDate",
			"expiresAt",
			"source",
			"note",
			"organizationId",
			"createdBy",
			"isActive",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			fromCurrency: "string",
			toCurrency: "string",
			rate: { type: "number", positive: true, convert: true },
			markupPercent: { type: "number", optional: true, convert: true },
			effectiveDate: "string|optional",
			expiresAt: "string|optional",
			source: "string|optional",
			note: "string|optional",
			organizationId: "string|optional",
			createdBy: "string|optional",
			isActive: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("ForexRate model service connected to database");
	},
};
