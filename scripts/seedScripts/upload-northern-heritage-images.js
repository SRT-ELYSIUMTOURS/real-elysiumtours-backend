"use strict";

/**
 * Upload Achimota Northern Heritage Expedition images to Cloudinary.
 *
 * Source folder : C:\Users\gsito\Downloads\toursImg\
 * Destination   : elysium-tours/achimota/northern-heritage/
 *
 * File → role mapping:
 *   Kintampo Waterfalls.png                    → tourHighlights[0].image
 *   Mole National Park Morning Safari.png      → tourHighlights[1].image (re-upload PNG)
 *   Red Clay Ethnographic Museum, Tamale.png   → tourHighlights[2].image
 *   Manhyia Palace, Kumasi.jpg                 → tourHighlights[3].image
 *
 * Run: node scripts/seedScripts/upload-northern-heritage-images.js
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
const FOLDER     = "elysium-tours/achimota/northern-heritage";

const FILES = [
  { file: "Kintampo Waterfalls.png",                   publicId: "kintampo-waterfalls", role: "tourHighlights[0].image" },
  { file: "Mole National Park Morning Safari.png",     publicId: "mole-safari",         role: "tourHighlights[1].image" },
  { file: "Red Clay Ethnographic Museum, Tamale.png",  publicId: "red-clay-museum",     role: "tourHighlights[2].image" },
  { file: "Manhyia Palace, Kumasi.jpg",                publicId: "manhyia-palace",      role: "tourHighlights[3].image" },
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

  console.log("\n─── URLs ────────────────────────────────────────────────────────────────\n");
  results.forEach((r) => console.log(`  ${r.role}:\n    ${r.url ?? "FAILED"}\n`));
}

main().catch((err) => {
  console.error("Upload failed:", err.message);
  process.exit(1);
});
