"use strict";

/**
 * Upload Achimota Volta Heritage Experience images to Cloudinary.
 *
 * Source folder : C:\Users\gsito\Downloads\toursImg\
 * Destination   : elysium-tours/achimota/volta-heritage/
 *
 * File → role mapping:
 *   Card.png                        → coverImage
 *   Adomi Bridge.jpg                → tourHighlights[0].image  (Adomi Bridge)
 *   Dodi Princess Boat Ride.jpg     → tourHighlights[1].image  (Dodi Princess Boat Cruise)
 *   Fort Prinzenstein, Keta.png     → images[] gallery
 *   Keta Flag Planting Ceremony.jpg → images[] gallery
 *
 * Run: node scripts/seedScripts/upload-volta-heritage-images.js
 */

require("dotenv").config();

const path       = require("path");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.error("ERROR: CLOUDINARY_CLOUD_NAME not set in .env");
  process.exit(1);
}

const SOURCE_DIR = "C:\\Users\\gsito\\Downloads\\toursImg";
const FOLDER     = "elysium-tours/achimota/volta-heritage";

const FILES = [
  { file: "Card.png",                        publicId: "card",               role: "coverImage" },
  { file: "Adomi Bridge.jpg",                publicId: "adomi-bridge",       role: "tourHighlights[0].image" },
  { file: "Dodi Princess Boat Ride.jpg",     publicId: "dodi-princess",      role: "tourHighlights[1].image" },
  { file: "Fort Prinzenstein, Keta.png",     publicId: "fort-prinzenstein",  role: "images[] gallery" },
  { file: "Keta Flag Planting Ceremony.jpg", publicId: "keta-flag-planting", role: "images[] gallery" },
];

async function uploadFile({ file, publicId, role }) {
  const localPath = path.join(SOURCE_DIR, file);
  console.log(`Uploading ${file} …`);
  const result = await cloudinary.uploader.upload(localPath, {
    folder:        FOLDER,
    public_id:     publicId,
    overwrite:     true,
    resource_type: "image",
    quality:       "auto",
    fetch_format:  "auto",
  });
  return { role, file, url: result.secure_url };
}

async function main() {
  const results = [];
  for (const entry of FILES) {
    try {
      const r = await uploadFile(entry);
      results.push(r);
      console.log(`  ✓ ${r.role}: ${r.url}`);
    } catch (err) {
      console.error(`  ✗ ${entry.file}: ${err.message}`);
      results.push({ role: entry.role, file: entry.file, url: null, error: err.message });
    }
  }

  console.log("\n─── Copy these URLs into seed-achimota-tours.js Tour 3 block ─────────────\n");
  results.forEach((r) => console.log(`  ${r.role}:\n    ${r.url ?? "FAILED"}\n`));
}

main().catch((err) => {
  console.error("Upload failed:", err.message);
  process.exit(1);
});
