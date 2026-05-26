"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const PartnerApplicationSchema = new mongoose.Schema(
	{
		partnerType: { type: String, required: true, trim: true },
		businessName: { type: String, required: true, trim: true },
		country: { type: String, required: true, trim: true },
		yearsOperating: { type: String, required: true },
		monthlyCapacity: { type: String, required: true },
		website: { type: String, trim: true },
		registrationNumber: { type: String, trim: true },
		servicesDescription: { type: String, required: true },
		firstName: { type: String, required: true, trim: true },
		lastName: { type: String, required: true, trim: true },
		businessEmail: { type: String, required: true, trim: true, lowercase: true },
		phone: { type: String, required: true, trim: true },
		roleTitle: { type: String, trim: true },
		preferredContact: { type: String },
		status: {
			type: String,
			enum: ["pending", "reviewed", "approved", "rejected"],
			default: "pending",
		},
	},
	{ timestamps: true, collection: "partnerapplications" }
);

PartnerApplicationSchema.index({ status: 1 });
PartnerApplicationSchema.index({ businessEmail: 1 });

module.exports = {
	name: "partnerApplication.model",
	mixins: [DbService("partnerapplications")],
	model: PartnerApplicationSchema,

	settings: {
		fields: [
			"_id",
			"partnerType",
			"businessName",
			"country",
			"yearsOperating",
			"monthlyCapacity",
			"website",
			"registrationNumber",
			"servicesDescription",
			"firstName",
			"lastName",
			"businessEmail",
			"phone",
			"roleTitle",
			"preferredContact",
			"status",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			partnerType: "string",
			businessName: "string",
			country: "string",
			yearsOperating: "string",
			monthlyCapacity: "string",
			website: "string|optional",
			registrationNumber: "string|optional",
			servicesDescription: "string",
			firstName: "string",
			lastName: "string",
			businessEmail: "string",
			phone: "string",
			roleTitle: "string|optional",
			preferredContact: "string|optional",
			status: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("PartnerApplication model service connected to database");
	},
};
