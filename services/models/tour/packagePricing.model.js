"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const PackagePricingSchema = new mongoose.Schema(
	{
		packageId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "TourPackage",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		minGroupSize: {
			type: Number,
			required: true,
		},
		maxGroupSize: {
			type: Number,
			required: true,
		},
		pricePerPerson: {
			type: Number,
			required: true,
		},
		totalPrice: {
			type: Number,
		},
		currency: {
			type: String,
			default: "GHS",
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		label: {
			type: String,
		},
	},
	{
		timestamps: true,
		collection: "packagepricings",
	}
);

PackagePricingSchema.index({ packageId: 1, minGroupSize: 1 });

module.exports = {
	name: "packagePricing.model",
	mixins: [DbService("packagepricings")],
	model: PackagePricingSchema,

	settings: {
		fields: [
			"_id",
			"packageId",
			"organizationId",
			"minGroupSize",
			"maxGroupSize",
			"pricePerPerson",
			"totalPrice",
			"currency",
			"isActive",
			"label",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			packageId: "string",
			minGroupSize: "number",
			maxGroupSize: "number",
			pricePerPerson: "number",
			totalPrice: { type: "number", optional: true, convert: true },
			currency: "string|optional",
			isActive: "boolean|optional",
			label: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("PackagePricing model service connected to database");
	},
};
