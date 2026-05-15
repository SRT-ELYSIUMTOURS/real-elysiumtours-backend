"use strict";

/**
 * Cleanup: delete any entities created by curl/smoke tests that have
 * "(smoke)" in their name. Idempotent — re-running on a clean DB is a no-op.
 *
 *   node scripts/seedScripts/cleanup-smoke-data.js
 *
 * Does NOT touch:
 *   - the OAA Organization or its admin user
 *   - the OAA-stamped published tour ("Achimota Centenary Tour 1 (OAA-stamped)")
 *   - any forex rates
 *   - any production users
 */

require("dotenv").config();

const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/elysium-tours";

// Collections + match expression
const TARGETS = [
	{ collection: "tourpackages", match: { title: /\(smoke\)/i } },
	{ collection: "attractions",  match: { name:  /\(smoke\)/i } },
	{ collection: "hotelpartners", match: { name: /\(smoke\)/i } },
	{ collection: "destinations", match: { name:  /\(smoke\)/i } },
];

async function main() {
	console.log(`Connecting to ${MONGO_URI} …`);
	await mongoose.connect(MONGO_URI);
	console.log("Connected.\n");

	const db = mongoose.connection.db;

	for (const t of TARGETS) {
		const coll = db.collection(t.collection);
		const matches = await coll.find(t.match).toArray();
		if (matches.length === 0) {
			console.log(`[${t.collection.padEnd(15)}] 0 matches — nothing to do.`);
			continue;
		}

		console.log(`[${t.collection.padEnd(15)}] ${matches.length} match(es):`);
		for (const m of matches) {
			console.log(`    - ${m._id}  ${m.title || m.name}`);
		}

		const result = await coll.deleteMany(t.match);
		console.log(`  → deleted ${result.deletedCount}\n`);
	}

	await mongoose.disconnect();
	console.log("Done.");
}

main().catch((err) => {
	console.error("Cleanup failed:", err.message);
	process.exit(1);
});
