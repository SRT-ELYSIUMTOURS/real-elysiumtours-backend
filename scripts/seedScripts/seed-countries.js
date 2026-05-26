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

const CountrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, lowercase: true },
    flagColors: { type: [String], default: [] },
    currency: { type: String },
    languages: { type: String },
    mainAirport: { type: String },
    timeZone: { type: String },
    heroTitle: { type: String },
    heroSubtitle: { type: String },
    whyTitle: { type: String },
    whyParagraphs: { type: [String], default: [] },
    whyStats: { type: [{ label: String, value: String }], default: [] },
    whyImage: { type: String },
    whyImageTitle: { type: String },
    whyImageSubtitle: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "countries" }
);

const countries = [
  // ── Ghana ─────────────────────────────────────────────────────────────────
  {
    name: "Ghana",
    flagColors: ["#CE1126", "#FCD116", "#006B3F", "#000000"],
    currency: "Ghanaian Cedi (GHS)",
    languages: "English, Twi, Ga, Hausa, Ewe",
    mainAirport: "Kotoka International Airport",
    timeZone: "GMT+0",
    heroTitle: "Ghana — Where Africa Begins",
    heroSubtitle:
      "From the castles of Cape Coast to the canopy walks of Kakum — a land of history, warmth and ancient traditions.",
    whyTitle: "A Country That Holds Its History",
    whyParagraphs: [
      "Ghana was the first sub-Saharan African country to gain independence from colonial rule in 1957, under Kwame Nkrumah's rallying cry \"Ghana, your beloved country is free forever.\" That spirit of pride, resilience, and cultural rootedness is woven into every experience Elysium offers here.",
      "From the Ashanti Kingdom's centuries of gold and governance, to the fishing communities of the Central Coast living exactly as their ancestors did — Ghana rewards the traveler who goes slowly and pays attention.",
    ],
    whyStats: [
      { label: "Independence", value: "6th March 1957" },
      { label: "Population", value: "34 million (2024)" },
      { label: "Ethnic Groups", value: "100+ distinct groups" },
    ],
    whyImage: "/tourCountryAssets/Image-1.webp",
    whyImageTitle: "Elmina Castle, Central Region",
    whyImageSubtitle: "Built in 1482. A UNESCO World Heritage Site.",
    isActive: true,
  },

  // ── Nigeria ────────────────────────────────────────────────────────────────
  {
    name: "Nigeria",
    flagColors: ["#008751", "#FFFFFF", "#008751"],
    currency: "Nigerian Naira (NGN)",
    languages: "English, Hausa, Yoruba, Igbo",
    mainAirport: "Murtala Muhammed International Airport",
    timeZone: "GMT+1",
    heroTitle: "Nigeria — Africa's Giant Awakens",
    heroSubtitle:
      "Ancient kingdoms, a roaring creative economy and coastlines that stretch for miles — Nigeria defies every expectation.",
    whyTitle: "A Nation of Extraordinary Depth",
    whyParagraphs: [
      "Nigeria is home to over 250 ethnic groups and a culture shaped by centuries of tradition, commerce, and resilience. From the ancient walls of Kano to the vibrant art scene of Lagos, this is a country that continually surprises.",
      "Elysium's Nigeria experiences are crafted to reveal the many layers of this remarkable nation — its kingdoms, its coastlines, its food, its music, and its people.",
    ],
    whyStats: [
      { label: "Independence", value: "1st October 1960" },
      { label: "Population", value: "220 million (2024)" },
      { label: "Ethnic Groups", value: "250+ distinct groups" },
    ],
    whyImage: "/tourCountryAssets/Image-1.webp",
    whyImageTitle: "Olumo Rock, Abeokuta",
    whyImageSubtitle: "A historic fortress used during intertribal wars.",
    isActive: true,
  },

  // ── Togo ───────────────────────────────────────────────────────────────────
  {
    name: "Togo",
    flagColors: ["#006A4E", "#FFCE00", "#D21034"],
    currency: "West African CFA Franc (XOF)",
    languages: "French, Ewe, Kabiyé",
    mainAirport: "Gnassingbé Eyadéma International Airport",
    timeZone: "GMT+0",
    heroTitle: "Togo — West Africa's Best Kept Secret",
    heroSubtitle:
      "A narrow sliver of a country packed with voodoo markets, green highlands and a coastline few tourists have discovered.",
    whyTitle: "Small Country, Deep Culture",
    whyParagraphs: [
      "Togo stretches just 56km at its narrowest point, yet contains extraordinary geographic and cultural diversity — from the sandy Atlantic coast to the cool highlands of the Kpalimé plateau.",
      "The Grand Marché in Lomé and the Akodessewa Fetish Market are among the most atmospheric markets in West Africa, offering a window into living voodoo traditions that have persisted for centuries.",
    ],
    whyStats: [
      { label: "Independence", value: "27th April 1960" },
      { label: "Population", value: "9 million (2024)" },
      { label: "Ethnic Groups", value: "37 distinct groups" },
    ],
    whyImage: "/tourCountryAssets/Image-1.webp",
    whyImageTitle: "Kpalimé Highlands, Togo",
    whyImageSubtitle: "Cool, forested hills ideal for hiking and coffee farms.",
    isActive: true,
  },

  // ── Côte d'Ivoire ──────────────────────────────────────────────────────────
  {
    name: "Côte d'Ivoire",
    flagColors: ["#F77F00", "#FFFFFF", "#009A44"],
    currency: "West African CFA Franc (XOF)",
    languages: "French, Dioula, Baoulé",
    mainAirport: "Félix Houphouët-Boigny International Airport",
    timeZone: "GMT+0",
    heroTitle: "Côte d'Ivoire — Prosperity Meets Tradition",
    heroSubtitle:
      "From the basilica that rivals the Vatican to the rainforests of Taï — the Ivory Coast is a study in contrasts.",
    whyTitle: "Where Commerce and Culture Meet",
    whyParagraphs: [
      "Côte d'Ivoire is West Africa's largest economy, yet its soul is rooted in deeply traditional societies — the Akan goldworkers of Bondoukou, the Dan mask ceremonies of the west, and the fishing villages of the Ébrié Lagoon.",
      "Abidjan, its commercial capital, is a skyline-studded city with a café culture that rivals Paris — and yet an hour away, Taï National Park harbours the largest remaining primary rainforest in West Africa.",
    ],
    whyStats: [
      { label: "Independence", value: "7th August 1960" },
      { label: "Population", value: "27 million (2024)" },
      { label: "Languages", value: "60+ indigenous languages" },
    ],
    whyImage: "/tourCountryAssets/Image-1.webp",
    whyImageTitle: "Basilique Notre-Dame de la Paix, Yamoussoukro",
    whyImageSubtitle: "Largest church in the world by area.",
    isActive: true,
  },

  // ── Senegal ────────────────────────────────────────────────────────────────
  {
    name: "Senegal",
    flagColors: ["#00853F", "#FDEF42", "#E31B23"],
    currency: "West African CFA Franc (XOF)",
    languages: "French, Wolof, Pulaar, Serer",
    mainAirport: "Blaise Diagne International Airport",
    timeZone: "GMT+0",
    heroTitle: "Senegal — The Gateway to Africa",
    heroSubtitle:
      "Dakar's electric energy, the pink waters of Lac Rose and the ancient holy city of Touba — Senegal is a journey across centuries.",
    whyTitle: "Teranga — The Art of Hospitality",
    whyParagraphs: [
      "\"Teranga\" — the Wolof concept of hospitality — is not a tourism slogan here. It is a lived value, evident in how strangers are welcomed into homes, how tea is shared without occasion, and how music fills every street corner.",
      "From the colonial elegance of Saint-Louis to the mystical pink shores of Lac Retba, Senegal offers the kind of travel that changes how you see the world.",
    ],
    whyStats: [
      { label: "Independence", value: "4th April 1960" },
      { label: "Population", value: "18 million (2024)" },
      { label: "UNESCO Sites", value: "7 inscribed sites" },
    ],
    whyImage: "/tourCountryAssets/Image-1.webp",
    whyImageTitle: "Lac Retba (Pink Lake), Dakar Peninsula",
    whyImageSubtitle: "A salt lake with buoyancy rivalling the Dead Sea.",
    isActive: true,
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  let Country;
  try {
    Country = mongoose.model("Country");
  } catch (_) {
    Country = mongoose.model("Country", CountrySchema, "countries");
  }

  let inserted = 0;
  let skipped = 0;

  for (const data of countries) {
    const slug = slugify(data.name, { lower: true, strict: true });
    const existing = await Country.findOne({ slug });

    if (existing) {
      await Country.updateOne({ slug }, { $set: { ...data, slug } });
      console.log(`  UPDATE  ${data.name}`);
      skipped++;
    } else {
      await Country.create({ ...data, slug });
      console.log(`  OK    ${data.name}`);
      inserted++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Updated: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
