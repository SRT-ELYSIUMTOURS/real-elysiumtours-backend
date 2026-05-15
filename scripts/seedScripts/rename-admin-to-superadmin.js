"use strict";

/**
 * One-shot: rename the legacy `admin@elysiumtours.com` user to
 * `superadmin@elysiumtours.com`, reset their password to a known value,
 * and ensure role is `super_admin`.
 *
 * Idempotent — re-running is a no-op if the user is already renamed.
 *
 *   node scripts/seedScripts/rename-admin-to-superadmin.js
 */

require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/elysium-tours";

const OLD_EMAIL = "admin@elysiumtours.com";
const NEW_EMAIL = "superadmin@elysiumtours.com";
const NEW_PASSWORD = "SuperAdmin123!";
const NEW_FIRST_NAME = "Super";
const NEW_LAST_NAME = "Admin";
const NEW_ROLE = "super_admin";

async function main() {
	console.log(`Connecting to ${MONGO_URI} …`);
	await mongoose.connect(MONGO_URI);
	console.log("Connected.");

	const users = mongoose.connection.db.collection("users");

	const target = await users.findOne({ email: OLD_EMAIL });
	if (!target) {
		const newUser = await users.findOne({ email: NEW_EMAIL });
		if (newUser) {
			console.log(`Already renamed — ${NEW_EMAIL} exists (role=${newUser.role}). No-op.`);
		} else {
			console.log(`Neither ${OLD_EMAIL} nor ${NEW_EMAIL} found. Did you seed users first?`);
		}
		await mongoose.disconnect();
		return;
	}

	const hashed = await bcrypt.hash(NEW_PASSWORD, 10);

	const update = {
		$set: {
			email: NEW_EMAIL,
			password: hashed,
			firstName: NEW_FIRST_NAME,
			lastName: NEW_LAST_NAME,
			role: NEW_ROLE,
			updatedAt: new Date(),
		},
	};

	const result = await users.updateOne({ _id: target._id }, update);
	console.log(`  matched=${result.matchedCount}  modified=${result.modifiedCount}`);
	console.log(`Renamed ${OLD_EMAIL} → ${NEW_EMAIL}`);
	console.log(`New credentials:`);
	console.log(`  email:    ${NEW_EMAIL}`);
	console.log(`  password: ${NEW_PASSWORD}`);
	console.log(`  role:     ${NEW_ROLE}`);

	await mongoose.disconnect();
}

main().catch((err) => {
	console.error("Rename failed:", err.message);
	process.exit(1);
});
