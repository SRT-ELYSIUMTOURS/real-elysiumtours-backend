"use strict";

/**
 * Seed script — creates one fully-populated tour package with all fields.
 * Run: node scripts/seedTour.js
 * Requires MONGO_URI in .env
 */

require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("ERROR: MONGO_URI is not set in .env");
  process.exit(1);
}

// ── Minimal schemas (strict: false lets us insert any fields) ─────────────────
const Destination   = mongoose.model("Destination",   new mongoose.Schema({}, { strict: false, collection: "destinations",    timestamps: true }));
const TourPackage   = mongoose.model("TourPackage",   new mongoose.Schema({}, { strict: false, collection: "tourpackages",    timestamps: true }));
const PackagePricing = mongoose.model("PackagePricing", new mongoose.Schema({}, { strict: false, collection: "packagepricings", timestamps: true }));

// ── Seed data ─────────────────────────────────────────────────────────────────

const destinationData = {
  name: "Cape Coast",
  slug: "cape-coast",
  region: "Central Region",
  country: "Ghana",
  description: "Cape Coast is a historic coastal city in Ghana's Central Region, known for its UNESCO-listed slave castle, vibrant fishing culture, and proximity to Kakum National Park.",
  subtitle: "Where history meets the Atlantic",
  coverImage: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200",
  images: [
    "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800",
    "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800",
  ],
  highlights: [
    "Cape Coast Castle (UNESCO World Heritage Site)",
    "Kakum National Park canopy walkway",
    "Elmina Castle",
    "Hans Cottage Botel",
  ],
  gpsCoords: { lat: 5.1054, lng: -1.2466 },
  location: { type: "Point", coordinates: [-1.2466, 5.1054] },
  weather: { avgTemp: 27, rainyMonths: ["May", "June", "October"], bestMonths: ["November", "December", "January", "February"] },
  bestTimeToVisit: "November to February",
  travelTips: [
    "Book Kakum canopy walk tickets in advance during peak season.",
    "Hire a local guide at Cape Coast Castle for the full historical context.",
    "Try fresh grilled fish at the beach fishing market in the evening.",
  ],
  aboutText: "Cape Coast served as the capital of the British Gold Coast colony and remains one of West Africa's most historically significant cities. The castle was a major hub in the transatlantic slave trade and is now a pilgrimage destination for the African diaspora.",
  tourCount: 1,
  isActive: true,
};

const tourData = (destinationId) => ({
  title: "Elmina Heritage & Coastal Journey",
  slug: "elmina-heritage-coastal-journey",
  description: "Immerse yourself in the rich history of Ghana's Central Region on this multi-day journey through Cape Coast and Elmina. Visit two UNESCO World Heritage slave castles, walk the Kakum canopy, taste local seafood, and connect with the living culture of the Fante people.",
  destinationId,
  country: "ghana",
  featured: true,
  tourType: "multi_day",
  durationDays: 3,
  startDate: new Date("2026-06-01"),
  endDate: new Date("2026-11-30"),
  bookingCutoffHours: 48,

  // Selling & capacity
  sellingMode: "individual_seats",
  totalCapacity: 12,
  remainingCapacity: 8,
  waitlistEnabled: true,
  maxWaitlistSize: 10,
  autoConfirmationHours: 24,

  // Status
  status: "published",
  isActive: true,

  // Images — 2×2 hero grid layout
  coverImage: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800",
  heroMainImage: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200",
  heroTopRight: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600",
  heroBottomLeft: "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=600",
  heroBottomRight: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=600",
  images: [
    "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800",
    "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800",
    "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=800",
    "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800",
  ],

  // Pricing (basePrice = fallback; real tiers created separately below)
  basePrice: 400,

  // Tags & classification
  tags: ["Cultural", "Diaspora", "Heritage", "International"],
  bestFor: ["History lovers", "Diaspora visitors", "Couples", "Small groups"],
  difficulty: "easy",
  minAge: 8,
  languages: ["English", "Fante"],
  availabilitySchedule: "Every Friday & Saturday departure",
  availabilityBadge: "Opened Daily",
  cancellationPolicy: "Full refund if cancelled more than 7 days before departure. 50% refund within 3–7 days. No refund within 72 hours.",

  // Logistics
  pickupIncluded: true,
  pickupLocation: "Accra — any hotel in Osu, Airport Residential, or Cantonments",
  transportType: "minibus",
  meetingPoint: { lat: 5.1054, lng: -1.2466 },
  meetingPointLabel: "Cape Coast Castle main gate",

  // Ratings & counts
  rating: 4.9,
  reviewCount: 231,
  viewCount: 1842,
  bookingCount: 89,
  categoryRatings: [
    { label: "Guide quality",      score: 4.9 },
    { label: "Value for money",    score: 4.7 },
    { label: "Historical depth",   score: 5.0 },
    { label: "Accommodation",      score: 4.5 },
    { label: "Transport comfort",  score: 4.6 },
  ],

  // Feature badge (card UI)
  featureType: "pickup",
  featureLabel: "Pickup Included",
  statusBadge: { label: "Top Rated", color: "#027920" },

  // Highlights
  highlights: [
    "Guided tour of Cape Coast Castle — UNESCO World Heritage Site",
    "Elmina Castle — the oldest European building in sub-Saharan Africa",
    "Kakum National Park canopy walkway, 30m above the rainforest floor",
    "Fresh seafood dinner at Hans Cottage Botel",
    "Farewell sunset on Coconut Grove Beach",
  ],
  tourHighlights: [
    { title: "2 UNESCO Castles",       description: "Walk the grounds of Cape Coast and Elmina Castles with expert local historians." },
    { title: "Kakum Canopy Walk",      description: "7 rope bridges spanning 330m through the forest canopy — unforgettable views." },
    { title: "Fante Cultural Immersion", description: "Attend an evening durbar, meet local artisans, and taste authentic Cape Coast dishes." },
    { title: "Beachside Accommodation", description: "Two nights at a boutique guesthouse steps from the Atlantic Ocean." },
  ],
  inclusions: [
    "Return transport from Accra (air-conditioned minibus)",
    "2 nights accommodation (twin/double sharing, beach-view rooms)",
    "All breakfasts, Day 1 dinner, Day 2 dinner",
    "Castle entrance fees (Cape Coast + Elmina)",
    "Kakum National Park entrance + canopy walk fee",
    "Licensed guide for all 3 days",
    "Bottled water throughout",
  ],
  exclusions: [
    "Flights or travel to/from Ghana",
    "Travel insurance",
    "Lunch on Days 2 and 3",
    "Personal expenses and souvenirs",
    "Single-room supplement (GHS 150/night)",
    "Tips for guides (recommended but not mandatory)",
  ],

  // Day-by-day itinerary
  itinerary: [
    {
      day: 1,
      title: "Accra Pickup → Cape Coast Castle → Evening at the Beach",
      description: "Your guide meets you at your Accra hotel at 6:00 AM for the 3-hour drive to Cape Coast along the coastal highway. After breakfast en route, you arrive at Cape Coast Castle for a 2-hour guided tour of the dungeons, Door of No Return, and the church built above the slave-holding cells. Lunch is at a local restaurant overlooking the harbour. The afternoon is free to explore the town on foot — visit the colourful fishing boats, the craft market, and Bakatue festival grounds. Dinner and overnight at your beachside guesthouse.",
      preview: "Pickup from Accra, Cape Coast Castle guided tour, beachside dinner",
      localContext: "The Cape Coast fishing harbour still operates by the same tides as it did centuries ago. The canoes you see are hand-carved from single iroko tree trunks — a skill passed from father to son.",
      activities: [
        { time: "06:00 AM", activity: "Pickup from Accra hotels",           tag: "Transport" },
        { time: "09:30 AM", activity: "Breakfast stop at roadside chop bar", tag: "Breakfast" },
        { time: "11:00 AM", activity: "Cape Coast Castle guided tour",       tag: "Sightseeing" },
        { time: "01:30 PM", activity: "Lunch at Oasis Beach Restaurant",    tag: "Lunch" },
        { time: "03:00 PM", activity: "Free exploration of Cape Coast town", tag: "Free time" },
        { time: "07:00 PM", activity: "Welcome dinner at guesthouse",       tag: "Dinner" },
      ],
    },
    {
      day: 2,
      title: "Kakum Canopy Walk → Elmina Castle → Cultural Evening",
      description: "After breakfast, drive 30 minutes to Kakum National Park. An experienced ranger guides your group along the famous canopy walkway — 7 bridges suspended 30 metres above the forest floor — before a short nature walk on the ground trail. Lunch at Hans Cottage Botel (crocodile pond included). The afternoon brings Elmina Castle, the oldest European structure in sub-Saharan Africa, built by the Portuguese in 1482. Your evening includes a traditional Fante drumming and dance performance arranged exclusively for Elysium guests.",
      preview: "Kakum canopy walk, Elmina Castle, Fante cultural evening",
      localContext: "Elmina means 'The Mine' in Portuguese — named for the gold they believed was nearby. The castle changed hands between the Portuguese, Dutch, and British over four centuries.",
      activities: [
        { time: "07:30 AM", activity: "Breakfast at guesthouse",              tag: "Breakfast" },
        { time: "09:00 AM", activity: "Kakum National Park — canopy walkway", tag: "Adventure" },
        { time: "12:30 PM", activity: "Lunch at Hans Cottage Botel",          tag: "Lunch" },
        { time: "02:30 PM", activity: "Elmina Castle guided tour",            tag: "Sightseeing" },
        { time: "05:00 PM", activity: "Beach sunset walk",                    tag: "Leisure" },
        { time: "07:30 PM", activity: "Fante drumming & dance performance",   tag: "Culture" },
      ],
    },
    {
      day: 3,
      title: "Coconut Grove Beach → Craft Market → Return to Accra",
      description: "Your final morning starts with breakfast on the terrace before a relaxed 2-hour session at Coconut Grove Beach. After checkout, browse the Cape Coast craft market — known for kente cloth, Adinkra-stamped fabrics, and hand-carved stools. Enjoy a final group lunch before the return drive to Accra, arriving by early evening.",
      preview: "Beach morning, craft market shopping, return to Accra",
      localContext: "The craft market vendors are often the artists themselves. Bargaining is expected and welcomed — but be respectful; these are handmade works that take hours to produce.",
      activities: [
        { time: "07:30 AM", activity: "Breakfast & hotel checkout",          tag: "Breakfast" },
        { time: "09:00 AM", activity: "Free time at Coconut Grove Beach",    tag: "Leisure" },
        { time: "11:00 AM", activity: "Cape Coast craft market",             tag: "Shopping" },
        { time: "01:00 PM", activity: "Farewell lunch",                      tag: "Lunch" },
        { time: "02:30 PM", activity: "Depart for Accra",                    tag: "Transport" },
        { time: "06:00 PM", activity: "Arrive Accra — drop-offs at hotels",  tag: "Transport" },
      ],
    },
  ],

  // Important information blocks
  importantInformation: {
    blocks: [
      {
        title: "What to pack",
        body: "Light breathable clothing, comfortable walking shoes, insect repellent, sunscreen (SPF 50+), a small backpack, and a camera. Modest dress is required inside the castles.",
      },
      {
        title: "Health & safety",
        body: "Malaria prophylaxis is strongly recommended. Bring any personal medication. The canopy walkway involves heights — not suitable for guests with severe acrophobia.",
      },
      {
        title: "Payment & booking",
        body: "A 30% commitment fee is required to confirm your booking. The remaining balance is due 7 days before departure. We accept mobile money (MTN/Vodafone) and card payments.",
      },
      {
        title: "Group size",
        body: "Maximum 12 guests per departure to ensure an intimate, high-quality experience. Private group departures are available for 6+ guests on request.",
      },
    ],
    footerNote: "Elysium Tours is a licensed tour operator registered with the Ghana Tourism Authority. All guides are certified and background-checked.",
  },

  // Optional add-ons at booking
  bookingAddOns: [
    { id: "single-room",     label: "Single room supplement",     priceGhc: 300 },
    { id: "pro-photo",       label: "Professional photographer",  priceGhc: 450 },
    { id: "airport-transfer",label: "Airport transfer (Kotoka)",  priceGhc: 150 },
    { id: "travel-insurance",label: "Travel insurance (basic)",   priceGhc: 80  },
  ],

  // Corporate/business amenities
  businessAmenities: {
    items: ["Dedicated group coordinator", "Customisable itinerary", "Invoice & receipt provided", "Group discount available"],
    corporateBookingBenefits: {
      title: "Why book as a corporate group?",
      items: [
        "Team-building activities can be added (drumming workshop, cooking class)",
        "Custom branded experience available for brand activations",
        "Dedicated account manager for repeat bookings",
      ],
    },
  },
});

const pricingTiers = (packageId) => [
  { packageId, minGroupSize: 1,  maxGroupSize: 2,  pricePerPerson: 550, label: "1–2 people",   isActive: true },
  { packageId, minGroupSize: 3,  maxGroupSize: 5,  pricePerPerson: 480, label: "3–5 people",   isActive: true },
  { packageId, minGroupSize: 6,  maxGroupSize: 9,  pricePerPerson: 420, label: "6–9 people",   isActive: true },
  { packageId, minGroupSize: 10, maxGroupSize: 12, pricePerPerson: 400, label: "10–12 people", isActive: true },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.");

  // 1. Upsert destination (match on slug)
  const dest = await Destination.findOneAndUpdate(
    { slug: destinationData.slug },
    { $set: destinationData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Destination: ${dest.name} (${dest._id})`);

  // 2. Upsert tour package (match on slug)
  const pkg = await TourPackage.findOneAndUpdate(
    { slug: "elmina-heritage-coastal-journey" },
    { $set: tourData(dest._id) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Tour package: ${pkg.title} (${pkg._id})`);
  console.log(`  status: ${pkg.status} | isActive: ${pkg.isActive} | sellingMode: ${pkg.sellingMode}`);

  // 3. Replace pricing tiers (delete old, insert fresh)
  await PackagePricing.deleteMany({ packageId: pkg._id.toString() });
  const tiers = await PackagePricing.insertMany(pricingTiers(pkg._id.toString()));
  console.log(`Pricing tiers created: ${tiers.length}`);
  tiers.forEach((t) => console.log(`  ${t.label}: GHS ${t.pricePerPerson}/person`));

  console.log("\nSeed complete. Tour is published and ready to appear in the frontend.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
