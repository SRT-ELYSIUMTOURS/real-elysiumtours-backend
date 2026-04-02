"use strict";
const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const WaitlistEntrySchema = new mongoose.Schema({
	tourPackageId: { type: mongoose.Schema.Types.ObjectId, ref: "TourPackage", required: true },
	customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
	groupSize: { type: Number, required: true, min: 1 },
	preferredDate: { type: Date },
	status: {
		type: String,
		enum: ["waiting", "offered", "accepted", "expired", "cancelled"],
		default: "waiting",
	},
	position: { type: Number },
	offeredAt: { type: Date },
	expiresAt: { type: Date },
	notes: { type: String },
}, { timestamps: true, collection: "waitlistentries" });

WaitlistEntrySchema.index({ tourPackageId: 1, position: 1 });
WaitlistEntrySchema.index({ tourPackageId: 1, status: 1 });
WaitlistEntrySchema.index({ customerId: 1 });
WaitlistEntrySchema.index({ status: 1, expiresAt: 1 });

module.exports = {
	name: "waitlistEntry.model",
	mixins: [DbService("waitlistentries")],
	model: WaitlistEntrySchema,
	settings: {
		fields: ["_id", "tourPackageId", "customerId", "organizationId", "groupSize", "preferredDate", "status", "position", "offeredAt", "expiresAt", "notes", "createdAt", "updatedAt"],
		entityValidator: {
			tourPackageId: "string",
			customerId: "string",
			groupSize: "number|min:1",
		},
	},
};
