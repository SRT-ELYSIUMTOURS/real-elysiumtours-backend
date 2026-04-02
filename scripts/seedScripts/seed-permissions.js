"use strict";

require("dotenv").config();

const mongoose = require("mongoose");
const permissions = require("../../config/permissions.config");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/elysium-tours";

async function seedPermissions() {
	console.log("Connecting to MongoDB...");
	await mongoose.connect(MONGO_URI);
	console.log("Connected to MongoDB.");

	const db = mongoose.connection.db;
	const permissionsCollection = db.collection("permissions");
	const rolesCollection = db.collection("roles");
	const rolePermissionsCollection = db.collection("rolepermissions");

	// Load all roles from the database
	const roleDocs = await rolesCollection.find({}).toArray();
	const roleMap = {};
	for (const role of roleDocs) {
		roleMap[role.name] = role._id;
	}

	console.log(`Found ${roleDocs.length} roles in database: ${Object.keys(roleMap).join(", ")}`);

	if (roleDocs.length === 0) {
		console.error("No roles found. Please run seed:roles first.");
		await mongoose.disconnect();
		process.exit(1);
	}

	const permissionEntries = Object.entries(permissions);
	let permissionsSeeded = 0;
	let rolePermissionsSeeded = 0;

	for (const [permName, config] of permissionEntries) {
		// Parse resource and action from permission name (e.g., "auth.register" -> resource: "auth", action: "register")
		const parts = permName.split(".");
		const resource = parts[0] || "";
		const action = parts[1] || "";

		// Upsert the permission
		const permResult = await permissionsCollection.findOneAndUpdate(
			{ name: permName },
			{
				$set: {
					name: permName,
					description: config.description,
					resource,
					action,
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

		const permDoc = permResult.value || permResult;
		permissionsSeeded++;

		// Create rolePermission entries for each role that has this permission
		if (config.roles && Array.isArray(config.roles)) {
			for (const roleName of config.roles) {
				const roleId = roleMap[roleName];
				if (!roleId) {
					console.warn(`  Warning: Role "${roleName}" not found — skipping for "${permName}".`);
					continue;
				}

				await rolePermissionsCollection.findOneAndUpdate(
					{
						roleId: roleId,
						permissionId: permDoc._id,
					},
					{
						$set: {
							roleId: roleId,
							permissionId: permDoc._id,
						},
						$setOnInsert: {
							createdAt: new Date(),
						},
						$currentDate: {
							updatedAt: true,
						},
					},
					{ upsert: true }
				);

				rolePermissionsSeeded++;
			}
		}

		console.log(`Permission "${permName}" upserted — roles: [${(config.roles || []).join(", ")}]`);
	}

	console.log(`\nSeeded ${permissionsSeeded} permissions and ${rolePermissionsSeeded} role-permission mappings.`);
	await mongoose.disconnect();
	console.log("Disconnected from MongoDB.");
}

seedPermissions().catch((err) => {
	console.error("Error seeding permissions:", err);
	mongoose.disconnect();
	process.exit(1);
});
