"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { TRANSPORT_TYPES } = require("../../../utils/constants");

const VehicleSchema = new mongoose.Schema(
	{
		providerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "TransportProvider",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		type: {
			type: String,
			enum: Object.values(TRANSPORT_TYPES),
			required: true,
		},
		capacity: {
			type: Number,
			required: true,
		},
		basePricePerDay: {
			type: Number,
			required: true,
		},
		description: {
			type: String,
		},
		isAvailable: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
		collection: "vehicles",
	}
);

VehicleSchema.index({ providerId: 1 });
VehicleSchema.index({ type: 1 });
VehicleSchema.index({ capacity: 1 });
VehicleSchema.index({ isAvailable: 1 });

module.exports = {
	name: "vehicle.model",
	mixins: [DbService("vehicles")],
	model: VehicleSchema,

	settings: {
		fields: [
			"_id",
			"providerId",
			"organizationId",
			"type",
			"capacity",
			"basePricePerDay",
			"description",
			"isAvailable",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			providerId: "string",
			type: "string",
			capacity: "number",
			basePricePerDay: "number",
			description: "string|optional",
			isAvailable: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("Vehicle model service connected to database");
	},
};
