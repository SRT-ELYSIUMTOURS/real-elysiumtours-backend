"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const SessionSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		deviceLabel: {
			type: String,
			trim: true,
			default: "Unknown Device",
		},
		ip: {
			type: String,
			trim: true,
		},
		lastActive: {
			type: Date,
			default: Date.now,
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true,
		},
	},
	{
		timestamps: true,
		collection: "sessions",
	}
);

SessionSchema.index({ userId: 1, isActive: 1 });
SessionSchema.index({ userId: 1, lastActive: -1 });

module.exports = {
	name: "session.model",
	mixins: [DbService("sessions")],
	model: SessionSchema,

	settings: {
		fields: [
			"_id",
			"userId",
			"deviceLabel",
			"ip",
			"lastActive",
			"isActive",
			"createdAt",
			"updatedAt",
		],
	},

	actions: {
		/**
		 * Update a session by direct Mongoose query (bypasses moleculer-db field filtering).
		 */
		updateDirect: {
			visibility: "public",
			params: {
				id: "string",
				update: "object",
			},
			async handler(ctx) {
				if (!this.adapter?.model) return null;
				return this.adapter.model.findByIdAndUpdate(
					ctx.params.id,
					{ $set: ctx.params.update },
					{ new: true, lean: true }
				);
			},
		},
	},

	afterConnected() {
		this.logger.info("Session model service connected to database");
	},
};
