"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const PermissionSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			unique: true,
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		description: {
			type: String,
		},
		resource: {
			type: String,
		},
		action: {
			type: String,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
		collection: "permissions",
	}
);

module.exports = {
	name: "permission.model",
	mixins: [DbService("permissions")],
	model: PermissionSchema,

	settings: {
		fields: ["_id", "name", "organizationId", "description", "resource", "action", "isActive", "createdAt", "updatedAt"],
		entityValidator: {
			name: "string",
			description: "string|optional",
			resource: "string|optional",
			action: "string|optional",
			isActive: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("Permission model service connected to database");
	},
};
