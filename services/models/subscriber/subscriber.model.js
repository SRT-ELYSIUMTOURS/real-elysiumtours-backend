"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const SubscriberSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			lowercase: true,
			trim: true,
		},
		organizationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Organization",
			index: true,
		},
		status: {
			type: String,
			enum: ["active", "unsubscribed"],
			default: "active",
		},
		subscribedAt: {
			type: Date,
			default: Date.now,
		},
		unsubscribedAt: {
			type: Date,
		},
		source: {
			type: String,
			default: "website",
		},
	},
	{
		timestamps: true,
		collection: "subscribers",
	}
);

SubscriberSchema.index(
	{ email: 1, organizationId: 1 },
	{
		unique: true,
		partialFilterExpression: { organizationId: { $exists: true } },
	}
);
SubscriberSchema.index({ email: 1 }, { unique: true });

module.exports = {
	name: "subscriber.model",
	mixins: [DbService("subscribers")],
	model: SubscriberSchema,

	settings: {
		fields: [
			"_id",
			"email",
			"organizationId",
			"status",
			"subscribedAt",
			"unsubscribedAt",
			"source",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			email: "email",
			organizationId: "string|optional",
			status: "string|optional",
			source: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("Subscriber model service connected to database");
	},
};
