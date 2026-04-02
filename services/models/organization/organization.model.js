"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const OrganizationSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		slug: { type: String, unique: true, lowercase: true },
		domain: { type: String, trim: true },
		contactEmail: { type: String, trim: true, lowercase: true },
		contactPhone: { type: String, trim: true },

		branding: {
			logoUrl: { type: String },
			brandColor: { type: String, default: "#2c3e50" },
			faviconUrl: { type: String },
		},

		subscription: {
			plan: {
				type: String,
				enum: ["free", "basic", "professional", "enterprise"],
				default: "free",
			},
			status: {
				type: String,
				enum: ["active", "trial", "expired", "cancelled"],
				default: "trial",
			},
			startDate: { type: Date, default: Date.now },
			endDate: { type: Date },
		},

		// FLEXIBLE CONFIG — accepts any JSON structure
		config: { type: mongoose.Schema.Types.Mixed, default: {} },

		status: {
			type: String,
			enum: ["active", "suspended", "trial"],
			default: "trial",
		},
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	},
	{
		timestamps: true,
		collection: "organizations",
		strict: false,
	}
);

// Indexes
OrganizationSchema.index({ slug: 1 }, { unique: true });
OrganizationSchema.index({ status: 1 });
OrganizationSchema.index({ "subscription.plan": 1 });

module.exports = {
	name: "organization.model",
	mixins: [DbService("organizations")],
	model: OrganizationSchema,

	settings: {
		fields: [
			"_id",
			"name",
			"slug",
			"domain",
			"contactEmail",
			"contactPhone",
			"branding",
			"subscription",
			"config",
			"status",
			"createdBy",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			name: "string",
			slug: "string|optional",
			domain: "string|optional",
			contactEmail: "string|optional",
			contactPhone: "string|optional",
			branding: "object|optional",
			subscription: "object|optional",
			config: "object|optional",
			status: "string|optional",
			createdBy: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("Organization model service connected to database");
	},
};
