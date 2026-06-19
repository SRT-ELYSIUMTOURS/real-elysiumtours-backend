"use strict";

/**
 * Achimota School Centenary Tours — January 2027
 * "From Gambaga to Accra, From Wiawso to Keta."
 *
 * Seeds the three official centenary tour packages exactly as specified in the
 * Achimota School Centenary Tours Website Team Brief.
 *
 * Run: node scripts/seedScripts/seed-achimota-tours.js
 *
 * Upsert on slug — safe to re-run without creating duplicates.
 *
 * tourHighlights[] layout note:
 *   These are the visually-rich stops shown as image cards on the home page
 *   FeaturedDestinationsSection masonry grid AND the detail page highlights section.
 *   The flat array across all 3 tours maps to the grid exactly:
 *     Tour 1 [0,1] → left column   (Kintampo Waterfalls, Mole National Park)
 *     Tour 2 [0]   → centre card   (Elmina Castle)
 *     Tour 3 [0,1] → right column  (Adomi Bridge, Akosombo Dam / Dodi Princess)
 *
 *   All other highlights from the brief go into highlights[] as text bullets.
 */

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

// ── Minimal inline schemas (seed-only — not the full Moleculer app models) ─────

const AccommodationPricingSchema = new mongoose.Schema(
  {
    roomType:       { type: String }, // "single" | "double" | "triple" | "quad"
    pricePerPerson: { type: Number },
  },
  { _id: false }
);

const AccommodationOptionSchema = new mongoose.Schema(
  {
    label:       { type: String },
    tier:        { type: String }, // "budget" | "standard" | "premium" | "luxury"
    description: { type: String },
    notes:       { type: String }, // short one-line note shown in the pricing table
    pricing:     { type: [AccommodationPricingSchema], default: [] },
    isActive:    { type: Boolean, default: true },
  }
  // _id: true (default) — each option must have a stable _id for booking validation
);

const DestinationSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, unique: true, trim: true },
    slug:    { type: String, unique: true, lowercase: true },
    region:  { type: String, required: true },
    country: { type: String, required: true, default: "Ghana" },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "destinations" }
);

const TourPackageSchema = new mongoose.Schema(
  {
    title:           { type: String, required: true, trim: true },
    slug:            { type: String, unique: true, lowercase: true },
    description:     { type: String },
    destinationId:   { type: mongoose.Schema.Types.ObjectId, ref: "Destination", required: true },
    country:         { type: String },
    durationDays:    { type: Number, required: true },
    basePrice:       { type: Number },
    displayCurrency: { type: String, default: "USD" },
    coverImage:      { type: String },
    images:          { type: [String], default: [] },
    rating:          { type: Number, default: 0 },
    reviewCount:     { type: Number, default: 0 },
    tags:            { type: [String], default: [] },
    tourType:        { type: String, default: "multi_day" },
    category:        { type: String },
    difficulty:      { type: String, default: "easy" },
    bestFor:         { type: [String], default: [] },
    languages:       { type: [String], default: ["English"] },
    pickupIncluded:   { type: Boolean, default: true },
    pickupLocation:   { type: String },
    meetingPoint:      { lat: { type: Number }, lng: { type: Number } },
    meetingPointLabel: { type: String },
    pickupNote:        { type: String },
    totalCapacity:   { type: Number },
    remainingCapacity: { type: Number },
    isActive:        { type: Boolean, default: true },
    status:          { type: String, default: "published" },
    featured:        { type: Boolean, default: false },
    startDate:       { type: Date },
    endDate:         { type: Date },
    availabilityBadge: { type: String },
    featureType:     { type: String },
    featureLabel:    { type: String },
    // Text bullets — shown in the tour highlights list on the detail page
    highlights:      { type: [String], default: [] },
    // Structured stops with image — drives both the detail page highlight cards
    // and the FeaturedDestinationsSection home page grid
    tourHighlights: [
      {
        title:           { type: String },
        description:     { type: String },
        image:           { type: String },
        tags:            { type: [String], default: [] },
        gallerySections: { type: [String], default: [] },
      },
    ],
    accommodationOptions: { type: [AccommodationOptionSchema], default: [] },
    cancellable:  { type: Boolean, default: false },
    cancellationPolicy: { type: String },
    route:        { type: String },
    inclusions:  { type: [String], default: [] },
    exclusions:  { type: [String], default: [] },
    itinerary: [
      {
        day:         { type: Number },
        title:       { type: String },
        description: { type: String },
        activities:  [{ time: String, activity: String, tag: String }],
      },
    ],
  },
  { timestamps: true, collection: "tourpackages" }
);

// ── Tour data ──────────────────────────────────────────────────────────────────
// Source: Achimota School Centenary Tours Website Team Brief (PDF)
// Prices: USD (as quoted in the brief)
// Images: Unsplash CDN — replace with real Cloudinary URLs before going live

const tours = [

  // ═══════════════════════════════════════════════════════════════════════════
  // TOUR 1 — ACHIMOTA NORTHERN HERITAGE EXPEDITION
  // Departs: 23 January 2027 | 6 days / 5 nights
  // Route: Accra → Kintampo → Tamale → Gambaga → Mole National Park → Kumasi
  // Pricing: $2,100 – $4,000 per person (accommodation-tier dependent)
  //
  // tourHighlights (home page grid — left column):
  //   [0] Kintampo Waterfalls  [1] Mole National Park Morning Safari
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Achimota Northern Heritage Expedition",
    destinationName: "Northern Region",
    destinationRegion: "Northern Region",
    destinationCountry: "Ghana",
    country: "ghana",
    durationDays: 6,
    startDate: new Date("2027-01-23"),
    endDate:   new Date("2027-01-28"),
    basePrice: 2500, // lowest single across options (Zaina Lodge)
    accommodationOptions: [
      {
        label: "Option A: Zaina Lodge",
        tier: "premium",
        description: "Eco-luxury lodge at Mole National Park with panoramic views of the watering hole. En-suite rooms, sundeck, and guided walking safaris included.",
        notes: "Premium hotel option at Mole",
        pricing: [
          { roomType: "single", pricePerPerson: 2500 },
          { roomType: "double", pricePerPerson: 4000 },
        ],
        isActive: true,
      },
      {
        label: "Option B: Mole Motel",
        tier: "standard",
        description: "Classic Mole National Park lodge with comfortable en-suite rooms, restaurant, and direct access to the park's watering hole viewing platform.",
        notes: "Standard hotel option at Mole",
        pricing: [
          { roomType: "single", pricePerPerson: 2100 },
          { roomType: "double", pricePerPerson: 3600 },
        ],
        isActive: true,
      },
    ],
    displayCurrency: "USD",
    tourType: "multi_day",
    category: "leisure",
    difficulty: "moderate",
    featured: true,
    rating: 0,
    reviewCount: 0,
    totalCapacity: 50,
    remainingCapacity: 50,
    pickupIncluded: true,
    pickupLocation: "Achimota, Greater Accra Region",
    meetingPoint: { lat: 5.6028, lng: -0.2197 },
    meetingPointLabel: "Achimota, Greater Accra Region",
    pickupNote: "All tours depart Achimota School at 6:00 AM on their respective dates and return to Achimota by 10 AM.",
    languages: ["English", "Twi", "French"],
    availabilityBadge: "Limited Spots",
    cancellable: true,
    cancellationPolicy: "Cancellation available",
    route: "Achimota → Kintampo → Tamale → Gambaga → Mole National Park → Kumasi → Achimota",
    bestFor: ["Alumni", "Students", "Families", "History enthusiasts", "Wildlife lovers"],
    tags: ["Achimota", "Centenary", "Heritage", "Wildlife", "Cultural"],
    coverImage: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779728774/elysium-tours/achimota/northern-heritage/card.jpg",
    images: [
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779749770/elysium-tours/achimota/northern-heritage/kintampo-waterfalls.jpg",
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779750676/elysium-tours/achimota/northern-heritage/mole-safari.jpg",
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779749774/elysium-tours/achimota/northern-heritage/red-clay-museum.jpg",
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779750691/elysium-tours/achimota/northern-heritage/manhyia-palace.jpg",
    ],
    description: "A six-day heritage expedition through Ghana's northern corridor, created for the Achimota School Centenary celebrations. The journey connects alumni to natural landmarks, northern heritage, symbolic flag planting moments, wildlife experiences, artisan culture and the combined alumni gathering in Kumasi.",
    tourHighlights: [
      {
        title: "Kintampo Waterfalls",
        description: "A stunning natural site tucked into the Brong-Ahafo landscape, visited on the morning of Day 2. Three tiers of waterfalls cascade through tropical forest.",
        image: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779749770/elysium-tours/achimota/northern-heritage/kintampo-waterfalls.jpg",
        tags: ["Heritage", "Cultural"],
        gallerySections: ["nature"],
      },
      {
        title: "Mole National Park Morning Safari",
        description: "Ghana's largest wildlife sanctuary — early morning game drive with elephants, baboons, and antelopes. Guided by an armed park ranger.",
        image: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779750676/elysium-tours/achimota/northern-heritage/mole-safari.jpg",
        tags: ["Wildlife"],
        gallerySections: ["nature", "activities"],
      },
      {
        title: "Red Clay Ethnographic Museum, Tamale",
        description: "A museum of northern Ghana's history, artefacts, and cultural heritage. Visited on Day 3 in Tamale — one of the most informative stops on the route.",
        image: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779749774/elysium-tours/achimota/northern-heritage/red-clay-museum.jpg",
        tags: ["Heritage", "Cultural"],
        gallerySections: ["culture"],
      },
      {
        title: "Manhyia Palace, Kumasi",
        description: "The seat of the Asantehene and the heart of Ashanti royal heritage. Guided tour of the palace museum on Day 5 — a culturally rich conclusion to the northern journey.",
        image: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779750691/elysium-tours/achimota/northern-heritage/manhyia-palace.jpg",
        tags: ["Heritage", "Cultural"],
        gallerySections: ["culture"],
      },
    ],
    highlights: [
      "Kintampo Waterfalls — Natural site visit on Day 2 morning.",
      "Red Clay Ethnographic Museum, Tamale — History and artifacts of northern Ghana.",
      "Gambaga Flag Planting Ceremony — Symbolic flag planting at the far north on Day 3.",
      "Mole National Park Morning Safari — Elephants, baboons and antelopes with armed ranger guide.",
      "Shea Butter Village Visit, Tamale — Live artisan demonstration on the return leg.",
      "Manhyia Palace, Kumasi — Seat of the Asantehene and Ashanti royal heritage.",
      "Alumni Fundraising Dinner, Tamale — Day 2 evening, formal, smart attire.",
      "Combined Alumni Dinner, Kumasi — Day 5 evening with Tours 1 and 2 at Lancaster Hotel.",
    ],
    inclusions: [
      "Daily water: 3 bottles per person per day",
      "Hotel breakfast is complimentary",
      "Guided heritage experiences",
      "Lunch and dinner included",
      "Fundraising / alumni dinner access",
      "Achimota centenary flag planting moment",
    ],
    exclusions: [
      "International / domestic flights",
      "Travel insurance",
      "Personal spending & tips",
    ],
    itinerary: [
      {
        day: 1,
        title: "Accra Departure — Drive North to Kintampo",
        description: "Depart Achimota School at 6:00 AM. Long drive north through Kumasi and the Brong-Ahafo Region. Overnight at Kintampo or en route to Tamale.",
        activities: [
          { time: "06:00", activity: "Depart Achimota School — private AC coach", tag: "transport" },
          { time: "10:00", activity: "Brief stop in Kumasi for fuel and refreshments" },
          { time: "14:00", activity: "Continue north — Brong-Ahafo Region" },
          { time: "18:00", activity: "Arrive overnight stop — check in and dinner", tag: "accommodation" },
        ],
      },
      {
        day: 2,
        title: "Kintampo Waterfalls — Tamale Alumni Dinner",
        description: "Morning visit to the Kintampo Waterfalls. Continue to Tamale. Evening: Fundraising Alumni Dinner (smart attire required).",
        activities: [
          { time: "07:00", activity: "Drive to Kintampo Waterfalls (30 min)", tag: "transport" },
          { time: "08:00", activity: "Kintampo Waterfalls — guided walk through three tiers", tag: "sightseeing" },
          { time: "10:30", activity: "Depart for Tamale (3 hrs)" },
          { time: "14:00", activity: "Arrive Tamale — check in and rest" },
          { time: "16:00", activity: "Shea Butter Village Visit — watch traditional artisans at work", tag: "culture" },
          { time: "19:00", activity: "Fundraising Alumni Dinner, Tamale — formal evening, smart attire", tag: "event" },
        ],
      },
      {
        day: 3,
        title: "Red Clay Museum — Gambaga Flag Planting Ceremony",
        description: "Morning at Red Clay Ethnographic Museum in Tamale. Afternoon drive east to Gambaga for the proud Achimota flag planting ceremony at the far north.",
        activities: [
          { time: "09:00", activity: "Red Clay Ethnographic Museum — guided cultural history walk", tag: "culture" },
          { time: "11:00", activity: "Drive east to Gambaga (2 hrs)", tag: "transport" },
          { time: "13:30", activity: "Lunch in Gambaga" },
          { time: "15:00", activity: "Gambaga Flag Planting Ceremony — Achimota flag planted in the far north", tag: "centenary" },
          { time: "17:00", activity: "Return to Tamale (2 hrs)" },
          { time: "19:30", activity: "Dinner and evening at leisure" },
        ],
      },
      {
        day: 4,
        title: "Tamale to Mole National Park",
        description: "Morning at leisure in Tamale. Drive west to Larabanga and on to Mole National Park. Evening orientation walk with a park ranger.",
        activities: [
          { time: "07:30", activity: "Depart Tamale — drive to Mole National Park (3.5 hrs)", tag: "transport" },
          { time: "11:00", activity: "Stop at Larabanga Mosque — one of the oldest mosques in West Africa", tag: "culture" },
          { time: "13:00", activity: "Arrive Mole National Park — check in" },
          { time: "15:00", activity: "Lunch at the lodge" },
          { time: "16:30", activity: "Evening walking safari with armed park ranger", tag: "wildlife" },
          { time: "19:00", activity: "Dinner at park lodge — sunset over the watering hole" },
        ],
      },
      {
        day: 5,
        title: "Mole Morning Game Drive — Combined Alumni Dinner, Kumasi",
        description: "Early 4x4 game drive at prime wildlife hour. Drive south to Kumasi. Grand combined alumni dinner with Tour 2 at Lancaster Hotel.",
        activities: [
          { time: "05:30", activity: "Early morning 4x4 game drive — elephants, baboons, kob antelopes", tag: "wildlife" },
          { time: "08:30", activity: "Breakfast at the lodge" },
          { time: "10:00", activity: "Depart Mole — drive to Kumasi (5 hrs)", tag: "transport" },
          { time: "16:00", activity: "Arrive Kumasi — check in and prepare for dinner" },
          { time: "19:00", activity: "Combined Alumni Dinner — Tours 1 & 2 together at Lancaster Hotel, Kumasi", tag: "event" },
        ],
      },
      {
        day: 6,
        title: "Manhyia Palace — Return to Accra",
        description: "Morning guided tour of Manhyia Palace, the seat of the Asantehene. Depart Kumasi and return to Accra by late afternoon.",
        activities: [
          { time: "09:00", activity: "Manhyia Palace — guided tour of Ashanti royal heritage", tag: "culture" },
          { time: "11:00", activity: "Kejetia Market — optional shopping stop" },
          { time: "12:00", activity: "Depart Kumasi — return to Accra (5 hrs)", tag: "transport" },
          { time: "17:30", activity: "Arrive Achimota School — centenary tour concludes" },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOUR 2 — ACHIMOTA WESTERN AND COASTAL LEGACY ROUTE
  // Departs: 25 January 2027 | 4 days / 3 nights
  // Route: Accra → Cape Coast (Assin Manso, Elmina) → Western North (Wiawso) → Kumasi
  // Pricing: $1,500 (single) / $2,400 (double) per person
  //
  // tourHighlights (home page grid — centre tall card):
  //   [0] Elmina Castle
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Achimota Western and Coastal Legacy Route",
    destinationName: "Central Region",
    destinationRegion: "Central Region",
    destinationCountry: "Ghana",
    country: "ghana",
    durationDays: 4,
    startDate: new Date("2027-01-25"),
    endDate:   new Date("2027-01-28"),
    basePrice: 1500,
    accommodationOptions: [
      {
        label: "Lancaster Hotel, Kumasi",
        tier: "standard",
        description: "The venue for the grand combined alumni dinner. Central Kumasi location, full-service hotel with restaurant, conference facilities, and comfortable en-suite rooms.",
        notes: "3-star hotel in central Kumasi",
        pricing: [
          { roomType: "single", pricePerPerson: 1500 },
          { roomType: "double", pricePerPerson: 2400 },
        ],
        isActive: true,
      },
    ],
    displayCurrency: "USD",
    tourType: "multi_day",
    category: "leisure",
    difficulty: "easy",
    featured: true,
    rating: 0,
    reviewCount: 0,
    totalCapacity: 50,
    remainingCapacity: 50,
    pickupIncluded: true,
    pickupLocation: "Achimota, Greater Accra Region",
    meetingPoint: { lat: 5.6028, lng: -0.2197 },
    meetingPointLabel: "Achimota, Greater Accra Region",
    pickupNote: "All tours depart Achimota School at 6:00 AM on their respective dates and return to Achimota by 10 AM.",
    languages: ["English", "Twi", "French"],
    availabilityBadge: "Limited Spots",
    cancellable: true,
    cancellationPolicy: "Cancellation available",
    route: "Achimota → Cape Coast → Wiawso → Kumasi → Achimota",
    bestFor: ["Alumni", "Students", "Diaspora visitors", "History enthusiasts"],
    tags: ["Achimota", "Centenary", "UNESCO", "Coastal", "History"],
    coverImage: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779735261/elysium-tours/achimota/western-coastal/card.jpg",
    images: [
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779804856/elysium-tours/achimota/western-coastal/elmina-castle.jpg",
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779804859/elysium-tours/achimota/western-coastal/assin-manso.jpg",
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779804861/elysium-tours/achimota/western-coastal/wiawso-flag-planting.jpg",
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779804862/elysium-tours/achimota/western-coastal/manhyia-palace.jpg",
    ],
    description: "A four-day western and coastal journey connecting alumni to Ghana's historic coastal memory, symbolic centenary flag planting and Ashanti heritage. This route moves from Cape Coast and Elmina to Wiawso and Kumasi, ending with the combined alumni dinner.",
    tourHighlights: [
      {
        title: "Elmina Castle",
        description: "A UNESCO World Heritage site and one of the oldest European buildings in sub-Saharan Africa. Built by the Portuguese in 1482. Guided tour — emotionally significant.",
        image: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779804856/elysium-tours/achimota/western-coastal/elmina-castle.jpg",
        tags: ["UNESCO", "History"],
        gallerySections: ["culture"],
      },
      {
        title: "Assin Manso Slave River Site",
        description: "A deeply moving reflection site on the banks of the Donkor Nsuo river — the final bathing place of enslaved Africans before shipment. One of Ghana's most significant heritage sites.",
        image: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779804859/elysium-tours/achimota/western-coastal/assin-manso.jpg",
        tags: ["History"],
        gallerySections: ["culture"],
      },
      {
        title: "Wiawso Flag Planting Ceremony",
        description: "Symbolic Achimota centenary flag planting ceremony in Wiawso on Day 2 — a moment of alumni pride at the heart of the Western Region.",
        image: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779804861/elysium-tours/achimota/western-coastal/wiawso-flag-planting.jpg",
        tags: ["Achimota", "Centenary"],
        gallerySections: ["culture", "activities"],
      },
      {
        title: "Manhyia Palace, Kumasi",
        description: "The seat of the Asantehene and the heart of Ashanti royal heritage. Guided palace museum tour on Day 3 before the combined alumni dinner.",
        image: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779804862/elysium-tours/achimota/western-coastal/manhyia-palace.jpg",
        tags: ["History"],
        gallerySections: ["culture"],
      },
    ],
    highlights: [
      "Assin Manso Slave River Site — Reflection site and final resting point of enslaved Africans before shipment.",
      "Elmina Castle — UNESCO World Heritage site and oldest European building in sub-Saharan Africa.",
      "Wiawso Flag Planting Ceremony — Symbolic flag planting ceremony in Wiawso on Day 2.",
      "Manhyia Palace, Kumasi — Audience and guided tour focused on Ashanti heritage.",
      "Combined Alumni Dinner, Kumasi — Day 3 evening with Tours 1 and 2 at Lancaster Hotel, Kumasi.",
    ],
    inclusions: [
      "Daily water: 3 bottles per person per day",
      "Hotel breakfast is complementary",
      "Guided heritage experiences",
      "Lunch and dinner included",
      "Fundraising / alumni dinner access",
      "Achimota centenary flag planting moment",
    ],
    exclusions: [
      "International / domestic flights",
      "Travel insurance",
      "Personal spending & tips",
    ],
    itinerary: [
      {
        day: 1,
        title: "Accra Departure — Assin Manso — Elmina Castle",
        description: "Depart Achimota School 6:00 AM. Drive to Assin Manso for a reflection ceremony. Guided tour of Elmina Castle. Overnight Cape Coast.",
        activities: [
          { time: "06:00", activity: "Depart Achimota School — private AC coach", tag: "transport" },
          { time: "09:30", activity: "Assin Manso Slave River Site — guided reflection ceremony", tag: "heritage" },
          { time: "11:30", activity: "Drive to Elmina (45 min)" },
          { time: "12:30", activity: "Guided tour of Elmina Castle — dungeons and Door of No Return", tag: "sightseeing" },
          { time: "15:00", activity: "Drive to Cape Coast — check in" },
          { time: "19:00", activity: "Welcome dinner" },
        ],
      },
      {
        day: 2,
        title: "Western North — Wiawso Flag Planting Ceremony",
        description: "Drive through the Western North Region to Wiawso. The Achimota flag is planted here with local old students and community witnesses present.",
        activities: [
          { time: "07:00", activity: "Depart Cape Coast — drive to Western North Region", tag: "transport" },
          { time: "12:00", activity: "Arrive Wiawso — welcome by local Achimota old students" },
          { time: "14:00", activity: "Wiawso Flag Planting Ceremony — community witnesses present", tag: "centenary" },
          { time: "16:00", activity: "Depart for Kumasi (3 hrs)" },
          { time: "19:00", activity: "Arrive Kumasi — check in" },
        ],
      },
      {
        day: 3,
        title: "Manhyia Palace — Combined Alumni Dinner, Kumasi",
        description: "Morning visit to Manhyia Palace. Evening: grand combined alumni dinner with Tour 1 at Lancaster Hotel, Kumasi.",
        activities: [
          { time: "09:00", activity: "Manhyia Palace — guided tour of Ashanti royal heritage", tag: "culture" },
          { time: "11:30", activity: "Kumasi Cultural Centre and Kejetia Market (optional)" },
          { time: "14:00", activity: "Rest and prepare for dinner" },
          { time: "19:00", activity: "Combined Alumni Dinner — Tours 1 & 2 together at Lancaster Hotel", tag: "event" },
        ],
      },
      {
        day: 4,
        title: "Return to Accra",
        description: "Depart Kumasi after breakfast. Return to Accra by afternoon.",
        activities: [
          { time: "08:00", activity: "Breakfast and check out" },
          { time: "09:00", activity: "Depart Kumasi — return to Accra (5 hrs)", tag: "transport" },
          { time: "14:30", activity: "Arrive Achimota School — tour concludes" },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOUR 3 — ACHIMOTA VOLTA HERITAGE EXPERIENCE
  // Departs: 26 January 2027 | 3 days / 2 nights
  // Route: Accra → Adomi Bridge → Akosombo (Dodi Princess) → Keta (Fort, Flag, Dinner)
  // Pricing: $1,350 (single) / $2,300 (double) per person
  //
  // tourHighlights (home page grid — right column):
  //   [0] Adomi Bridge  [1] Dodi Princess Boat Ride (Akosombo)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Achimota Volta Heritage Experience",
    destinationName: "Volta Region",
    destinationRegion: "Volta Region",
    destinationCountry: "Ghana",
    country: "ghana",
    durationDays: 3,
    startDate: new Date("2027-01-26"),
    endDate:   new Date("2027-01-28"),
    basePrice: 1350,
    accommodationOptions: [
      {
        label: "Reddington Beach Resort, Keta",
        tier: "premium",
        description: "Beachfront resort on the Keta coastline — the venue for the alumni resort dinner. Rooms face the Atlantic Ocean with direct beach access. Built on the unique ocean-lagoon peninsula.",
        notes: "Beachfront resort on the Keta coastline",
        pricing: [
          { roomType: "single", pricePerPerson: 1350 },
          { roomType: "double", pricePerPerson: 2300 },
        ],
        isActive: true,
      },
    ],
    displayCurrency: "USD",
    tourType: "multi_day",
    category: "leisure",
    difficulty: "easy",
    featured: true,
    rating: 0,
    reviewCount: 0,
    totalCapacity: 50,
    remainingCapacity: 50,
    pickupIncluded: true,
    pickupLocation: "Achimota, Greater Accra Region",
    meetingPoint: { lat: 5.6028, lng: -0.2197 },
    meetingPointLabel: "Achimota, Greater Accra Region",
    pickupNote: "All tours depart Achimota School at 6:00 AM on their respective dates and return to Achimota by 10 AM.",
    languages: ["English", "Twi", "French"],
    availabilityBadge: "Limited Spots",
    cancellable: true,
    cancellationPolicy: "Cancellation available",
    route: "Achimota → Akosombo → Keta → Return to Achimota",
    bestFor: ["Alumni", "Students", "Families", "Adventure seekers", "Photography lovers"],
    tags: ["Achimota", "Centenary", "Lake Volta", "Coastal", "Heritage"],
    coverImage: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779743833/elysium-tours/achimota/volta-heritage/card.jpg",
    images: [
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779746828/elysium-tours/achimota/volta-heritage/adomi-bridge.jpg",
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779746831/elysium-tours/achimota/volta-heritage/dodi-princess.jpg",
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779746835/elysium-tours/achimota/volta-heritage/fort-prinzenstein.jpg",
      "https://res.cloudinary.com/dyox4iu57/image/upload/v1779746837/elysium-tours/achimota/volta-heritage/keta-flag-planting.jpg",
    ],
    description: "A three-day Volta and Keta heritage experience designed around water, memory, coastline and centenary pride. Participants begin with a warm send-off, enjoy Lake Volta, visit historic landmarks and gather for a memorable resort dinner on the Keta coastline.",
    tourHighlights: [
      {
        title: "Adomi Bridge",
        description: "A crossing and photo stop at the historic 1957 suspension bridge at Atimpoku — one of Ghana's most photographed landmarks on the Volta River.",
        image: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779746828/elysium-tours/achimota/volta-heritage/adomi-bridge.jpg",
        tags: ["Heritage"],
        gallerySections: [],
      },
      {
        title: "Dodi Princess Boat Cruise",
        description: "A scenic 5-hour cruise on Lake Volta to Dodi Island and back. Life jackets provided. Food, drinks, and music on board. An experience unlike anything else on the tour circuit.",
        image: "https://res.cloudinary.com/dyox4iu57/image/upload/v1779746831/elysium-tours/achimota/volta-heritage/dodi-princess.jpg",
        tags: ["Lake Volta"],
        gallerySections: ["activities"],
      },
    ],
    highlights: [
      "Complimentary Breakfast — Hebs send-off gift for every Tour 3 participant before the journey begins.",
      "Dodi Princess Boat Ride — Five-hour Lake Volta cruise with food, drinks, music, networking and life jackets.",
      "Adomi Bridge — Photo stop at the historic 1957 suspension bridge at Atimpoku.",
      "Fort Prinzenstein, Keta — 1784 Danish fort and former slave trade site.",
      "Keta Flag Planting Ceremony — Symbolic flag planting in Keta on Day 2.",
      "Resort Dinner, Keta — Day 2 evening at Aborigines Beach Resort, informal but memorable.",
    ],
    inclusions: [
      "Daily water: 3 bottles per person per day",
      "Hotel breakfast is complementary",
      "Guided heritage experiences",
      "Lunch and dinner included",
      "Fundraising / alumni dinner access",
      "Achimota centenary flag planting moment",
    ],
    exclusions: [
      "International / domestic flights",
      "Travel insurance",
      "Personal spending & tips",
    ],
    itinerary: [
      {
        day: 1,
        title: "Accra Departure — Adomi Bridge — Dodi Princess Cruise",
        description: "Depart Achimota School 6:00 AM with complimentary breakfast provided. Cross the Adomi Bridge at Atimpoku. Board the Dodi Princess at Akosombo for a 5-hour Lake Volta cruise.",
        activities: [
          { time: "06:00", activity: "Depart Achimota School — complimentary breakfast provided before boarding", tag: "transport" },
          { time: "09:00", activity: "Adomi Bridge, Atimpoku — crossing and photo stop", tag: "sightseeing" },
          { time: "10:30", activity: "Arrive Akosombo jetty — brief Akosombo Dam viewpoint stop" },
          { time: "11:00", activity: "Board Dodi Princess — depart for Dodi Island", tag: "cruise" },
          { time: "13:30", activity: "Land at Dodi Island — village walk and cultural exchange" },
          { time: "14:30", activity: "Return cruise to Akosombo (2.5 hrs). Lunch and drinks on board" },
          { time: "17:00", activity: "Arrive back at Akosombo — drive east to overnight stop", tag: "transport" },
          { time: "19:30", activity: "Check in and dinner" },
        ],
      },
      {
        day: 2,
        title: "Fort Prinzenstein — Keta Flag Planting — Resort Dinner",
        description: "Drive to Keta. Guided tour of Fort Prinzenstein. The Achimota flag is planted overlooking the Atlantic Ocean. Keta Lagoon sunset walk. Alumni resort dinner on the coastline.",
        activities: [
          { time: "08:00", activity: "Drive to Keta (1.5 hrs)", tag: "transport" },
          { time: "09:30", activity: "Fort Prinzenstein — guided tour of the 1784 Danish fort", tag: "heritage" },
          { time: "11:30", activity: "Keta Flag Planting Ceremony — Achimota flag planted overlooking the Atlantic", tag: "centenary" },
          { time: "13:00", activity: "Lunch at a local Keta seafood spot" },
          { time: "16:00", activity: "Check in at Aborigines Beach Resort" },
          { time: "17:30", activity: "Keta Lagoon Sunset Walk — ocean-lagoon peninsula at golden hour", tag: "sightseeing" },
          { time: "19:30", activity: "Resort Dinner — alumni dinner at Aborigines Beach Resort on the Keta coastline", tag: "event" },
        ],
      },
      {
        day: 3,
        title: "Return to Accra",
        description: "Depart Keta after breakfast. Return to Accra via Sogakope. Tour concludes at Achimota School.",
        activities: [
          { time: "08:00", activity: "Breakfast and check out" },
          { time: "09:00", activity: "Depart Keta — return to Accra via Sogakope (3 hrs)", tag: "transport" },
          { time: "12:30", activity: "Arrive Accra — optional Accra city stop" },
          { time: "14:00", activity: "Arrive Achimota School — Volta Heritage Experience concludes" },
        ],
      },
    ],
  },

];

// ── Seed logic ─────────────────────────────────────────────────────────────────

async function findOrCreateDestination(Destination, { name, region, country }) {
  const slug = slugify(name, { lower: true, strict: true });
  let dest = await Destination.findOne({ slug });
  if (!dest) {
    dest = await Destination.create({ name, slug, region, country });
    console.log(`  Created destination: ${name}`);
  } else {
    console.log(`  Found existing destination: ${name}`);
  }
  return dest;
}

async function upsertTour(TourPackage, tourData) {
  const slug = slugify(tourData.title, { lower: true, strict: true });
  const existing = await TourPackage.findOne({ slug });
  if (existing) {
    // Use doc.save() (not $set) so Mongoose generates _id for subdocuments
    Object.assign(existing, { ...tourData, slug });
    await existing.save();
    console.log(`  Updated: ${tourData.title}`);
  } else {
    await TourPackage.create({ ...tourData, slug });
    console.log(`  Created: ${tourData.title}`);
  }
}

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const Destination = mongoose.model("Destination", DestinationSchema);
  const TourPackage = mongoose.model("TourPackage", TourPackageSchema);

  for (const tour of tours) {
    console.log(`\nProcessing: ${tour.title}`);
    const destination = await findOrCreateDestination(Destination, {
      name:    tour.destinationName,
      region:  tour.destinationRegion,
      country: tour.destinationCountry,
    });
    const { destinationName, destinationRegion, destinationCountry, ...tourFields } = tour;
    await upsertTour(TourPackage, { ...tourFields, destinationId: destination._id });
  }

  console.log("\nDone. All 3 Achimota Centenary tours seeded successfully.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  mongoose.disconnect();
  process.exit(1);
});
