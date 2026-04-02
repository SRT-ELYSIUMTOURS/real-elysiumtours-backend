"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const ContractTemplateSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		title: {
			type: String,
			required: true,
		},
		body: {
			type: String,
			required: true,
		},
		version: {
			type: Number,
			default: 1,
		},
		variables: {
			type: [String],
			default: [],
		},
		cancellationClause: {
			type: String,
		},
		availabilityClause: {
			type: String,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
		collection: "contracttemplates",
	}
);

ContractTemplateSchema.index({ name: 1 });
ContractTemplateSchema.index({ isActive: 1 });

module.exports = {
	name: "contractTemplate.model",
	mixins: [DbService("contracttemplates")],
	model: ContractTemplateSchema,

	settings: {
		fields: [
			"_id",
			"name",
			"organizationId",
			"title",
			"body",
			"version",
			"variables",
			"cancellationClause",
			"availabilityClause",
			"isActive",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			name: "string",
			title: "string",
			body: "string",
			version: "number|optional",
			variables: "array|optional",
			cancellationClause: "string|optional",
			availabilityClause: "string|optional",
			isActive: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("ContractTemplate model service connected to database");
	},
};
