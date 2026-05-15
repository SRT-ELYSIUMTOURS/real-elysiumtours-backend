"use strict";

require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/elysium-tours";

const SEED_USERS = [
	{
		email: "superadmin@elysiumtours.com",
		password: "SuperAdmin123!",
		firstName: "Super",
		lastName: "Admin",
		role: "super_admin",
	},
	{
		email: "staff@elysiumtours.com",
		password: "StaffPass123!",
		firstName: "Staff",
		lastName: "User",
		role: "staff",
	},
];

async function seedUsers() {
	console.log("Connecting to MongoDB...");
	await mongoose.connect(MONGO_URI);
	console.log("Connected to MongoDB.");

	const db = mongoose.connection.db;
	const collection = db.collection("users");

	for (const user of SEED_USERS) {
		const existing = await collection.findOne({ email: user.email });
		if (existing) {
			console.log(`  [skip] ${user.email} already exists (${user.role})`);
			continue;
		}

		const hashedPassword = await bcrypt.hash(user.password, 10);

		await collection.insertOne({
			email: user.email,
			password: hashedPassword,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
			status: "active",
			isVerified: true,
			phone: null,
			otp: null,
			otpExpiry: null,
			refreshTokens: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		console.log(`  [created] ${user.email} (${user.role})`);
	}

	await mongoose.disconnect();
	console.log("Done. Admin and staff users seeded.");
}

seedUsers().catch((err) => {
	console.error("Seed failed:", err.message);
	process.exit(1);
});
