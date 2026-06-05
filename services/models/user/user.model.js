"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");
const { USER_ROLES } = require("../../../utils/constants");

const UserSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			unique: true,
			required: true,
			lowercase: true,
			trim: true,
		},
		organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
		password: {
			type: String,
			required: true,
		},
		firstName: {
			type: String,
			required: true,
			trim: true,
		},
		lastName: {
			type: String,
			required: true,
			trim: true,
		},
		phone: {
			type: String,
			trim: true,
		},
		avatar: {
			type: String,
		},
		nationality: {
			type: String,
			trim: true,
		},
		dateOfBirth: {
			type: String,
			trim: true,
		},
		tourTypes: [{
			type: String,
			trim: true,
		}],
		groupSize: {
			type: String,
			trim: true,
		},
		language: {
			type: String,
			trim: true,
		},
		location: {
			type: String,
			trim: true,
		},
		wishlist: [{
			type: mongoose.Schema.Types.ObjectId,
			ref: "TourPackage",
		}],
		notificationPreferences: {
			emailPayment:     { type: Boolean, default: true  },
			whatsappBooking:  { type: Boolean, default: true  },
			tourConfirmation: { type: Boolean, default: true  },
			contractSigning:  { type: Boolean, default: false },
			wishlistDrop:     { type: Boolean, default: true  },
			marketing:        { type: Boolean, default: false },
		},
		role: {
			type: String,
			enum: Object.values(USER_ROLES),
			default: USER_ROLES.CUSTOMER,
		},
		isVerified: {
			type: Boolean,
			default: false,
		},
		status: {
			type: String,
			enum: ["active", "inactive", "suspended"],
			default: "active",
		},
		lastLogin: {
			type: Date,
		},
		otp: {
			type: String,
		},
		otpExpiry: {
			type: Date,
		},
		refreshToken: {
			type: String,
		},
		resetPasswordToken: {
			type: String,
		},
		resetPasswordExpiry: {
			type: Date,
		},
	},
	{
		timestamps: true,
		collection: "users",
	}
);

// Indexes (email unique index is already created by `unique: true` on the field)
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ email: 1, organizationId: 1 }, { unique: true, partialFilterExpression: { organizationId: { $exists: true } } });

module.exports = {
	name: "user.model",
	mixins: [DbService("users")],
	model: UserSchema,

	settings: {
		// Exclude sensitive fields from API responses
		fields: [
			"_id",
			"email",
			"organizationId",
			"firstName",
			"lastName",
			"phone",
			"avatar",
			"role",
			"isVerified",
			"status",
			"lastLogin",
			"nationality",
			"dateOfBirth",
			"tourTypes",
			"groupSize",
			"language",
			"location",
			"wishlist",
			"notificationPreferences",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			email: "email",
			password: "string",
			firstName: "string",
			lastName: "string",
			phone: "string|optional",
			avatar: "string|optional",
			role: { type: "enum", values: Object.values(USER_ROLES), optional: true },
			isVerified: "boolean|optional",
			status: { type: "enum", values: ["active", "inactive", "suspended"], optional: true },
		},
	},

	actions: {
		/**
		 * Find user including sensitive fields (password, otp, refreshToken).
		 * Bypasses the fields filter. For internal use only (auth service).
		 */
		findWithSensitive: {
			visibility: "public",
			params: {
				query: "object",
			},
			async handler(ctx) {
				if (!this.adapter || !this.adapter.model) return null;
				const doc = await this.adapter.model.findOne(ctx.params.query).lean();
				return doc || null;
			},
		},

		/**
		 * Update user by direct Mongoose query (bypasses moleculer-db field filtering).
		 */
		updateDirect: {
			visibility: "public",
			params: {
				id: "string",
				update: "object",
			},
			async handler(ctx) {
				if (!this.adapter || !this.adapter.model) return null;
				const doc = await this.adapter.model.findByIdAndUpdate(
					ctx.params.id,
					{ $set: ctx.params.update },
					{ new: true, lean: true }
				);
				return doc || null;
			},
		},
	},

	afterConnected() {
		this.logger.info("User model service connected to database");
	},
};
