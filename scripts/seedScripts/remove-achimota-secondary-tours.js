"use strict";

/**
 * Hard-delete the two Achimota Centenary tours that are being retired,
 * keeping only "Achimota Northern Heritage Expedition" live on the site.
 *
 * Backs up the full tour package documents (and any bookings/wishlist
 * entries referencing them) to a timestamped JSON file before deleting,
 * so the data can be restored if needed.
 *
 * Run: node scripts/seedScripts/remove-achimota-secondary-tours.js
 *
 * Safety: if any bookings reference either tour, the script aborts without
 * deleting anything (backup is still written) unless --force is passed.
 */

require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
	console.error("ERROR: MONGO_URI is not set in .env");
	process.exit(1);
}

const FORCE = process.argv.includes("--force");

// Titles exactly as seeded in seed-achimota-tours.js — matched via slug so
// this is resilient to any manual title edits made through the admin panel.
const TARGET_SLUGS = [
	"achimota-western-and-coastal-legacy-route",
	"achimota-volta-heritage-experience",
];

async function main() {
	console.log(`Connecting to MongoDB…`);
	await mongoose.connect(MONGO_URI);
	console.log("Connected.\n");

	const db = mongoose.connection.db;
	const tourpackages = db.collection("tourpackages");

	const docs = await tourpackages.find({ slug: { $in: TARGET_SLUGS } }).toArray();

	if (docs.length === 0) {
		console.log("No matching tour packages found — nothing to do.");
		await mongoose.disconnect();
		return;
	}

	console.log(`Found ${docs.length} tour package(s) to remove:`);
	for (const d of docs) {
		console.log(`  - ${d._id}  ${d.title}  (slug: ${d.slug})`);
	}

	const packageIds = docs.map((d) => d._id);
	const packageIdStrings = packageIds.map((id) => id.toString());

	// Check for referencing bookings/wishlist entries before doing anything
	// destructive — orphaning a real booking is worse than a blocked script.
	const bookings = await db
		.collection("bookings")
		.find({ packageId: { $in: [...packageIds, ...packageIdStrings] } })
		.toArray()
		.catch(() => []);
	const wishlists = await db
		.collection("wishlists")
		.find({ tourId: { $in: [...packageIds, ...packageIdStrings] } })
		.toArray()
		.catch(() => []);

	console.log(`\nReferences found — bookings: ${bookings.length}, wishlist entries: ${wishlists.length}`);

	// ── Backup ──────────────────────────────────────────────────────────────
	const backupDir = path.join(__dirname, "backups");
	fs.mkdirSync(backupDir, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupPath = path.join(backupDir, `achimota-secondary-tours-${stamp}.json`);

	fs.writeFileSync(
		backupPath,
		JSON.stringify({ backedUpAt: new Date().toISOString(), tourPackages: docs, bookings, wishlists }, null, 2)
	);
	console.log(`\nBackup written: ${backupPath}`);

	if (bookings.length > 0 && !FORCE) {
		console.log(
			`\nABORTED: ${bookings.length} booking(s) reference these tours. Re-run with --force to delete anyway (bookings will be orphaned).`
		);
		await mongoose.disconnect();
		return;
	}

	// ── Delete ──────────────────────────────────────────────────────────────
	const result = await tourpackages.deleteMany({ _id: { $in: packageIds } });
	console.log(`\nDeleted ${result.deletedCount} tour package(s).`);

	await mongoose.disconnect();
	console.log("Done.");
}

main().catch((err) => {
	console.error("Removal failed:", err.message);
	mongoose.disconnect();
	process.exit(1);
});
