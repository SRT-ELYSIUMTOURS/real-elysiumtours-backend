"use strict";

require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const slugify = require("slugify");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("ERROR: MONGO_URI is not set in .env");
  process.exit(1);
}

// coverImage URLs: replace with your Cloudinary URLs when available.
// Using Unsplash CDN images as placeholders — these are reliable public URLs.
const destinations = [
  // ── Ghana ─────────────────────────────────────────────────────────────────
  {
    name: "Accra",
    country: "Ghana",
    region: "Greater Accra Region",
    subtitle: "Ghana's vibrant capital on the Atlantic coast",
    description:
      "The vibrant capital city of Ghana, known for its bustling markets, lively nightlife, and beautiful coastline.",
    highlights: ["Urban", "Beach", "Nightlife", "Markets"],
    gpsCoords: { lat: 5.6037, lng: -0.187 },
    coverImage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&q=80",
    ],
    bestTimeToVisit: "November to March",
    weather: { avgTemp: 28, rainyMonths: ["April", "May", "June", "October"], bestMonths: ["November", "December", "January", "February"] },
    isActive: true,
  },
  {
    name: "Cape Coast",
    country: "Ghana",
    region: "Central Region",
    subtitle: "History, castles and coastline",
    description:
      "A historic coastal city famous for its UNESCO World Heritage castle and beautiful beaches.",
    highlights: ["Historical", "Beach", "Castle", "Heritage"],
    gpsCoords: { lat: 5.1036, lng: -1.2467 },
    coverImage: "https://images.unsplash.com/photo-1580502304784-8985b7eb7260?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1580502304784-8985b7eb7260?w=800&q=80",
    ],
    bestTimeToVisit: "November to March",
    weather: { avgTemp: 27, rainyMonths: ["April", "May", "June", "October"], bestMonths: ["November", "December", "January"] },
    isActive: true,
  },
  {
    name: "Kumasi",
    country: "Ghana",
    region: "Ashanti Region",
    subtitle: "Cultural heart of the Ashanti Kingdom",
    description:
      "The cultural heart of the Ashanti Kingdom, renowned for the Kejetia Market and Manhyia Palace.",
    highlights: ["Cultural", "Markets", "Palace", "Crafts"],
    gpsCoords: { lat: 6.6884, lng: -1.6244 },
    coverImage: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    ],
    bestTimeToVisit: "November to February",
    weather: { avgTemp: 26, rainyMonths: ["April", "May", "June", "September", "October"], bestMonths: ["November", "December", "January"] },
    isActive: true,
  },
  {
    name: "Tamale",
    country: "Ghana",
    region: "Northern Region",
    subtitle: "Gateway to northern Ghana",
    description:
      "The gateway to northern Ghana, rich in cultural heritage and savanna landscapes.",
    highlights: ["Cultural", "Savanna", "Wildlife", "Festivals"],
    gpsCoords: { lat: 9.4034, lng: -0.8393 },
    coverImage: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80",
    ],
    bestTimeToVisit: "October to April",
    weather: { avgTemp: 30, rainyMonths: ["June", "July", "August", "September"], bestMonths: ["November", "December", "January", "February"] },
    isActive: true,
  },
  {
    name: "Mole National Park",
    country: "Ghana",
    region: "Savannah Region",
    subtitle: "Ghana's premier wildlife sanctuary",
    description:
      "Ghana's largest wildlife refuge, home to elephants, antelopes, and over 300 bird species.",
    highlights: ["Wildlife", "Safari", "Nature", "Elephants"],
    gpsCoords: { lat: 9.2667, lng: -1.85 },
    coverImage: "https://images.unsplash.com/photo-1551731409-43eb3e517a1a?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1551731409-43eb3e517a1a?w=800&q=80",
    ],
    bestTimeToVisit: "December to April",
    weather: { avgTemp: 31, rainyMonths: ["June", "July", "August", "September"], bestMonths: ["December", "January", "February", "March"] },
    isActive: true,
  },
  {
    name: "Elmina",
    country: "Ghana",
    region: "Central Region",
    subtitle: "West Africa's oldest European settlement",
    description:
      "One of the oldest European settlements in sub-Saharan Africa, known for Elmina Castle and its fishing harbour.",
    highlights: ["Historical", "Fishing", "Castle", "Heritage"],
    gpsCoords: { lat: 5.0847, lng: -1.3484 },
    coverImage: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
    ],
    bestTimeToVisit: "November to March",
    weather: { avgTemp: 27, rainyMonths: ["April", "May", "June", "October"], bestMonths: ["November", "December", "January"] },
    isActive: true,
  },
  {
    name: "Ada Foah",
    country: "Ghana",
    region: "Greater Accra Region",
    subtitle: "Where the Volta meets the sea",
    description:
      "A serene beach town at the Volta River estuary, popular for water sports and weekend getaways.",
    highlights: ["Beach", "Water Sports", "Estuary", "Relaxation"],
    gpsCoords: { lat: 5.7833, lng: 0.6333 },
    coverImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    ],
    bestTimeToVisit: "November to March",
    weather: { avgTemp: 28, rainyMonths: ["April", "May", "June", "October"], bestMonths: ["November", "December", "January"] },
    isActive: true,
  },
  {
    name: "Kakum National Park",
    country: "Ghana",
    region: "Central Region",
    subtitle: "Rainforest canopy walks above the treetops",
    description:
      "A tropical rainforest park famous for its canopy walkway, one of only three such structures in Africa.",
    highlights: ["Nature", "Canopy Walk", "Rainforest", "Birdwatching"],
    gpsCoords: { lat: 5.35, lng: -1.3833 },
    coverImage: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80",
    ],
    bestTimeToVisit: "November to March",
    weather: { avgTemp: 27, rainyMonths: ["April", "May", "June", "October"], bestMonths: ["November", "December", "January"] },
    isActive: true,
  },

  // ── Togo ──────────────────────────────────────────────────────────────────
  {
    name: "Lomé",
    country: "Togo",
    region: "Maritime Region",
    subtitle: "Togo's coastal capital city",
    description:
      "Lomé is the capital and largest city of Togo, a bustling port city known for its grand market, voodoo culture, and Atlantic beaches.",
    highlights: ["Urban", "Beach", "Markets", "Culture"],
    gpsCoords: { lat: 6.1375, lng: 1.2123 },
    coverImage: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&q=80",
    ],
    bestTimeToVisit: "November to February",
    weather: { avgTemp: 28, rainyMonths: ["April", "May", "October"], bestMonths: ["November", "December", "January", "February"] },
    isActive: true,
  },
  {
    name: "Kpalimé",
    country: "Togo",
    region: "Plateaux Region",
    subtitle: "Togo's green highlands and waterfalls",
    description:
      "A scenic highland town surrounded by mountains, waterfalls, and lush rainforest — a popular hiking destination in West Africa.",
    highlights: ["Hiking", "Nature", "Waterfalls", "Mountains"],
    gpsCoords: { lat: 6.9, lng: 0.6333 },
    coverImage: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    ],
    bestTimeToVisit: "November to February",
    weather: { avgTemp: 25, rainyMonths: ["April", "May", "June", "September", "October"], bestMonths: ["November", "December", "January"] },
    isActive: true,
  },

  // ── Côte d'Ivoire ─────────────────────────────────────────────────────────
  {
    name: "Abidjan",
    country: "Côte d'Ivoire",
    region: "Lagunes District",
    subtitle: "The cosmopolitan economic capital",
    description:
      "West Africa's most cosmopolitan city, a modern skyline rising alongside lagoons, with world-class restaurants and a thriving arts scene.",
    highlights: ["Urban", "Nightlife", "Culture", "Architecture"],
    gpsCoords: { lat: 5.3599, lng: -4.0082 },
    coverImage: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80",
    ],
    bestTimeToVisit: "December to March",
    weather: { avgTemp: 27, rainyMonths: ["April", "May", "June", "October", "November"], bestMonths: ["December", "January", "February", "March"] },
    isActive: true,
  },

  // ── Senegal ───────────────────────────────────────────────────────────────
  {
    name: "Dakar",
    country: "Senegal",
    region: "Dakar Region",
    subtitle: "West Africa's westernmost capital",
    description:
      "Perched on the Atlantic tip of Africa, Dakar blends French colonial elegance with vibrant Wolof culture, music, and some of the best seafood on the continent.",
    highlights: ["Urban", "Culture", "Music", "Beach"],
    gpsCoords: { lat: 14.7167, lng: -17.4677 },
    coverImage: "https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=800&q=80",
    ],
    bestTimeToVisit: "November to May",
    weather: { avgTemp: 26, rainyMonths: ["July", "August", "September"], bestMonths: ["November", "December", "January", "February", "March"] },
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

    const docs = destinations.map((dest) => ({
      ...dest,
      slug: slugify(dest.name, { lower: true, strict: true }),
      travelTips: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await collection.deleteMany({});
    console.log("Cleared existing destinations.");

    const result = await collection.insertMany(docs);
    console.log(`Successfully seeded ${result.insertedCount} destinations.`);

    // Summary by country
    const byCountry = docs.reduce((acc, d) => {
      acc[d.country] = (acc[d.country] || 0) + 1;
      return acc;
    }, {});
    console.log("Breakdown by country:", byCountry);

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
