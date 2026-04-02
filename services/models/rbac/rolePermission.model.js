"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const RolePermissionSchema = new mongoose.Schema(
	{
		roleId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Role",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		permissionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Permission",
			required: true,
		},
	},
	{
		timestamps: true,
		collection: "rolepermissions",
	}
);

RolePermissionSchema.index({ roleId: 1, permissionId: 1 }, { unique: true });

module.exports = {
	name: "rolePermission.model",
	mixins: [DbService("rolepermissions")],
	model: RolePermissionSchema,

	settings: {
		fields: ["_id", "roleId", "organizationId", "permissionId", "createdAt", "updatedAt"],
		entityValidator: {
			roleId: "string",
			permissionId: "string",
		},
	},

	afterConnected() {
		this.logger.info("RolePermission model service connected to database");
	},
};
