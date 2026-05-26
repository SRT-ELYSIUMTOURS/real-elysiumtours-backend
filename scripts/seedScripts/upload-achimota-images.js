"use strict";

/**
 * Upload Achimota Northern Heritage Expedition images to Cloudinary.
 *
 * Source folder : C:\Users\gsito\Downloads\toursImg\
 * Destination   : elysium-tours/achimota/northern-heritage/
 *
 * Expected files (rename if yours differ):
 *   Card.png   → coverImage  (card thumbnail)
 *   Hero1.png  → heroMainImage + images[0]
 *   Hero2.jpg  → images[1]
 *   Hero3.png  → images[2]
 *   Hero4.png  → images[3]
 *
 * Run: node scripts/seedScripts/upload-achimota-images.js
 *
 * Paste the printed URLs into seed-achimota-tours.js Tour 1 block.
 */

require("dotenv").config();

const path      = require("path");
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
  { file: "Card.png",  publicId: "card",  role: "coverImage" },
  { file: "Hero1.png", publicId: "hero1", role: "heroMainImage / images[0]" },
  { file: "Hero2.jpg", publicId: "hero2", role: "images[1]" },
  { file: "Hero3.png", publicId: "hero3", role: "images[2]" },
  { file: "Hero4.png", publicId: "hero4", role: "images[3]" },
];

async function uploadFile({ file, publicId, role }) {
  const localPath = path.join(SOURCE_DIR, file);
  console.log(`Uploading ${file} …`);
  const result = await cloudinary.uploader.upload(localPath, {
    folder,
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
    quality: "auto",
    fetch_format: "auto",
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

  console.log("\n─── Paste these into seed-achimota-tours.js Tour 1 ──────────────────────\n");

  const byRole = Object.fromEntries(results.map((r) => [r.role, r.url]));

  console.log(`coverImage:    "${byRole["coverImage"] ?? ""}",`);
  console.log(`heroMainImage: "${byRole["heroMainImage / images[0]"] ?? ""}",`);
  console.log(`images: [`);
  console.log(`  "${byRole["heroMainImage / images[0]"] ?? ""}",`);
  console.log(`  "${byRole["images[1]"] ?? ""}",`);
  console.log(`  "${byRole["images[2]"] ?? ""}",`);
  console.log(`  "${byRole["images[3]"] ?? ""}",`);
  console.log(`],`);
}

const folder = FOLDER;
main().catch((err) => {
  console.error("Upload failed:", err.message);
  process.exit(1);
});
