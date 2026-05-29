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
];

// Shared connection promise — ensures a single mongoose.connect() call
let connectionPromise = null;

function ensureConnected() {
	if (!connectionPromise) {
		const uri = process.env.MONGO_URI || "mongodb://localhost:27017/elysium-tours";
		connectionPromise = mongoose.connect(uri);
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
