"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const TemplateSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		subject: {
			type: String,
			required: true,
		},
		body: {
			type: String,
			required: true,
		},
		channel: {
			type: String,
			enum: ["email", "sms", "whatsapp", "in_app"],
			default: "email",
		},
		variables: {
			type: [String],
			default: [],
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
		collection: "templates",
	}
);

TemplateSchema.index({ name: 1 });
TemplateSchema.index({ channel: 1 });

module.exports = {
	name: "template.model",
	mixins: [DbService("templates")],
	model: TemplateSchema,

	settings: {
		fields: [
			"_id",
			"name",
			"organizationId",
			"subject",
			"body",
			"channel",
			"variables",
			"isActive",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			name: "string",
			subject: "string",
			body: "string",
			channel: "string|optional",
			variables: "array|optional",
			isActive: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("Template model service connected to database");
	},
};
