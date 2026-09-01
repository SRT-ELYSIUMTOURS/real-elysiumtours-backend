"use strict";

const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const mongoose = require("mongoose");

const MONGOOSE_COLLECTIONS = [
	"users",
	"roles",
	"permissions",
	"rolepermissions",
	"tourpackages",
	"packagepricings",
	"tourrequests",
	"quotes",
	"bookings",
	"payments",
	"hotelpartners",
	"transportproviders",
	"vehicles",
	"attractions",
	"diningpartners",
	"destinations",
	"contracts",
	"contracttemplates",
	"paymentplans",
	"milestones",
	"interests",
	"notifications",
	"templates",
	"organizations",
	"reviews",
	"subscribers",
	"waitlistentries",
	"galleryitems",
	"tourguides",
	"forexrates",
	"countries",
	"partnerapplications",
	"photographerpartners",
	"servicepartners",
	"blogs",
	"sessions",
];

// ─── Connection options ───────────────────────────────────────────────────────
// MongoDB Atlas sits outside the hosting platform, so ALL database traffic is
// billed egress. With driver defaults this service burned ~5 GB/month, most of
// it while completely idle. These options address that directly:
//
//   compressors            Wire-protocol compression. zlib ships with Node (no
//                          extra dependency) and typically cuts payloads well
//                          over half. Biggest single saving. Costs a little CPU.
//   heartbeatFrequencyMS   The driver pings EVERY replica-set node on this
//                          interval, forever, even with zero traffic. The 10s
//                          default means ~780k pings/month against a 3-node
//                          Atlas cluster. 60s cuts that ~6x. Trade-off: slightly
//                          slower failover detection, which is fine for a
//                          single-region deployment.
//   maxPoolSize            Default is 100 — far more than this service needs.
//                          Each pooled connection adds monitoring traffic and a
//                          TLS handshake.
//   autoIndex              Mongoose re-issues createIndexes for every model on
//                          every boot. Wasteful on a platform that cold-starts;
//                          indexes belong in a migration/seed step. Left ON
//                          outside production so local/test still self-heal.
//
// All tunable via env so production can be adjusted without a code change.
const num = (value, fallback) => {
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
};

function buildConnectionOptions() {
	return {
		compressors: process.env.MONGO_COMPRESSORS || "zlib",
		zlibCompressionLevel: num(process.env.MONGO_ZLIB_LEVEL, 6),
		heartbeatFrequencyMS: num(process.env.MONGO_HEARTBEAT_MS, 60000),
		maxPoolSize: num(process.env.MONGO_MAX_POOL, 10),
		minPoolSize: num(process.env.MONGO_MIN_POOL, 0),
		autoIndex: process.env.MONGO_AUTO_INDEX
			? process.env.MONGO_AUTO_INDEX === "true"
			: process.env.NODE_ENV !== "production",
	};
}

// Shared connection promise — ensures a single mongoose.connect() call
let connectionPromise = null;

function ensureConnected() {
	if (!connectionPromise) {
		const uri = process.env.MONGO_URI || "mongodb://localhost:27017/elysium-tours";
		connectionPromise = mongoose.connect(uri, buildConnectionOptions());
	}
	return connectionPromise;
}

/**
 * Factory function returning a Moleculer DbService mixin.
 *
 * Overrides the MongooseAdapter's connect() to fix compatibility
 * with moleculer-db-adapter-mongoose@0.11 + Mongoose 8 (Atlas).
 */
module.exports = function (collection) {
	const isMongooseCollection = MONGOOSE_COLLECTIONS.includes(collection);

	if (isMongooseCollection) {
		const uri = process.env.MONGO_URI || "mongodb://localhost:27017/elysium-tours";
		const adapter = new MongooseAdapter(uri);

		// Fully replace the adapter's connect to work with Mongoose 8
		adapter.connect = async function () {
			await ensureConnected();

			this.conn = mongoose.connection;
			this.db = mongoose.connection.db;

			// Wait for db if not ready yet (Atlas cold start)
			if (!this.db) {
				await new Promise((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error("DB not ready after 10s")), 10000);
					const check = () => {
						if (mongoose.connection.db) {
							clearTimeout(timeout);
							this.db = mongoose.connection.db;
							resolve();
						} else {
							setTimeout(check, 100);
						}
					};
					check();
				});
			}

			// Resolve the model from service schema
			const svcSchema = this.service.schema;
			if (svcSchema.model) {
				const modelDef = svcSchema.model;
				// Check if it's a compiled Mongoose model or a raw schema
				if (modelDef.modelName && typeof modelDef.find === "function") {
					// It's already a compiled model
					this.model = modelDef;
				} else if (modelDef instanceof mongoose.Schema) {
					// It's a raw schema — derive modelName from service name
					const name = this.service.name.replace(".model", "");
					const modelName = name.charAt(0).toUpperCase() + name.slice(1);
					try {
						this.model = mongoose.model(modelName);
					} catch (e) {
						this.model = mongoose.model(modelName, modelDef, collection);
					}
				}
			} else if (svcSchema.schema && svcSchema.modelName) {
				try {
					this.model = mongoose.model(svcSchema.modelName);
				} catch (e) {
					this.model = mongoose.model(svcSchema.modelName, svcSchema.schema, collection);
				}
			}

			this.service.logger.info("MongoDB adapter connected successfully.");
		};

		return {
			mixins: [DbService],
			adapter,
			settings: {
				pageSize: 10,
				maxPageSize: 100,
				collectionName: collection,
				entityValidator: {},
			},
		};
	}

	return {
		mixins: [DbService],
		settings: {
			pageSize: 10,
			maxPageSize: 100,
			collectionName: collection,
			entityValidator: {},
		},
		methods: {
			afterConnected() {
				this.logger.info(`Connected — collection: "${collection}" (Default/NeDB)`);
			},
		},
	};
};

module.exports.MONGOOSE_COLLECTIONS = MONGOOSE_COLLECTIONS;
module.exports.ensureConnected = ensureConnected;
// Exported so the bandwidth-guard test can assert the egress-reducing options
// are actually applied (see tests/unit/mixins/dbConnectionOptions.test.js).
module.exports.buildConnectionOptions = buildConnectionOptions;
