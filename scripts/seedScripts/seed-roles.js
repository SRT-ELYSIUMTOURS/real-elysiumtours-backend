"use strict";

require("dotenv").config();

const mongoose = require("mongoose");
const roles = require("../../config/roles.config");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/elysium-tours";

async function seedRoles() {
	console.log("Connecting to MongoDB...");
	await mongoose.connect(MONGO_URI);
	console.log("Connected to MongoDB.");

	const db = mongoose.connection.db;
	const collection = db.collection("roles");

	const roleEntries = Object.values(roles);

	for (const role of roleEntries) {
		const result = await collection.findOneAndUpdate(
			{ name: role.name },
			{
				$set: {
					name: role.name,
					description: role.description,
					isDefault: role.isDefault || false,
					isActive: true,
				},
				$setOnInsert: {
					createdAt: new Date(),
				},
				$currentDate: {
					updatedAt: true,
				},
			},
			{ upsert: true, returnDocument: "after" }
		);

		const doc = result.value || result;
		console.log(`Role "${role.name}" upserted — _id: ${doc._id}`);
	}

	console.log(`\nSeeded ${roleEntries.length} roles successfully.`);
	await mongoose.disconnect();
	console.log("Disconnected from MongoDB.");
}

seedRoles().catch((err) => {
	console.error("Error seeding roles:", err);
	mongoose.disconnect();
	process.exit(1);
});
