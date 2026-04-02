"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { NOTIFICATION_CHANNELS } = require("../../../utils/constants");

const NotificationSchema = new mongoose.Schema(
	{
		recipientId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		type: {
			type: String,
			required: true,
		},
		channel: {
			type: String,
			enum: Object.values(NOTIFICATION_CHANNELS),
			default: NOTIFICATION_CHANNELS.IN_APP,
		},
		title: {
			type: String,
			required: true,
		},
		message: {
			type: String,
			required: true,
		},
		data: {
			type: mongoose.Schema.Types.Mixed,
		},
		isRead: {
			type: Boolean,
			default: false,
		},
		readAt: {
			type: Date,
		},
		sentAt: {
			type: Date,
		},
		deliveryStatus: {
			type: String,
			enum: ["pending", "sent", "delivered", "failed"],
			default: "pending",
		},
		failureReason: {
			type: String,
		},
	},
	{
		timestamps: true,
		collection: "notifications",
	}
);

NotificationSchema.index({ recipientId: 1, isRead: 1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ channel: 1 });

module.exports = {
	name: "notification.model",
	mixins: [DbService("notifications")],
	model: NotificationSchema,

	settings: {
		fields: [
			"_id",
			"recipientId",
			"organizationId",
			"type",
			"channel",
			"title",
			"message",
			"data",
			"isRead",
			"readAt",
			"sentAt",
			"deliveryStatus",
			"failureReason",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			recipientId: "string",
			type: "string",
			channel: "string|optional",
			title: "string",
			message: "string",
			data: "object|optional",
			isRead: "boolean|optional",
			readAt: "date|optional",
			sentAt: "date|optional",
			deliveryStatus: "string|optional",
			failureReason: "string|optional",
		},
	},

	afterConnected() {
		this.logger.info("Notification model service connected to database");
	},
};
