"use strict";

/**
 * Seed script — creates multiple tour packages covering all varieties:
 *   tourType: day_tour / multi_day / express
 *   difficulty: easy / moderate / challenging
 *   sellingMode: individual_seats / group_buy
 *   featured: true / false
 * Run: node scripts/seedTours.js
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

const Destination   = mongoose.model("Destination",   new mongoose.Schema({}, { strict: false, collection: "destinations",    timestamps: true }));
const TourPackage   = mongoose.model("TourPackage",   new mongoose.Schema({}, { strict: false, collection: "tourpackages",    timestamps: true }));
const PackagePricing = mongoose.model("PackagePricing", new mongoose.Schema({}, { strict: false, collection: "packagepricings", timestamps: true }));

// ── Destinations ──────────────────────────────────────────────────────────────

const destinations = [
  {
    slug: "accra",
    name: "Accra",
    region: "Greater Accra Region",
    country: "Ghana",
    description: "Ghana's vibrant capital — a fast-moving city of markets, monuments, beaches, and nightlife built on a deep colonial and precolonial history.",
    subtitle: "The heartbeat of modern West Africa",
    coverImage: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1200",
    images: [
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800",
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
    ],
    highlights: ["Independence Square", "Kwame Nkrumah Memorial Park", "Jamestown Lighthouse", "Makola Market"],
    gpsCoords: { lat: 5.6037, lng: -0.187 },
    location: { type: "Point", coordinates: [-0.187, 5.6037] },
    weather: { avgTemp: 28, rainyMonths: ["May", "June", "October"], bestMonths: ["November", "December", "January"] },
    bestTimeToVisit: "November to February",
    isActive: true,
  },
  {
    slug: "kumasi",
    name: "Kumasi",
    region: "Ashanti Region",
    country: "Ghana",
    description: "The capital of the Ashanti Kingdom — home to the Manhyia Palace, Africa's largest open-air market at Kejetia, and master kente weavers in Bonwire village.",
    subtitle: "The Garden City and seat of Ashanti power",
    coverImage: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200",
    images: [
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800",
      "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800",
    ],
    highlights: ["Manhyia Palace Museum", "Kejetia Market", "Bonwire Kente Village", "Asante Cultural Centre"],
    gpsCoords: { lat: 6.6885, lng: -1.6244 },
    location: { type: "Point", coordinates: [-1.6244, 6.6885] },
    weather: { avgTemp: 26, rainyMonths: ["April", "May", "October", "November"], bestMonths: ["December", "January", "February"] },
    bestTimeToVisit: "December to February",
    isActive: true,
  },
  {
    slug: "mole-savannah",
    name: "Mole Savannah",
    region: "Savannah Region",
    country: "Ghana",
    description: "Ghana's largest wildlife sanctuary — 4,840 km² of pristine savannah home to elephants, antelopes, baboons, and over 300 bird species.",
    subtitle: "Ghana's wild north — untamed and unforgettable",
    coverImage: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200",
    images: [
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800",
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
    ],
    highlights: ["Mole National Park", "Larabanga Mosque (Ghana's oldest mosque)", "Savannah walking safaris", "Paga Crocodile Pond"],
    gpsCoords: { lat: 9.2605, lng: -1.8547 },
    location: { type: "Point", coordinates: [-1.8547, 9.2605] },
    weather: { avgTemp: 32, rainyMonths: ["June", "July", "August", "September"], bestMonths: ["November", "December", "January", "February", "March"] },
    bestTimeToVisit: "November to April",
    isActive: true,
  },
  {
    slug: "volta-region",
    name: "Volta Region",
    region: "Volta Region",
    country: "Ghana",
    description: "Ghana's green highland east — home to West Africa's highest waterfall at Wli, the Agumatsa Wildlife Sanctuary, Lake Volta, and the Tafi Atome Monkey Sanctuary.",
    subtitle: "Highlands, waterfalls, and mountain serenity",
    coverImage: "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=1200",
    images: [
      "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=800",
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800",
    ],
    highlights: ["Wli Falls (West Africa's highest)", "Agumatsa Wildlife Sanctuary", "Tafi Atome Monkey Sanctuary", "Hohoe Market"],
    gpsCoords: { lat: 6.8993, lng: 0.4763 },
    location: { type: "Point", coordinates: [0.4763, 6.8993] },
    weather: { avgTemp: 24, rainyMonths: ["April", "May", "June", "September", "October"], bestMonths: ["December", "January", "February"] },
    bestTimeToVisit: "December to February",
    isActive: true,
  },
  {
    slug: "cape-coast",
    name: "Cape Coast",
    region: "Central Region",
    country: "Ghana",
    description: "Cape Coast is a historic coastal city in Ghana's Central Region, known for its UNESCO-listed slave castle, vibrant fishing culture, and proximity to Kakum National Park.",
    subtitle: "Where history meets the Atlantic",
    coverImage: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200",
    images: [
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800",
      "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800",
    ],
    highlights: ["Cape Coast Castle (UNESCO)", "Kakum National Park canopy walkway", "Elmina Castle", "Hans Cottage Botel"],
    gpsCoords: { lat: 5.1054, lng: -1.2466 },
    location: { type: "Point", coordinates: [-1.2466, 5.1054] },
    weather: { avgTemp: 27, rainyMonths: ["May", "June", "October"], bestMonths: ["November", "December", "January", "February"] },
    bestTimeToVisit: "November to February",
    isActive: true,
  },
];

// ── Tour definitions ──────────────────────────────────────────────────────────

const tours = [
  // ────────────────────────────────────────────────
  // 1. Elmina Heritage (existing — upsert to keep in sync)
  // ────────────────────────────────────────────────
  {
    destinationSlug: "cape-coast",
    slug: "elmina-heritage-coastal-journey",
    title: "Elmina Heritage & Coastal Journey",
    category: "leisure",
    description: "Immerse yourself in the rich history of Ghana's Central Region on this multi-day journey through Cape Coast and Elmina. Visit two UNESCO World Heritage slave castles, walk the Kakum canopy, taste local seafood, and connect with the living culture of the Fante people.",
    country: "ghana",
    tourType: "multi_day",
    durationDays: 3,
    difficulty: "easy",
    sellingMode: "individual_seats",
    totalCapacity: 12,
    remainingCapacity: 8,
    featured: true,
    status: "published",
    isActive: true,
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-11-30"),
    bookingCutoffHours: 48,
    waitlistEnabled: true,
    maxWaitlistSize: 10,
    rating: 4.9,
    reviewCount: 231,
    viewCount: 1842,
    bookingCount: 89,
    basePrice: 400,
    tags: ["Cultural", "Diaspora", "Heritage", "International"],
    bestFor: ["History lovers", "Diaspora visitors", "Couples", "Small groups"],
    languages: ["English", "Fante"],
    cancellationPolicy: "Full refund if cancelled more than 7 days before departure. 50% refund within 3–7 days. No refund within 72 hours.",
    pickupIncluded: true,
    pickupLocation: "Accra — any hotel in Osu, Airport Residential, or Cantonments",
    transportType: "minibus",
    meetingPoint: { lat: 5.1054, lng: -1.2466 },
    meetingPointLabel: "Cape Coast Castle main gate",
    availabilitySchedule: "Every Friday & Saturday departure",
    availabilityBadge: "Opened Daily",
    featureType: "pickup",
    featureLabel: "Pickup Included",
    statusBadge: { label: "Top Rated", color: "#027920" },
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
    highlights: [
      "Guided tour of Cape Coast Castle — UNESCO World Heritage Site",
      "Elmina Castle — the oldest European building in sub-Saharan Africa",
      "Kakum National Park canopy walkway, 30m above the rainforest floor",
      "Fresh seafood dinner at Hans Cottage Botel",
    ],
    inclusions: [
      "Return transport from Accra (air-conditioned minibus)",
      "2 nights accommodation (twin/double sharing)",
      "All breakfasts + Day 1 & Day 2 dinners",
      "Castle entrance fees (Cape Coast + Elmina)",
      "Kakum entrance + canopy walk",
      "Licensed guide for all 3 days",
    ],
    exclusions: ["Flights/travel to Ghana", "Travel insurance", "Lunch on Days 2 & 3", "Personal expenses"],
    itinerary: [
      {
        day: 1,
        title: "Accra Pickup → Cape Coast Castle → Evening at the Beach",
        preview: "Pickup from Accra, Cape Coast Castle guided tour, beachside dinner",
        activities: [
          { time: "06:00 AM", activity: "Pickup from Accra hotels", tag: "Transport" },
          { time: "11:00 AM", activity: "Cape Coast Castle guided tour", tag: "Sightseeing" },
          { time: "07:00 PM", activity: "Welcome dinner at guesthouse", tag: "Dinner" },
        ],
      },
      {
        day: 2,
        title: "Kakum Canopy Walk → Elmina Castle → Cultural Evening",
        preview: "Kakum canopy walk, Elmina Castle, Fante cultural evening",
        activities: [
          { time: "09:00 AM", activity: "Kakum National Park — canopy walkway", tag: "Adventure" },
          { time: "02:30 PM", activity: "Elmina Castle guided tour", tag: "Sightseeing" },
          { time: "07:30 PM", activity: "Fante drumming & dance performance", tag: "Culture" },
        ],
      },
      {
        day: 3,
        title: "Coconut Grove Beach → Craft Market → Return to Accra",
        preview: "Beach morning, craft market shopping, return to Accra",
        activities: [
          { time: "09:00 AM", activity: "Free time at Coconut Grove Beach", tag: "Leisure" },
          { time: "11:00 AM", activity: "Cape Coast craft market", tag: "Shopping" },
          { time: "02:30 PM", activity: "Depart for Accra", tag: "Transport" },
        ],
      },
    ],
    categoryRatings: [
      { label: "Guide quality", score: 4.9 },
      { label: "Value for money", score: 4.7 },
      { label: "Historical depth", score: 5.0 },
      { label: "Transport comfort", score: 4.6 },
    ],
    importantInformation: {
      blocks: [
        { title: "What to pack", body: "Light breathable clothing, comfortable walking shoes, insect repellent, sunscreen (SPF 50+)." },
        { title: "Health & safety", body: "Malaria prophylaxis strongly recommended. Canopy walkway involves heights — not for severe acrophobia." },
        { title: "Payment", body: "30% commitment fee required to confirm. Balance due 7 days before departure." },
      ],
      footerNote: "Elysium Tours is licensed with the Ghana Tourism Authority.",
    },
    bookingAddOns: [
      { id: "single-room", label: "Single room supplement", priceGhc: 300 },
      { id: "pro-photo", label: "Professional photographer", priceGhc: 450 },
    ],
    businessAmenities: {
      items: ["Dedicated group coordinator", "Customisable itinerary", "Invoice & receipt provided"],
      corporateBookingBenefits: {
        title: "Why book as a corporate group?",
        items: ["Team-building activities available", "Custom branded experience", "Dedicated account manager"],
      },
    },
    pricingTiers: [
      { minGroupSize: 1,  maxGroupSize: 2,  pricePerPerson: 550, label: "1–2 people" },
      { minGroupSize: 3,  maxGroupSize: 5,  pricePerPerson: 480, label: "3–5 people" },
      { minGroupSize: 6,  maxGroupSize: 9,  pricePerPerson: 420, label: "6–9 people" },
      { minGroupSize: 10, maxGroupSize: 12, pricePerPerson: 400, label: "10–12 people" },
    ],
  },

  // ────────────────────────────────────────────────
  // 2. Accra City & Culture (Day Tour — easy)
  // ────────────────────────────────────────────────
  {
    destinationSlug: "accra",
    slug: "accra-city-culture-tour",
    title: "Accra City & Culture Full-Day Tour",
    category: "leisure",
    description: "The definitive single-day introduction to Accra. From Independence Square to the National Museum, from Jamestown fishing harbour to the Arts Centre, this tour packs the highlights of Ghana's capital into one carefully-paced day. Perfect for first-time visitors and corporate guests with limited time.",
    country: "ghana",
    tourType: "day_tour",
    durationDays: 1,
    difficulty: "easy",
    sellingMode: "individual_seats",
    totalCapacity: 16,
    remainingCapacity: 12,
    featured: true,
    status: "published",
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    bookingCutoffHours: 24,
    waitlistEnabled: false,
    rating: 4.8,
    reviewCount: 143,
    viewCount: 920,
    bookingCount: 67,
    basePrice: 250,
    tags: ["Cultural", "City", "History", "Beginner-friendly"],
    bestFor: ["First-time visitors", "Corporate guests", "Families", "Solo travelers"],
    languages: ["English", "Twi"],
    cancellationPolicy: "Full refund if cancelled more than 48 hours before. No refund within 24 hours.",
    pickupIncluded: true,
    pickupLocation: "Any hotel in Accra",
    transportType: "minibus",
    meetingPoint: { lat: 5.5561, lng: -0.1969 },
    meetingPointLabel: "Independence Square, Accra",
    availabilitySchedule: "Daily departures",
    availabilityBadge: "Opened Daily",
    featureType: "pickup",
    featureLabel: "Pickup Included",
    statusBadge: { label: "Best Seller", color: "#1a6fd4" },
    coverImage: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800",
    heroMainImage: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1200",
    heroTopRight: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600",
    heroBottomLeft: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600",
    heroBottomRight: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=600",
    images: [
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800",
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800",
    ],
    highlights: [
      "Independence Square and the Black Star Arch",
      "Kwame Nkrumah Memorial Park & Mausoleum",
      "Jamestown Lighthouse and fishing harbour",
      "National Museum of Ghana",
      "Centre for National Culture & craft market",
    ],
    inclusions: [
      "Air-conditioned transport throughout the day",
      "English-speaking certified guide",
      "All entrance fees",
      "Hotel pickup & drop-off",
      "Bottled water",
    ],
    exclusions: ["Meals (lunch not included)", "Personal purchases", "Tips"],
    itinerary: [
      {
        day: 1,
        title: "Full-Day Accra City Discovery",
        preview: "Monuments, heritage sites, markets, and harbour",
        activities: [
          { time: "08:00 AM", activity: "Hotel pickup", tag: "Transport" },
          { time: "09:00 AM", activity: "Independence Square & Black Star Arch", tag: "Sightseeing" },
          { time: "10:30 AM", activity: "Kwame Nkrumah Memorial Park", tag: "Sightseeing" },
          { time: "12:00 PM", activity: "Jamestown fishing harbour & lighthouse", tag: "Culture" },
          { time: "02:00 PM", activity: "National Museum of Ghana", tag: "Sightseeing" },
          { time: "03:30 PM", activity: "Centre for National Culture & craft shopping", tag: "Shopping" },
          { time: "05:30 PM", activity: "Return to hotel", tag: "Transport" },
        ],
      },
    ],
    categoryRatings: [
      { label: "Guide quality", score: 4.9 },
      { label: "Value for money", score: 4.8 },
      { label: "Pacing", score: 4.7 },
      { label: "Transport comfort", score: 4.8 },
    ],
    importantInformation: {
      blocks: [
        { title: "What to wear", body: "Comfortable walking shoes and breathable clothing. Light jacket for air-conditioned transport." },
        { title: "Best time", body: "Morning departures avoid peak heat. November–February is the coolest and least humid season." },
      ],
      footerNote: "This is a shared group tour. Private departures available on request.",
    },
    bookingAddOns: [
      { id: "lunch", label: "Local restaurant lunch stop", priceGhc: 80 },
      { id: "pro-photo", label: "Professional photographer", priceGhc: 350 },
    ],
    pricingTiers: [
      { minGroupSize: 1,  maxGroupSize: 3,  pricePerPerson: 280, label: "1–3 people" },
      { minGroupSize: 4,  maxGroupSize: 8,  pricePerPerson: 250, label: "4–8 people" },
      { minGroupSize: 9,  maxGroupSize: 16, pricePerPerson: 220, label: "9–16 people" },
    ],
  },

  // ────────────────────────────────────────────────
  // 3. Accra Arts, Culture & Food (Express)
  // ────────────────────────────────────────────────
  {
    destinationSlug: "accra",
    slug: "accra-arts-culture-food-day",
    title: "Accra Arts, Culture & Food Day",
    category: "business",
    description: "A vibrant single-day immersion into Ghana's capital. Explore the Centre for National Culture for traditional crafts, visit the Kwame Nkrumah Memorial Park, sample street food at Makola Market, and enjoy a curated lunch at a local fusion restaurant. Perfect for first-time visitors.",
    country: "ghana",
    tourType: "express",
    durationDays: 1,
    difficulty: "easy",
    sellingMode: "group_buy",
    totalCapacity: 20,
    featured: false,
    status: "published",
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    bookingCutoffHours: 12,
    waitlistEnabled: false,
    rating: 4.7,
    reviewCount: 98,
    viewCount: 650,
    bookingCount: 44,
    basePrice: 200,
    tags: ["Food", "Art", "City", "Express"],
    bestFor: ["Foodies", "Art lovers", "Short stays", "Business travelers"],
    languages: ["English", "Twi"],
    cancellationPolicy: "Full refund if cancelled more than 24 hours before. No refund within 12 hours.",
    pickupIncluded: false,
    meetingPoint: { lat: 5.5706, lng: -0.2071 },
    meetingPointLabel: "Centre for National Culture, Accra",
    availabilitySchedule: "Monday–Saturday departures",
    availabilityBadge: "Opened Daily",
    statusBadge: { label: "Quick & Fun", color: "#e07020" },
    coverImage: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
    heroMainImage: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200",
    heroTopRight: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600",
    heroBottomLeft: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600",
    heroBottomRight: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600",
    images: [
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800",
    ],
    highlights: [
      "Centre for National Culture — traditional crafts, textiles, beads",
      "Street food walking tour at Makola Market",
      "Kwame Nkrumah Memorial Park",
      "Curated lunch at a local fusion restaurant",
    ],
    inclusions: ["Licensed guide", "Entrance fees", "Lunch at fusion restaurant"],
    exclusions: ["Transport to/from meeting point", "Personal purchases", "Tips"],
    itinerary: [
      {
        day: 1,
        title: "Arts, Markets & Flavours of Accra",
        preview: "Culture, craft market, street food, and fusion lunch",
        activities: [
          { time: "09:00 AM", activity: "Meet at Centre for National Culture", tag: "Meeting" },
          { time: "09:15 AM", activity: "Craft & textile market tour", tag: "Shopping" },
          { time: "11:00 AM", activity: "Kwame Nkrumah Memorial Park", tag: "Sightseeing" },
          { time: "12:30 PM", activity: "Street food tour at Makola Market", tag: "Food" },
          { time: "02:00 PM", activity: "Fusion lunch at Buka Restaurant", tag: "Lunch" },
          { time: "03:30 PM", activity: "Tour ends", tag: "End" },
        ],
      },
    ],
    categoryRatings: [
      { label: "Guide quality", score: 4.8 },
      { label: "Value for money", score: 4.9 },
      { label: "Food experience", score: 4.8 },
    ],
    importantInformation: {
      blocks: [
        { title: "Meeting point", body: "Meet at the main entrance of the Centre for National Culture on Liberia Road, Accra." },
        { title: "What to bring", body: "Comfortable walking shoes, cash for personal purchases, camera." },
      ],
    },
    bookingAddOns: [
      { id: "cooking-class", label: "Ghanaian cooking class add-on (2hrs)", priceGhc: 120 },
    ],
    pricingTiers: [
      { minGroupSize: 1,  maxGroupSize: 5,  pricePerPerson: 230, label: "1–5 people" },
      { minGroupSize: 6,  maxGroupSize: 20, pricePerPerson: 200, label: "6–20 people" },
    ],
  },

  // ────────────────────────────────────────────────
  // 4. Kumasi Heritage & Market Discovery (Multi-Day, 2 days)
  // ────────────────────────────────────────────────
  {
    destinationSlug: "kumasi",
    slug: "kumasi-heritage-market-discovery",
    title: "Kumasi Heritage & Market Discovery",
    category: "leisure",
    description: "Experience the cultural heart of the Ashanti Kingdom. Visit the Manhyia Palace Museum, Kejetia Market (one of West Africa's largest open-air markets), and the National Cultural Centre. Watch master craftsmen weave authentic kente cloth in Bonwire village and learn the history of the Golden Stool.",
    country: "ghana",
    tourType: "multi_day",
    durationDays: 2,
    difficulty: "easy",
    sellingMode: "individual_seats",
    totalCapacity: 10,
    remainingCapacity: 7,
    featured: true,
    status: "published",
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    bookingCutoffHours: 48,
    waitlistEnabled: true,
    maxWaitlistSize: 8,
    rating: 4.7,
    reviewCount: 89,
    viewCount: 740,
    bookingCount: 52,
    basePrice: 450,
    tags: ["Cultural", "Heritage", "Ashanti", "Kente"],
    bestFor: ["Culture enthusiasts", "History lovers", "Artisan seekers", "Couples"],
    languages: ["English", "Twi"],
    cancellationPolicy: "Full refund if cancelled more than 7 days before. 50% refund within 3–7 days. No refund within 48 hours.",
    pickupIncluded: true,
    pickupLocation: "Accra or Kumasi hotels",
    transportType: "van",
    meetingPoint: { lat: 6.6885, lng: -1.6244 },
    meetingPointLabel: "Manhyia Palace, Kumasi",
    availabilitySchedule: "Thursday & Friday departures",
    availabilityBadge: "Limited Seats",
    featureType: "pickup",
    featureLabel: "Pickup Included",
    statusBadge: { label: "Cultural Gem", color: "#7B2CBF" },
    coverImage: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800",
    heroMainImage: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200",
    heroTopRight: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600",
    heroBottomLeft: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600",
    heroBottomRight: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600",
    images: [
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800",
      "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800",
    ],
    highlights: [
      "Manhyia Palace Museum — seat of the Asantehene",
      "Kejetia Market — one of West Africa's largest open-air markets",
      "Bonwire Kente Weaving Village — meet the master weavers",
      "Asante Cultural Centre & National Museum",
    ],
    inclusions: [
      "Return transport from Accra",
      "1 night accommodation in Kumasi",
      "Breakfast Day 2",
      "All entrance fees",
      "Licensed Ashanti heritage guide",
    ],
    exclusions: ["Lunch & dinner Day 1", "Lunch Day 2", "Personal shopping", "Tips"],
    itinerary: [
      {
        day: 1,
        title: "Accra → Kumasi: Palace, Market & Cultural Centre",
        preview: "Manhyia Palace, Kejetia Market, Asante Cultural Centre",
        activities: [
          { time: "07:00 AM", activity: "Depart Accra by road", tag: "Transport" },
          { time: "11:00 AM", activity: "Manhyia Palace Museum guided tour", tag: "Sightseeing" },
          { time: "01:00 PM", activity: "Lunch break (own expense)", tag: "Free" },
          { time: "02:00 PM", activity: "Kejetia Market exploration", tag: "Culture" },
          { time: "04:30 PM", activity: "Asante Cultural Centre & National Museum", tag: "Sightseeing" },
          { time: "07:00 PM", activity: "Check-in at guesthouse", tag: "Accommodation" },
        ],
      },
      {
        day: 2,
        title: "Bonwire Kente Village → Return to Accra",
        preview: "Kente weaving demonstration, craft shopping, return journey",
        activities: [
          { time: "07:30 AM", activity: "Breakfast at guesthouse", tag: "Breakfast" },
          { time: "09:00 AM", activity: "Bonwire Kente Weaving Village", tag: "Culture" },
          { time: "11:00 AM", activity: "Craft market — kente, Adinkra fabrics, stools", tag: "Shopping" },
          { time: "01:00 PM", activity: "Farewell lunch & depart Kumasi", tag: "Transport" },
          { time: "05:00 PM", activity: "Arrive Accra", tag: "Transport" },
        ],
      },
    ],
    categoryRatings: [
      { label: "Guide quality", score: 4.8 },
      { label: "Value for money", score: 4.7 },
      { label: "Cultural depth", score: 4.9 },
      { label: "Transport comfort", score: 4.6 },
    ],
    importantInformation: {
      blocks: [
        { title: "Palace visit dress code", body: "Modest dress required at Manhyia Palace — cover shoulders and knees. Avoid wearing black or red (associated with mourning)." },
        { title: "Kente shopping", body: "Bonwire prices are directly from the weavers — quality guaranteed. Bargaining is not customary here; prices reflect the craftsmanship." },
      ],
      footerNote: "Tour operates subject to palace opening hours.",
    },
    bookingAddOns: [
      { id: "kente-weaving-class", label: "Hands-on kente weaving lesson (1hr)", priceGhc: 150 },
      { id: "single-room", label: "Single room supplement", priceGhc: 200 },
    ],
    pricingTiers: [
      { minGroupSize: 1,  maxGroupSize: 2,  pricePerPerson: 550, label: "1–2 people" },
      { minGroupSize: 3,  maxGroupSize: 6,  pricePerPerson: 480, label: "3–6 people" },
      { minGroupSize: 7,  maxGroupSize: 10, pricePerPerson: 420, label: "7–10 people" },
    ],
  },

  // ────────────────────────────────────────────────
  // 5. Mole National Park Safari (Multi-Day, 3 days — moderate)
  // ────────────────────────────────────────────────
  {
    destinationSlug: "mole-savannah",
    slug: "mole-national-park-safari",
    title: "Mole National Park Safari",
    category: "ekolure",
    description: "Experience Ghana's largest wildlife sanctuary on this immersive safari adventure. Spot elephants, antelopes, baboons, and over 300 bird species across 4,840 km² of pristine savannah. Take guided walking safaris with armed rangers, swim in the lodge's pool overlooking the watering hole, and learn about traditional northern Ghanaian culture.",
    country: "ghana",
    tourType: "multi_day",
    durationDays: 3,
    difficulty: "moderate",
    sellingMode: "group_buy",
    totalCapacity: 8,
    featured: false,
    status: "published",
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    bookingCutoffHours: 72,
    waitlistEnabled: true,
    maxWaitlistSize: 6,
    rating: 4.8,
    reviewCount: 76,
    viewCount: 580,
    bookingCount: 38,
    basePrice: 900,
    tags: ["Safari", "Wildlife", "Nature", "Adventure"],
    bestFor: ["Nature lovers", "Wildlife enthusiasts", "Adventure seekers", "Photographers"],
    languages: ["English"],
    cancellationPolicy: "Full refund if cancelled more than 14 days before. 50% within 7–14 days. No refund within 7 days.",
    pickupIncluded: true,
    pickupLocation: "Accra (flight or road options)",
    transportType: "suv",
    meetingPoint: { lat: 9.2605, lng: -1.8547 },
    meetingPointLabel: "Mole Motel, Damongo",
    availabilitySchedule: "Tuesday & Saturday departures",
    availabilityBadge: "Seasonal",
    featureType: null,
    featureLabel: null,
    statusBadge: { label: "Wild Experience", color: "#2e7d32" },
    coverImage: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800",
    heroMainImage: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200",
    heroTopRight: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=600",
    heroBottomLeft: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600",
    heroBottomRight: "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=600",
    images: [
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800",
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800",
    ],
    highlights: [
      "Walking safari with armed ranger — elephants, antelopes, warthogs",
      "Birdwatching — 300+ species including the white-backed vulture",
      "Larabanga Mosque — Ghana's oldest mosque (built 1421)",
      "Pool overlooking the wildlife watering hole",
    ],
    inclusions: [
      "2 nights accommodation at Mole Motel",
      "All breakfasts and dinners",
      "2 guided walking safaris with armed ranger",
      "Park entrance fees",
      "Transport within the park (jeep)",
    ],
    exclusions: ["Flights/bus to Damongo", "Lunch", "Alcoholic beverages", "Personal expenses"],
    itinerary: [
      {
        day: 1,
        title: "Arrival → Evening Safari",
        preview: "Arrive at Mole, settle in, evening walking safari",
        activities: [
          { time: "02:00 PM", activity: "Arrive Mole Motel, check-in", tag: "Accommodation" },
          { time: "04:00 PM", activity: "Evening walking safari", tag: "Safari" },
          { time: "07:30 PM", activity: "Dinner at lodge restaurant", tag: "Dinner" },
        ],
      },
      {
        day: 2,
        title: "Dawn Safari → Larabanga Mosque → Birdwatching",
        preview: "Dawn safari, ancient mosque visit, afternoon birdwatching",
        activities: [
          { time: "06:00 AM", activity: "Dawn walking safari (best elephant sightings)", tag: "Safari" },
          { time: "09:00 AM", activity: "Breakfast at lodge", tag: "Breakfast" },
          { time: "11:00 AM", activity: "Visit Larabanga Mosque", tag: "Sightseeing" },
          { time: "03:00 PM", activity: "Guided birdwatching session", tag: "Nature" },
          { time: "07:00 PM", activity: "Dinner & stargazing", tag: "Leisure" },
        ],
      },
      {
        day: 3,
        title: "Morning Safari → Depart",
        preview: "Final morning safari, breakfast, departure",
        activities: [
          { time: "06:00 AM", activity: "Final dawn safari", tag: "Safari" },
          { time: "08:30 AM", activity: "Breakfast & checkout", tag: "Breakfast" },
          { time: "10:00 AM", activity: "Depart Mole", tag: "Transport" },
        ],
      },
    ],
    categoryRatings: [
      { label: "Wildlife sightings", score: 4.9 },
      { label: "Guide expertise", score: 4.8 },
      { label: "Accommodation", score: 4.4 },
      { label: "Value for money", score: 4.7 },
    ],
    importantInformation: {
      blocks: [
        { title: "Physical fitness", body: "Walking safaris cover 3–6 km on uneven terrain. Moderate fitness recommended. Not suitable for mobility-impaired guests." },
        { title: "Wildlife safety", body: "Always follow ranger instructions. Maintain safe distances from wildlife. Do not run if you encounter elephants." },
        { title: "Best season", body: "Dry season (Nov–April) offers the best wildlife viewing as animals gather at watering holes." },
      ],
      footerNote: "Mole National Park is eco-certified. No off-road driving is permitted.",
    },
    bookingAddOns: [
      { id: "night-safari", label: "Night spotlight safari (extra evening)", priceGhc: 250 },
      { id: "photography-guide", label: "Dedicated wildlife photography guide", priceGhc: 400 },
    ],
    pricingTiers: [
      { minGroupSize: 1,  maxGroupSize: 2,  pricePerPerson: 1100, label: "1–2 people" },
      { minGroupSize: 3,  maxGroupSize: 5,  pricePerPerson: 950, label: "3–5 people" },
      { minGroupSize: 6,  maxGroupSize: 8,  pricePerPerson: 850, label: "6–8 people" },
    ],
  },

  // ────────────────────────────────────────────────
  // 6. Wli Waterfalls & Nature Exploration (Day Tour — moderate)
  // ────────────────────────────────────────────────
  {
    destinationSlug: "volta-region",
    slug: "wli-waterfalls-nature-exploration",
    title: "Wli Waterfalls & Nature Exploration",
    category: "ekolure",
    description: "Trek to West Africa's highest waterfall in the lush mountains of the Volta Region. The hike through the Agumatsa Wildlife Sanctuary takes you past tropical butterflies, fruit bats, and dense rainforest before revealing the spectacular 80-metre Wli Falls. Swim in the natural pool beneath the falls and explore the upper falls trail for adventurous guests.",
    country: "ghana",
    tourType: "day_tour",
    durationDays: 1,
    difficulty: "moderate",
    sellingMode: "individual_seats",
    totalCapacity: 12,
    remainingCapacity: 9,
    featured: true,
    status: "published",
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    bookingCutoffHours: 24,
    waitlistEnabled: false,
    rating: 4.9,
    reviewCount: 112,
    viewCount: 830,
    bookingCount: 60,
    basePrice: 350,
    tags: ["Nature", "Hiking", "Waterfall", "Wildlife"],
    bestFor: ["Nature lovers", "Hikers", "Photographers", "Adventure seekers"],
    languages: ["English", "Ewe"],
    cancellationPolicy: "Full refund if cancelled more than 48 hours before. No refund within 24 hours.",
    pickupIncluded: true,
    pickupLocation: "Ho or Hohoe town centre",
    transportType: "van",
    meetingPoint: { lat: 6.9124, lng: 0.6009 },
    meetingPointLabel: "Wli Waterfalls Car Park, Agumatsa Sanctuary",
    availabilitySchedule: "Daily (seasonal — best Nov–Feb)",
    availabilityBadge: "Opened Daily",
    featureType: "pickup",
    featureLabel: "Pickup Included",
    statusBadge: { label: "Nature's Best", color: "#2e7d32" },
    coverImage: "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=800",
    heroMainImage: "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=1200",
    heroTopRight: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=600",
    heroBottomLeft: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600",
    heroBottomRight: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600",
    images: [
      "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=800",
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800",
    ],
    highlights: [
      "Wli Falls — West Africa's highest waterfall at 80 metres",
      "Hike through Agumatsa Wildlife Sanctuary",
      "Thousands of fruit bats roosting in the cliffs",
      "Swim in the natural pool at the base of the falls",
    ],
    inclusions: [
      "Transport from Ho/Hohoe to Wli and return",
      "Park entrance fee",
      "Licensed local guide",
      "Bottled water",
    ],
    exclusions: ["Meals", "Personal expenses", "Upper falls guide (optional extra)"],
    itinerary: [
      {
        day: 1,
        title: "Hike to Wli Falls & Nature Walk",
        preview: "Rainforest hike, Wli Falls swim, fruit bat colony",
        activities: [
          { time: "07:30 AM", activity: "Pickup from Ho/Hohoe", tag: "Transport" },
          { time: "09:00 AM", activity: "Arrive Wli — briefing at ranger station", tag: "Meeting" },
          { time: "09:30 AM", activity: "30-min hike to lower Wli Falls", tag: "Hiking" },
          { time: "10:30 AM", activity: "Swim at base of the falls", tag: "Leisure" },
          { time: "12:00 PM", activity: "Picnic lunch near the falls (own food)", tag: "Lunch" },
          { time: "01:30 PM", activity: "Optional: upper falls trail (challenging, +90 min)", tag: "Adventure" },
          { time: "03:00 PM", activity: "Return hike to car park", tag: "Hiking" },
          { time: "05:00 PM", activity: "Return to Ho/Hohoe", tag: "Transport" },
        ],
      },
    ],
    categoryRatings: [
      { label: "Scenery", score: 5.0 },
      { label: "Guide quality", score: 4.8 },
      { label: "Value for money", score: 4.9 },
      { label: "Physical challenge", score: 3.8 },
    ],
    importantInformation: {
      blocks: [
        { title: "Footwear", body: "Waterproof hiking shoes or sturdy sandals essential. The trail can be muddy and slippery year-round." },
        { title: "Fitness level", body: "Lower falls hike is 30 min each way — suitable for average fitness. Upper falls adds 90 min of steep terrain." },
        { title: "What to bring", body: "Swimwear, change of clothes, insect repellent, snacks, and cash for ranger tips." },
      ],
      footerNote: "Park entry fees support the local Likpe community and conservation.",
    },
    bookingAddOns: [
      { id: "upper-falls", label: "Upper Wli Falls guided trek", priceGhc: 120 },
      { id: "tafi-monkey", label: "Tafi Atome Monkey Sanctuary add-on", priceGhc: 180 },
    ],
    pricingTiers: [
      { minGroupSize: 1,  maxGroupSize: 3,  pricePerPerson: 420, label: "1–3 people" },
      { minGroupSize: 4,  maxGroupSize: 8,  pricePerPerson: 370, label: "4–8 people" },
      { minGroupSize: 9,  maxGroupSize: 12, pricePerPerson: 320, label: "9–12 people" },
    ],
  },

  // ────────────────────────────────────────────────
  // 7. Legacy & Return — Diaspora Experience (Multi-Day, 4 days — challenging emotionally)
  // ────────────────────────────────────────────────
  {
    destinationSlug: "cape-coast",
    slug: "legacy-return-diaspora-experience",
    title: "Legacy & Return — Diaspora Experience",
    category: "leisure",
    description: "An emotionally profound diaspora journey designed for travelers tracing their African roots. Visit Cape Coast and Elmina Castles with specialised heritage guides, participate in libation and naming ceremonies, meet with traditional chiefs, and explore W.E.B. Du Bois's legacy. This is not a standard tour — it is a homecoming.",
    country: "ghana",
    tourType: "multi_day",
    durationDays: 4,
    difficulty: "easy",
    sellingMode: "individual_seats",
    totalCapacity: 8,
    remainingCapacity: 5,
    featured: false,
    status: "published",
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    bookingCutoffHours: 72,
    waitlistEnabled: true,
    maxWaitlistSize: 6,
    rating: 5.0,
    reviewCount: 64,
    viewCount: 490,
    bookingCount: 29,
    basePrice: 900,
    tags: ["Diaspora", "Heritage", "Cultural", "Spiritual"],
    bestFor: ["African diaspora", "Heritage seekers", "Small intimate groups", "Spiritual travelers"],
    languages: ["English", "Fante", "Twi"],
    cancellationPolicy: "Full refund if cancelled more than 14 days before. 50% within 7–14 days. No refund within 7 days.",
    pickupIncluded: true,
    pickupLocation: "Accra airport or hotel",
    transportType: "minibus",
    meetingPoint: { lat: 5.1054, lng: -1.2466 },
    meetingPointLabel: "Cape Coast Castle, Door of No Return",
    availabilitySchedule: "Monthly departures (first Saturday of each month)",
    availabilityBadge: "Limited — 8 Seats",
    featureType: "pickup",
    featureLabel: "Pickup Included",
    statusBadge: { label: "Top Rated", color: "#027920" },
    coverImage: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800",
    heroMainImage: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200",
    heroTopRight: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600",
    heroBottomLeft: "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=600",
    heroBottomRight: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600",
    images: [
      "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800",
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800",
    ],
    highlights: [
      "Private ceremony at the Door of No Return — Cape Coast Castle",
      "Libation & Akan naming ceremony with traditional priest",
      "Audience with a local chief",
      "W.E.B. Du Bois Memorial Centre, Accra",
      "Farewell durbar and community feast",
    ],
    inclusions: [
      "3 nights accommodation",
      "All meals (breakfasts + dinners)",
      "Specialised diaspora heritage guide",
      "All entrance fees and ceremony costs",
      "Return transport Accra–Cape Coast–Accra",
    ],
    exclusions: ["International flights", "Travel insurance", "Lunches", "Personal expenses"],
    itinerary: [
      {
        day: 1,
        title: "Welcome to Ghana — Arrival in Accra",
        preview: "Arrival, orientation, W.E.B. Du Bois Centre",
        activities: [
          { time: "10:00 AM", activity: "Airport pickup and welcome", tag: "Transport" },
          { time: "12:00 PM", activity: "Orientation lunch with guide", tag: "Lunch" },
          { time: "02:00 PM", activity: "W.E.B. Du Bois Memorial Centre", tag: "Sightseeing" },
          { time: "07:00 PM", activity: "Welcome dinner at guesthouse", tag: "Dinner" },
        ],
      },
      {
        day: 2,
        title: "Cape Coast Castle — The Door of No Return",
        preview: "Heritage castle, libation ceremony, ocean reflection",
        activities: [
          { time: "07:00 AM", activity: "Drive to Cape Coast", tag: "Transport" },
          { time: "09:30 AM", activity: "Cape Coast Castle guided heritage tour", tag: "Sightseeing" },
          { time: "12:00 PM", activity: "Libation ceremony at Door of No Return", tag: "Ceremony" },
          { time: "02:00 PM", activity: "Lunch and reflection time at the beach", tag: "Leisure" },
          { time: "06:00 PM", activity: "Elmina Castle sunset visit", tag: "Sightseeing" },
        ],
      },
      {
        day: 3,
        title: "Naming Ceremony & Chief's Audience",
        preview: "Akan naming ceremony, chief's palace, cultural feast",
        activities: [
          { time: "09:00 AM", activity: "Akan naming ceremony with traditional priest", tag: "Ceremony" },
          { time: "11:30 AM", activity: "Audience with the local Omanhene (chief)", tag: "Culture" },
          { time: "01:00 PM", activity: "Community lunch with local families", tag: "Lunch" },
          { time: "03:00 PM", activity: "Kakum National Park walk", tag: "Nature" },
          { time: "07:00 PM", activity: "Farewell cultural feast & drumming", tag: "Dinner" },
        ],
      },
      {
        day: 4,
        title: "Return to Accra — Departure",
        preview: "Morning reflection, craft market, Accra departure",
        activities: [
          { time: "08:00 AM", activity: "Breakfast & checkout", tag: "Breakfast" },
          { time: "09:30 AM", activity: "Cape Coast craft market — take a piece of Ghana home", tag: "Shopping" },
          { time: "11:30 AM", activity: "Depart for Accra", tag: "Transport" },
          { time: "03:00 PM", activity: "Arrive Accra — airport or hotel drop-off", tag: "Transport" },
        ],
      },
    ],
    categoryRatings: [
      { label: "Emotional impact", score: 5.0 },
      { label: "Guide quality", score: 5.0 },
      { label: "Cultural authenticity", score: 5.0 },
      { label: "Value for money", score: 4.8 },
    ],
    importantInformation: {
      blocks: [
        { title: "Emotional preparation", body: "The castle visits and Door of No Return ceremony are deeply moving experiences. We encourage guests to speak to previous travelers and prepare emotionally." },
        { title: "Naming ceremony", body: "You will receive an Akan day-name based on the day of the week you were born. The ceremony is respectful and non-obligatory." },
        { title: "Group size", body: "Maximum 8 guests per departure to maintain intimacy. This is a sacred journey, not a mass-tour." },
      ],
      footerNote: "Portions of tour fees support the Cape Coast Castle Education Fund.",
    },
    bookingAddOns: [
      { id: "ancestral-research", label: "Pre-trip ancestral research consultation", priceGhc: 500 },
      { id: "professional-video", label: "Professional video documentary of your journey", priceGhc: 800 },
    ],
    pricingTiers: [
      { minGroupSize: 1,  maxGroupSize: 2,  pricePerPerson: 1200, label: "1–2 people" },
      { minGroupSize: 3,  maxGroupSize: 5,  pricePerPerson: 1050, label: "3–5 people" },
      { minGroupSize: 6,  maxGroupSize: 8,  pricePerPerson: 900, label: "6–8 people" },
    ],
  },

  // ────────────────────────────────────────────────
  // 8. Canopy Bridges & Adventure at Kakum (Day Tour — challenging)
  // ────────────────────────────────────────────────
  {
    destinationSlug: "cape-coast",
    slug: "canopy-bridges-kakum",
    title: "Canopy Bridges & Adventure at Kakum",
    category: "ekolure",
    description: "An adrenaline-filled day at Kakum National Park's famous canopy walkway. Suspended 30 metres above the rainforest floor across seven swaying bridges, this is one of only three such walkways in Africa. Combine with a ground-level rainforest trail and a visit to Hans Cottage Botel's crocodile pond.",
    country: "ghana",
    tourType: "day_tour",
    durationDays: 1,
    difficulty: "challenging",
    sellingMode: "individual_seats",
    totalCapacity: 10,
    remainingCapacity: 6,
    featured: false,
    status: "published",
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    bookingCutoffHours: 24,
    waitlistEnabled: false,
    rating: 4.6,
    reviewCount: 88,
    viewCount: 610,
    bookingCount: 41,
    basePrice: 300,
    tags: ["Adventure", "Nature", "Rainforest", "Adrenaline"],
    bestFor: ["Adventure seekers", "Nature lovers", "Thrill-seekers", "Families with teens"],
    languages: ["English", "Fante"],
    cancellationPolicy: "Full refund if cancelled more than 48 hours before. No refund within 24 hours.",
    pickupIncluded: false,
    meetingPoint: { lat: 5.3358, lng: -1.3817 },
    meetingPointLabel: "Kakum National Park main entrance, Abrafo",
    availabilitySchedule: "Daily departures (6:00 AM – 3:00 PM)",
    availabilityBadge: "Opened Daily",
    statusBadge: { label: "Adrenaline Pick", color: "#c0392b" },
    coverImage: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800",
    heroMainImage: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200",
    heroTopRight: "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=600",
    heroBottomLeft: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600",
    heroBottomRight: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=600",
    images: [
      "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800",
      "https://images.unsplash.com/photo-1633613286991-611fe299a6b0?w=800",
    ],
    highlights: [
      "7 rope bridges spanning 330 metres — 30m above the forest floor",
      "One of only three canopy walkways in Africa",
      "Ground-level rainforest trail with butterfly spotting",
      "Hans Cottage Botel crocodile pond",
    ],
    inclusions: ["Park entrance fee", "Canopy walkway fee", "Ranger guide", "Bottled water"],
    exclusions: ["Transport to Kakum", "Meals", "Hans Cottage entry (pay at gate)", "Tips"],
    itinerary: [
      {
        day: 1,
        title: "Kakum Canopy Adventure",
        preview: "Canopy walkway, rainforest trail, crocodile pond",
        activities: [
          { time: "08:00 AM", activity: "Meet at Kakum entrance, safety briefing", tag: "Meeting" },
          { time: "08:30 AM", activity: "Rainforest ground trail — butterfly sanctuary", tag: "Nature" },
          { time: "10:00 AM", activity: "Canopy walkway — 7 bridges, 330 metres", tag: "Adventure" },
          { time: "11:30 AM", activity: "Lunch at Kakum visitor centre (own expense)", tag: "Lunch" },
          { time: "01:00 PM", activity: "Hans Cottage Botel crocodile pond", tag: "Sightseeing" },
          { time: "02:30 PM", activity: "Tour ends at Kakum entrance", tag: "End" },
        ],
      },
    ],
    categoryRatings: [
      { label: "Adrenaline level", score: 4.9 },
      { label: "Guide quality", score: 4.7 },
      { label: "Value for money", score: 4.8 },
      { label: "Safety briefing", score: 4.9 },
    ],
    importantInformation: {
      blocks: [
        { title: "Not suitable for", body: "Guests with severe acrophobia or mobility impairments. The walkway involves significant heights and swaying bridges." },
        { title: "Weight limit", body: "Maximum 120 kg per person on the canopy walkway." },
        { title: "Footwear", body: "Closed-toe shoes with grip required. No flip-flops or sandals on the canopy." },
      ],
      footerNote: "Kakum National Park is managed by the Forestry Commission of Ghana.",
    },
    bookingAddOns: [
      { id: "night-walk", label: "Night forest walk (extra experience)", priceGhc: 150 },
    ],
    pricingTiers: [
      { minGroupSize: 1,  maxGroupSize: 4,  pricePerPerson: 350, label: "1–4 people" },
      { minGroupSize: 5,  maxGroupSize: 10, pricePerPerson: 280, label: "5–10 people" },
    ],
  },

  // ────────────────────────────────────────────────
  // 9. Accra Bustling City & Market Tour (Multi-Day, 3 days — featured)
  // ────────────────────────────────────────────────
  {
    destinationSlug: "accra",
    slug: "accra-bustling-city-market-tour",
    title: "Accra Bustling City & Market Tour",
    category: "business",
    description: "Dive into the energetic heart of Accra with this multi-day exploration. Wander through Makola, Kantamanto, and Madina markets to experience daily Ghanaian life. Visit Jamestown's lighthouse, the W.E.B. Du Bois Memorial Centre, and Independence Square. Ends with a beach evening at Labadi.",
    country: "ghana",
    tourType: "multi_day",
    durationDays: 3,
    difficulty: "easy",
    sellingMode: "individual_seats",
    totalCapacity: 14,
    remainingCapacity: 10,
    featured: true,
    status: "published",
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    bookingCutoffHours: 48,
    waitlistEnabled: true,
    maxWaitlistSize: 8,
    rating: 4.8,
    reviewCount: 106,
    viewCount: 720,
    bookingCount: 55,
    basePrice: 380,
    tags: ["City", "Markets", "Cultural", "Beginner-friendly"],
    bestFor: ["First-time visitors", "Market lovers", "Families", "Business travelers"],
    languages: ["English", "Twi", "Ga"],
    cancellationPolicy: "Full refund if cancelled more than 7 days before. 50% within 3–7 days. No refund within 48 hours.",
    pickupIncluded: true,
    pickupLocation: "Any hotel in Accra",
    transportType: "minibus",
    meetingPoint: { lat: 5.5561, lng: -0.1969 },
    meetingPointLabel: "Independence Square, Accra",
    availabilitySchedule: "Monday & Wednesday departures",
    availabilityBadge: "Opened Daily",
    featureType: "pickup",
    featureLabel: "Pickup Included",
    statusBadge: { label: "City Favourite", color: "#1a6fd4" },
    coverImage: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800",
    heroMainImage: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1200",
    heroTopRight: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600",
    heroBottomLeft: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600",
    heroBottomRight: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600",
    images: [
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800",
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
    ],
    highlights: [
      "Makola Market — Accra's most vibrant commercial hub",
      "Jamestown fishing harbour and colonial lighthouse",
      "W.E.B. Du Bois Memorial Centre",
      "Independence Square and the Black Star Arch",
      "Labadi Beach evening",
    ],
    inclusions: [
      "2 nights accommodation in Accra",
      "All breakfasts",
      "Air-conditioned minibus",
      "Licensed guide for all 3 days",
      "All entrance fees",
    ],
    exclusions: ["Lunches & dinners", "Personal shopping", "Tips"],
    itinerary: [
      {
        day: 1,
        title: "Independence Square → Jamestown → Du Bois Centre",
        preview: "Monuments, fishing harbour, cultural history",
        activities: [
          { time: "08:00 AM", activity: "Hotel pickup", tag: "Transport" },
          { time: "09:00 AM", activity: "Independence Square & Black Star Arch", tag: "Sightseeing" },
          { time: "10:30 AM", activity: "Jamestown lighthouse & fishing harbour", tag: "Culture" },
          { time: "12:30 PM", activity: "Lunch (own expense)", tag: "Free" },
          { time: "02:00 PM", activity: "W.E.B. Du Bois Memorial Centre", tag: "Sightseeing" },
          { time: "06:00 PM", activity: "Hotel check-in", tag: "Accommodation" },
        ],
      },
      {
        day: 2,
        title: "Makola & Kantamanto Markets → National Museum",
        preview: "Markets, bargaining, textiles, and Ghana's history",
        activities: [
          { time: "08:30 AM", activity: "Breakfast at hotel", tag: "Breakfast" },
          { time: "09:30 AM", activity: "Makola Market walking tour", tag: "Culture" },
          { time: "11:30 AM", activity: "Kantamanto second-hand market", tag: "Shopping" },
          { time: "01:00 PM", activity: "Lunch (own expense)", tag: "Free" },
          { time: "02:30 PM", activity: "National Museum of Ghana", tag: "Sightseeing" },
          { time: "05:00 PM", activity: "Accra Arts Centre", tag: "Shopping" },
        ],
      },
      {
        day: 3,
        title: "Madina Market → Labadi Beach → Departure",
        preview: "Vibrant north Accra market, beach afternoon, hotel drop-off",
        activities: [
          { time: "08:30 AM", activity: "Breakfast & checkout", tag: "Breakfast" },
          { time: "09:30 AM", activity: "Madina Market exploration", tag: "Culture" },
          { time: "12:00 PM", activity: "Lunch (own expense)", tag: "Free" },
          { time: "02:00 PM", activity: "Labadi Beach (La Pleasure Beach)", tag: "Leisure" },
          { time: "05:00 PM", activity: "Hotel drop-offs", tag: "Transport" },
        ],
      },
    ],
    categoryRatings: [
      { label: "Guide quality", score: 4.9 },
      { label: "Value for money", score: 4.8 },
      { label: "Market experience", score: 4.9 },
      { label: "Transport comfort", score: 4.7 },
    ],
    importantInformation: {
      blocks: [
        { title: "Market safety", body: "Keep valuables secured in the markets. Our guide will brief you on safe practices and stay with the group at all times." },
        { title: "Currency", body: "Bring Ghanaian cedis for market shopping. ATMs are widely available in Accra." },
      ],
      footerNote: "Markets are busiest Tuesday–Saturday mornings. This tour is timed for peak atmosphere.",
    },
    bookingAddOns: [
      { id: "cooking-class", label: "Ghanaian cooking class at local home", priceGhc: 180 },
      { id: "single-room", label: "Single room supplement", priceGhc: 250 },
    ],
    pricingTiers: [
      { minGroupSize: 1,  maxGroupSize: 2,  pricePerPerson: 480, label: "1–2 people" },
      { minGroupSize: 3,  maxGroupSize: 6,  pricePerPerson: 420, label: "3–6 people" },
      { minGroupSize: 7,  maxGroupSize: 14, pricePerPerson: 350, label: "7–14 people" },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.\n");

  // 1. Upsert all destinations
  const destMap = {};
  console.log("── Destinations ──");
  for (const d of destinations) {
    const doc = await Destination.findOneAndUpdate(
      { slug: d.slug },
      { $set: d },
      { upsert: true, new: true }
    );
    destMap[d.slug] = doc._id;
    console.log(`  ✓ ${doc.name} (${doc._id})`);
  }

  // 2. Upsert all tours
  console.log("\n── Tour packages ──");
  for (const t of tours) {
    const { destinationSlug, pricingTiers, ...tourFields } = t;
    tourFields.destinationId = destMap[destinationSlug];

    const pkg = await TourPackage.findOneAndUpdate(
      { slug: tourFields.slug },
      { $set: tourFields },
      { upsert: true, new: true }
    );

    // Replace pricing tiers
    await PackagePricing.deleteMany({ packageId: pkg._id.toString() });
    const tiers = await PackagePricing.insertMany(
      pricingTiers.map((tier) => ({
        packageId: pkg._id.toString(),
        minGroupSize: tier.minGroupSize,
        maxGroupSize: tier.maxGroupSize,
        pricePerPerson: tier.pricePerPerson,
        label: tier.label,
        isActive: true,
      }))
    );

    const minPrice = Math.min(...tiers.map((tier) => tier.pricePerPerson));
    console.log(`  ✓ [${pkg.tourType}/${pkg.difficulty}] ${pkg.title}`);
    console.log(`    slug: ${pkg.slug} | featured: ${pkg.featured} | from GHS ${minPrice}`);
  }

  console.log("\n✅ Seed complete.");
  console.log(`   ${tours.length} tours | ${destinations.length} destinations`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
