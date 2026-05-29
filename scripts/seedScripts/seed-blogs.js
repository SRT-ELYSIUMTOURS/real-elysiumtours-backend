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

// ─── Blog post data ───────────────────────────────────────────────────────────

const posts = [
  // ─── Post 1: Ghana Travel Guide ──────────────────────────────────────────────
  {
    title: "The Ultimate First-Timer's Guide to Travelling Ghana",
    category: "travel-guides",
    excerpt:
      "From the bustling markets of Accra to the quiet waterfalls of the Volta Region — everything a first-time visitor needs to know before landing in Ghana.",
    coverImage:
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1728&q=85",
    author: {
      name: "Davida Dzato",
      avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&q=80",
      bio: "Travel writer and Ghana enthusiast, exploring West Africa one destination at a time.",
    },
    readTime: "8 minutes read",
    tags: ["Ghana", "first-timer", "travel tips", "Accra", "West Africa"],
    isFeatured: true,
    isPublished: true,
    publishedAt: new Date("2025-05-15"),
    contentBlocks: [
      {
        type: "paragraph",
        text: "Ghana — often called the Gateway to Africa — is a country that invites you to experience its soul, not just its sights. From the moment you step off the plane and feel the warm, humid breeze, you're greeted by a rhythm that runs through everything: the laughter of street vendors calling out prices in the markets of Makola, the distant beat of drums echoing through neighborhoods, and the scent of grilled tilapia mingling with the aroma of fresh cocoa and spice.",
      },
      {
        type: "paragraph",
        text: "Every region tells a story. In the Central Region, the haunting walls of Cape Coast Castle whisper of history and resilience; in the Ashanti Kingdom, gold-adorned chiefs and ceremonial drums reflect centuries of pride and culture; while the Volta Region invites you to unwind with waterfalls, mountain trails, and tranquil lakeside escapes.",
      },
      {
        type: "pullQuote",
        text: "Ghana doesn't just show you Africa — it lets you feel it. Every handshake, every shared meal, every roadside conversation is an invitation to stay a little longer.",
      },
      {
        type: "sectionHeading",
        text: "🇬🇭 1. Understanding Ghana: From Maps into Reality",
      },
      {
        type: "subheading",
        text: "1.1 Where to Visit First?",
      },
      {
        type: "paragraph",
        text: "Start where the stories are thickest: the Central Region for history, Greater Accra for energy, and the Volta for landscapes. Each hub lets you branch out without long transfers.",
      },
      {
        type: "bulletList",
        items: [
          { term: "Coastal corridor", text: "Forts, fishing towns, and Atlantic light — ideal for a first week." },
          { term: "Inland rhythm", text: "Markets, workshops, and festivals that rarely make the brochure." },
          "A flexible route lets you slow down when a conversation deserves another hour.",
        ],
      },
      {
        type: "callout",
        calloutType: "tip",
        heading: "Best Time to Visit",
        text: "November to March is dry season — ideal weather, less humidity, and most festivals fall in this window. Avoid April–June if you dislike heavy rain.",
      },
      {
        type: "divider",
      },
      {
        type: "sectionHeading",
        text: "✈️ 2. Getting Around: From City Streets to Country Roads",
      },
      {
        type: "paragraph",
        text: "Intercity coaches and domestic flights shorten the map; rented cars and guided drives open detours. Match the mode to your comfort with navigation and time buffers.",
      },
      {
        type: "subheading",
        text: "Urban Transport",
      },
      {
        type: "paragraph",
        text: "In cities, shared minibuses (tro-tros) and ride-hails stitch neighborhoods together. Peak hours reward patience; off-peak rides can feel almost leisurely.",
      },
      {
        type: "bulletList",
        items: [
          { term: "Tro-tros", text: "Cheapest option — fixed routes, no schedule. Ask locals for the right station." },
          { term: "Bolt / Uber", text: "Available in Accra, Kumasi, and Takoradi. Always confirm the route before accepting." },
          { term: "Car rental", text: "Best for the Volta or Northern Region. An experienced local driver is worth every cedi." },
        ],
      },
      {
        type: "callout",
        calloutType: "warning",
        heading: "Road Safety",
        text: "Intercity roads are generally paved but driving standards vary. Night travel between cities is not recommended — book daytime coaches or fly.",
      },
      {
        type: "divider",
      },
      {
        type: "sectionHeading",
        text: "🚗 3. Connectivity & Safety",
      },
      {
        type: "paragraph",
        text: "Connectivity is strongest in regional capitals; download offline maps and save guesthouse Wi-Fi for uploads. Share your itinerary with someone you trust and check in at quiet intervals.",
      },
      {
        type: "callout",
        calloutType: "info",
        heading: "SIM Cards",
        text: "MTN and Vodafone Ghana SIM cards are available at the airport arrivals hall. Data bundles are affordable — a 10 GB bundle costs around GHS 50.",
      },
      {
        type: "subheading",
        text: "The Spirit of Adventure",
      },
      {
        type: "paragraph",
        text: "The best Ghana itineraries leave slack — for a festival that starts late, a chief's greeting that runs long, or a beach afternoon that turns into dinner with new friends.",
      },
      {
        type: "pullQuote",
        text: "Plan enough to feel secure. Leave enough space to be surprised. That balance is what turns a holiday into a story.",
      },
    ],
  },

  // ─── Post 2: Cape Coast destination spotlight ─────────────────────────────────
  {
    title: "Cape Coast: History, Castles, and the Atlantic Shore",
    category: "destination-highlights",
    excerpt:
      "Cape Coast is where history meets the ocean. Step inside UNESCO-listed slave castles, wander through fishing villages, and discover one of Ghana's most emotionally significant destinations.",
    coverImage:
      "https://images.unsplash.com/photo-1580502304784-8985b7eb7260?w=1728&q=85",
    author: {
      name: "Kwame Asante",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80",
      bio: "Local guide and heritage specialist based in Cape Coast.",
    },
    readTime: "6 minutes read",
    tags: ["Cape Coast", "Ghana", "heritage", "history", "castles"],
    isFeatured: false,
    isPublished: true,
    publishedAt: new Date("2025-05-20"),
    contentBlocks: [
      {
        type: "paragraph",
        text: "Standing at the edge of Cape Coast Castle, watching waves crash against the Slave Door of No Return, is one of the most powerful experiences West Africa offers. The castle is not a ruin — it is a living monument, maintained as a UNESCO World Heritage Site and a site of remembrance for the millions who passed through its dungeons.",
      },
      {
        type: "imageTriplet",
        mainSrc: "https://images.unsplash.com/photo-1580502304784-8985b7eb7260?w=1014&q=80",
        mainAlt: "Cape Coast Castle overlooking the Atlantic Ocean",
        topSrc: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=365&q=80",
        topAlt: "Colourful fishing boats on Cape Coast beach",
        bottomSrc: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=365&q=80",
        bottomAlt: "Cape Coast Castle entrance gate",
      },
      {
        type: "sectionHeading",
        text: "🏰 The Castles and Their Stories",
      },
      {
        type: "paragraph",
        text: "Cape Coast Castle and Elmina Castle, just 15 km apart, are the two most visited heritage sites in Ghana. Both were built by European traders in the 17th century and later used as holding forts during the transatlantic slave trade. Today, guided tours bring their history to life with honesty and respect.",
      },
      {
        type: "bulletList",
        items: [
          { term: "Cape Coast Castle", text: "Built by the Swedes (1653), later expanded by the British. The most visited castle in Ghana." },
          { term: "Elmina Castle", text: "The oldest European building in sub-Saharan Africa (1482), built by the Portuguese." },
          "Guided tours run daily 9am–5pm. Allow 1.5–2 hours per castle.",
        ],
      },
      {
        type: "callout",
        calloutType: "info",
        heading: "Booking Tours",
        text: "Tickets cost GHS 80 for international visitors. Audio guides are available. Photography inside the dungeons requires a paid permit.",
      },
      {
        type: "divider",
      },
      {
        type: "sectionHeading",
        text: "🌊 Beyond the Castles",
      },
      {
        type: "paragraph",
        text: "Cape Coast is more than its history. The city itself hums with colour — painted fishing canoes crowd the harbour at dawn, chop bars line the main road with tables spilling onto the pavement, and the Kotokuraba Market is a sensory labyrinth worth two hours of unhurried wandering.",
      },
      {
        type: "subheading",
        text: "Day Trips from Cape Coast",
      },
      {
        type: "bulletList",
        items: [
          { term: "Kakum National Park", text: "A 30-minute drive north. Walk the canopy walkway 30 m above the rainforest floor." },
          { term: "Elmina", text: "15 km west. Visit the castle, the Java Hill viewpoint, and the largest fishing harbour in Ghana." },
          { term: "Hans Cottage Botel", text: "Halfway between Cape Coast and Elmina — feed live crocodiles in a natural pool. Family favourite." },
        ],
      },
      {
        type: "pullQuote",
        text: "Cape Coast demands that you slow down. History doesn't rush, and neither should you.",
      },
      {
        type: "callout",
        calloutType: "tip",
        heading: "Where to Stay",
        text: "Oasis Beach Resort and Kasapа Hotel both offer sea-view rooms within walking distance of the castle. Book 2–3 weeks ahead in high season (Dec–Feb).",
      },
    ],
  },

  // ─── Post 3: Local food guide ──────────────────────────────────────────────────
  {
    title: "Eating Your Way Through Ghana: A Local Food Guide",
    category: "local-guides",
    excerpt:
      "Jollof rice debates aside, Ghanaian cuisine is a world of bold flavours, communal tables, and street-food discoveries. Here's what to order, where to find it, and what to avoid if you have a sensitive stomach.",
    coverImage:
      "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=1728&q=85",
    author: {
      name: "Abena Mensah",
      avatar: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&q=80",
      bio: "Food writer and culinary tour guide, passionate about West African street food.",
    },
    readTime: "5 minutes read",
    tags: ["food", "Ghana", "local cuisine", "jollof", "street food"],
    isFeatured: true,
    isPublished: true,
    publishedAt: new Date("2025-05-25"),
    contentBlocks: [
      {
        type: "paragraph",
        text: "Ask a Ghanaian what they miss most when they travel abroad, and nine times out of ten the answer involves food. Ghanaian cuisine is communal, flavour-forward, and unapologetically bold — built around groundnut, palm oil, fermented locust beans, and the kind of slow-cooked stews that fill a room with scent before the pot is even opened.",
      },
      {
        type: "pullQuote",
        text: "Ghanaian food is not just sustenance — it's a conversation. Every dish has a story, a season, and a grandmother behind it.",
      },
      {
        type: "sectionHeading",
        text: "🍛 Dishes You Must Try",
      },
      {
        type: "bulletList",
        items: [
          { term: "Jollof Rice", text: "The West African classic. Ghana's version uses a slightly smoky tomato base — settle the debate yourself." },
          { term: "Waakye", text: "Rice and black-eyed peas cooked together, served with stew, fried plantain, and spaghetti. A full plate for under GHS 30." },
          { term: "Fufu & Light Soup", text: "Pounded cassava and plantain in a broth with goat or fish. The Sunday ritual." },
          { term: "Kelewele", text: "Spiced fried plantain — found at every roadside stall from dusk. Perfect snack." },
          { term: "Banku & Tilapia", text: "Fermented corn dough with whole grilled tilapia and shito (pepper sauce). Order at any seafood spot in Accra or along the coast." },
        ],
      },
      {
        type: "imageTriplet",
        mainSrc: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=1014&q=80",
        mainAlt: "A spread of Ghanaian dishes",
        topSrc: "https://images.unsplash.com/photo-1547592180-85f173990554?w=365&q=80",
        topAlt: "Waakye served on banana leaf",
        bottomSrc: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=365&q=80",
        bottomAlt: "Grilled tilapia with pepper sauce",
      },
      {
        type: "divider",
      },
      {
        type: "sectionHeading",
        text: "🗺️ Where to Eat Like a Local",
      },
      {
        type: "subheading",
        text: "Accra",
      },
      {
        type: "paragraph",
        text: "Accra's food scene ranges from roadside chop bars to upscale restaurants plating traditional dishes with international technique. For the full local experience, head to Osu, La, or the side streets around Makola Market — not the malls.",
      },
      {
        type: "bulletList",
        items: [
          { term: "Buka Restaurant, Osu", text: "Open-air, noisy, and excellent. Every traditional dish done well." },
          { term: "Auntie Muni's Waakye, La Road", text: "The most talked-about waakye in Accra. Arrive before 9am or join the queue." },
          { term: "Santoku, Airport Residential", text: "For when you want chef-driven Ghanaian food in a quieter setting." },
        ],
      },
      {
        type: "callout",
        calloutType: "tip",
        heading: "The Chop Bar Rule",
        text: "If a chop bar has a queue of office workers at lunchtime, it's worth the wait. Locals eat where the food is good and the price is fair — follow them, not the TripAdvisor listings.",
      },
      {
        type: "callout",
        calloutType: "warning",
        heading: "Sensitive Stomachs",
        text: "Street food is usually prepared fresh and safe, but if you're arriving from a long-haul flight, give your gut 24 hours to adjust. Bottled water, not tap, is the rule everywhere.",
      },
      {
        type: "divider",
      },
      {
        type: "subheading",
        text: "Don't Leave Without Trying",
      },
      {
        type: "paragraph",
        text: "Ghana's street drinks deserve a mention: fresh coconut water straight from the husk, sobolo (hibiscus-ginger drink sold in sachets), and the aggressively-spiced Bitters that locals swear by for everything from fatigue to jet lag.",
      },
      {
        type: "pullQuote",
        text: "The best meals in Ghana don't come with a menu. They come with a handwritten board, a plastic chair, and a serving that could feed two.",
      },
    ],
  },
];

// ─── Seed logic ───────────────────────────────────────────────────────────────

const BlogSchema = new mongoose.Schema(
  {
    title: String,
    slug: String,
    category: String,
    excerpt: String,
    coverImage: String,
    author: {
      name: String,
      avatar: String,
      bio: String,
    },
    readTime: String,
    tags: [String],
    contentBlocks: [mongoose.Schema.Types.Mixed],
    isFeatured: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    publishedAt: Date,
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "blogs" }
);

let BlogModel;
try {
  BlogModel = mongoose.model("Blog");
} catch {
  BlogModel = mongoose.model("Blog", BlogSchema, "blogs");
}

async function seed() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.");

  let inserted = 0;
  let skipped = 0;

  for (const post of posts) {
    const slug = slugify(post.title, { lower: true, strict: true });
    const existing = await BlogModel.findOne({ slug });
    if (existing) {
      console.log(`  SKIP  "${post.title}" (slug already exists)`);
      skipped++;
      continue;
    }
    await BlogModel.create({ ...post, slug });
    console.log(`  OK    "${post.title}"`);
    inserted++;
  }

  console.log(`\nDone — ${inserted} inserted, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
