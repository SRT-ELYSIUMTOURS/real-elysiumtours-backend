"use strict";

require("dotenv").config();

const mongoose = require("mongoose");
const slugify = require("slugify");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/elysium-tours";

const destinations = [
	{
		name: "Accra",
		region: "Greater Accra Region",
		description:
			"The vibrant capital city of Ghana, known for its bustling markets, lively nightlife, and beautiful coastline.",
		highlights: ["Urban", "Beach", "Nightlife"],
		gpsCoords: { lat: 5.6037, lng: -0.187 },
		isActive: true,
	},
	{
		name: "Cape Coast",
		region: "Central Region",
		description:
			"A historic coastal city famous for its castle, a UNESCO World Heritage Site, and beautiful beaches.",
		highlights: ["Historical", "Beach", "Castle"],
		gpsCoords: { lat: 5.1036, lng: -1.2467 },
		isActive: true,
	},
	{
		name: "Kumasi",
		region: "Ashanti Region",
		description:
			"The cultural heart of the Ashanti Kingdom, renowned for the Kejetia Market and Manhyia Palace.",
		highlights: ["Cultural", "Markets", "Palace"],
		gpsCoords: { lat: 6.6884, lng: -1.6244 },
		isActive: true,
	},
	{
		name: "Tamale",
		region: "Northern Region",
		description:
			"The gateway to northern Ghana, rich in cultural heritage and savanna landscapes.",
		highlights: ["Cultural", "Savanna", "Wildlife"],
		gpsCoords: { lat: 9.4034, lng: -0.8393 },
		isActive: true,
	},
	{
		name: "Mole National Park",
		region: "Savannah Region",
		description:
			"Ghana's largest wildlife refuge, home to elephants, antelopes, and over 300 bird species.",
		highlights: ["Wildlife", "Safari", "Nature"],
		gpsCoords: { lat: 9.2667, lng: -1.85 },
		isActive: true,
	},
	{
		name: "Elmina",
		region: "Central Region",
		description:
			"One of the oldest European settlements in sub-Saharan Africa, known for Elmina Castle and its fishing harbour.",
		highlights: ["Historical", "Fishing", "Castle"],
		gpsCoords: { lat: 5.0847, lng: -1.3484 },
		isActive: true,
	},
	{
		name: "Ada Foah",
		region: "Greater Accra Region",
		description:
			"A serene beach town at the Volta River estuary, popular for water sports and weekend getaways.",
		highlights: ["Beach", "Water Sports", "Estuary"],
		gpsCoords: { lat: 5.7833, lng: 0.6333 },
		isActive: true,
	},
	{
		name: "Kakum National Park",
		region: "Central Region",
		description:
			"A tropical rainforest park famous for its canopy walkway, one of only three such structures in Africa.",
		highlights: ["Nature", "Canopy Walk", "Rainforest"],
		gpsCoords: { lat: 5.35, lng: -1.3833 },
		isActive: true,
	},
];

async function seed() {
	try {
		console.log("Connecting to MongoDB...");
		await mongoose.connect(MONGO_URI);
		console.log("Connected to MongoDB.");

		const db = mongoose.connection.db;
		const collection = db.collection("destinations");

		// Generate slugs for each destination
		const docs = destinations.map((dest) => ({
			...dest,
			slug: slugify(dest.name, { lower: true, strict: true }),
			images: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		}));

		// Clear existing destinations
		await collection.deleteMany({});
		console.log("Cleared existing destinations.");

		// Insert seed data
		const result = await collection.insertMany(docs);
		console.log(`Successfully seeded ${result.insertedCount} destinations.`);

		await mongoose.disconnect();
		console.log("Disconnected from MongoDB.");
		process.exit(0);
	} catch (error) {
		console.error("Seed error:", error.message);
		await mongoose.disconnect().catch(() => {});
		process.exit(1);
	}
}

seed();
