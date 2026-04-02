"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { USER_ROLES } = require("../../../utils/constants");

const RoleSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			unique: true,
			required: true,
			enum: Object.values(USER_ROLES),
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		description: {
			type: String,
		},
		isDefault: {
			type: Boolean,
			default: false,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
		collection: "roles",
	}
);

module.exports = {
	name: "role.model",
	mixins: [DbService("roles")],
	model: RoleSchema,

	settings: {
		fields: ["_id", "name", "organizationId", "description", "isDefault", "isActive", "createdAt", "updatedAt"],
		entityValidator: {
			name: "string",
			description: "string|optional",
			isDefault: "boolean|optional",
			isActive: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("Role model service connected to database");
	},
};
