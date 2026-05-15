"use strict";

/**
 * Seed script — creates realistic reviews for all published tour packages.
 * Also creates seed customer users (used as review authors).
 * Run: node scripts/seedReviews.js
 * Requires MONGO_URI in .env
 *
 * Safe to re-run: clears existing seed reviews (seeded=true) then re-inserts.
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

const TourPackage = mongoose.model(
  "TourPackage",
  new mongoose.Schema({}, { strict: false, collection: "tourpackages", timestamps: true })
);
const User = mongoose.model(
  "User",
  new mongoose.Schema({}, { strict: false, collection: "users", timestamps: true })
);
const Review = mongoose.model(
  "Review",
  new mongoose.Schema({}, { strict: false, collection: "reviews", timestamps: true })
);

// ── Seed customers ────────────────────────────────────────────────────────────

const SEED_CUSTOMERS = [
  { firstName: "Sarah",    lastName: "Mitchell",     email: "sarah.mitchell.seed@elysiumtours.com",  avatar: null },
  { firstName: "James",    lastName: "Osei",         email: "james.osei.seed@elysiumtours.com",      avatar: null },
  { firstName: "Priya",    lastName: "Kapoor",       email: "priya.kapoor.seed@elysiumtours.com",    avatar: null },
  { firstName: "David",    lastName: "Amankwah",     email: "david.amankwah.seed@elysiumtours.com",  avatar: null },
  { firstName: "Angela",   lastName: "Thompson",     email: "angela.thompson.seed@elysiumtours.com", avatar: null },
  { firstName: "Kofi",     lastName: "Mensah",       email: "kofi.mensah.seed@elysiumtours.com",     avatar: null },
  { firstName: "Fatima",   lastName: "Diallo",       email: "fatima.diallo.seed@elysiumtours.com",   avatar: null },
  { firstName: "Marcus",   lastName: "Williams",     email: "marcus.williams.seed@elysiumtours.com", avatar: null },
  { firstName: "Ama",      lastName: "Boateng",      email: "ama.boateng.seed@elysiumtours.com",     avatar: null },
  { firstName: "Chen",     lastName: "Wei",          email: "chen.wei.seed@elysiumtours.com",        avatar: null },
  { firstName: "Estella",  lastName: "Sackey",       email: "estella.sackey.seed@elysiumtours.com",  avatar: null },
  { firstName: "Robert",   lastName: "Johnson",      email: "robert.johnson.seed@elysiumtours.com",  avatar: null },
];

// ── Reviews per tour ──────────────────────────────────────────────────────────
// Key = tour slug. Each review: { authorIndex (0-based into SEED_CUSTOMERS), rating, title, comment, daysAgo, isVerified }

const REVIEWS_BY_TOUR = {
  "elmina-heritage-coastal-journey": [
    {
      authorIndex: 0, rating: 5,
      title: "Life-changing — every person of African descent should do this",
      comment: "Standing inside Cape Coast Castle and walking through the Door of No Return was one of the most powerful moments of my life. Our guide connected every historical detail to the present in a way that no textbook ever could. The canopy walk at Kakum was the perfect counterbalance — joyful and exhilarating. Elysium's organisation was flawless; every transfer, every meal, every moment was thought through. I've already recommended this to my entire family.",
      daysAgo: 12, isVerified: true,
    },
    {
      authorIndex: 1, rating: 5,
      title: "History, beauty, and culture in one journey",
      comment: "Three days that felt like a deep breath of Ghana. The castles were emotional and necessary — our guide gave us space to feel and time to process. Kakum's canopy walk the next morning felt like a release, almost ceremonial. The seafood dinner at Hans Cottage with the lagoon view will stay with me. Transport was punctual and comfortable. Truly world-class guiding.",
      daysAgo: 28, isVerified: true,
    },
    {
      authorIndex: 2, rating: 5,
      title: "Exceeded every expectation",
      comment: "I came as a solo traveler a bit nervous about joining a group tour. Within the first hour I felt completely at ease. The group of 8 was warm and curious, and our guide set a tone of respect and reflection from the start. The hotel was clean and comfortable; the food was excellent. Day 2's cultural evening with drumming and dance was a genuine highlight. I'm already planning a return.",
      daysAgo: 45, isVerified: true,
    },
    {
      authorIndex: 3, rating: 5,
      title: "A must for diaspora travelers",
      comment: "My grandmother always talked about Ghana. Coming here felt like completing something. The ceremony at the castle was deeply moving. What surprised me most was how joyful the overall trip felt — the markets, the beach morning, the laughter with locals. Elysium found the right balance between historical weight and celebration of Ghanaian culture today.",
      daysAgo: 60, isVerified: true,
    },
    {
      authorIndex: 4, rating: 4,
      title: "Wonderful experience — minor logistics hiccup",
      comment: "Overall a beautiful, well-organised tour. The guide was exceptional — knowledgeable, passionate, and patient. The hotel was good, the food was great. We had a slight delay on Day 1 pickup (about 40 minutes) which pushed the castle tour later than planned, but the guide adapted well. Small thing in an otherwise excellent trip. Would absolutely recommend.",
      daysAgo: 70, isVerified: false,
    },
    {
      authorIndex: 10, rating: 5,
      title: "The guide made this journey unforgettable",
      comment: "I've been on many heritage tours across West Africa but this was genuinely the best. The depth of historical knowledge was remarkable — every question was answered with care and context. The itinerary was perfectly paced: challenging emotionally but always supported. The boat ride near Elmina at sunset was a bonus we didn't expect. Five stars without hesitation.",
      daysAgo: 90, isVerified: true,
    },
  ],

  "accra-city-culture-tour": [
    {
      authorIndex: 5, rating: 5,
      title: "The perfect introduction to Accra",
      comment: "I had one free day in Accra before a conference and booked this last minute. Best decision of the trip. Our guide covered Independence Square, the National Museum, Jamestown, and the Arts Centre without ever feeling rushed. She knew every vendor, every hidden corner. The jollof rice at the local spot near Makola was worth the trip alone. Perfect pacing for a solo day explorer.",
      daysAgo: 8, isVerified: true,
    },
    {
      authorIndex: 6, rating: 5,
      title: "Vibrant, informative, and genuinely fun",
      comment: "Accra has layers that you simply won't find on your own. Our guide peeled them back one by one — colonial history, independence, the street art scene, the music trickling from every doorway. The Jamestown fishing harbour was raw and real and beautiful. The Arts Centre was chaotic and brilliant. I left feeling like I actually understood Accra, not just photographed it.",
      daysAgo: 22, isVerified: true,
    },
    {
      authorIndex: 7, rating: 4,
      title: "Great value day tour",
      comment: "For the price this is outstanding value. Pickup was on time, the guide was friendly and well-informed, and the sites were genuinely interesting. Jamestown and the lighthouse were highlights. Only thing I'd change: a bit more time at the National Museum — we were there only 45 minutes which felt rushed for the collection on display. Still highly recommend for anyone with a day in Accra.",
      daysAgo: 35, isVerified: false,
    },
    {
      authorIndex: 8, rating: 5,
      title: "Accra in one beautiful day",
      comment: "From the moment our minibus picked us up to the final drop-off, this was a seamless experience. Our group of 6 was perfectly managed — nobody got left behind, nobody was bored. The guide's stories about Kwame Nkrumah and independence brought the monuments to life. The street food stop was unplanned and perfect. This is how city tours should be done.",
      daysAgo: 50, isVerified: true,
    },
  ],

  "accra-arts-culture-food-day": [
    {
      authorIndex: 9, rating: 5,
      title: "Arts, culture, and food done right",
      comment: "I came specifically for the food element and was not disappointed. The fusion lunch was a revelation — the chef came out to explain every dish. But what surprised me was how much I enjoyed the Cultural Centre and Nkrumah Park alongside it. The guide clearly loves Accra and that shows. Perfect mix of content. The kente demonstration was mesmerising.",
      daysAgo: 15, isVerified: true,
    },
    {
      authorIndex: 0, rating: 5,
      title: "A creative and culinary highlight of my Ghana trip",
      comment: "This tour covers a lot of ground in 8 hours without ever feeling like a checklist. The Cultural Centre visit was genuinely educational — watching a woodcarver work in real time was something I'll remember. Makola Market with a knowledgeable guide was completely different from wandering alone: she knew where to go, who to trust, what was fair price. The lunch was superb. Book this.",
      daysAgo: 40, isVerified: true,
    },
    {
      authorIndex: 11, rating: 4,
      title: "Good tour — great guide",
      comment: "The guide elevated this from good to great. Her knowledge of Ghanaian craft traditions was deep and she shared it generously. A couple of stops felt a little brief but the overall experience was positive and the fusion restaurant was a genuine standout. Good for repeat Accra visitors who want to go deeper than the headline sites.",
      daysAgo: 55, isVerified: false,
    },
  ],

  "kumasi-heritage-market-discovery": [
    {
      authorIndex: 3, rating: 5,
      title: "The heart of the Ashanti Kingdom — extraordinary",
      comment: "Kumasi deserves much more tourism attention than it gets. The Manhyia Palace Museum was fascinating — the living history of the Ashanti royal family, told with pride and precision. Kejetia Market is overwhelming in the best possible way: a kilometer of humanity, colour, and noise. The kente weaving demonstration in Bonwire was the highlight — watching a master weaver work a traditional loom is hypnotic. Our guide navigated everything with grace.",
      daysAgo: 18, isVerified: true,
    },
    {
      authorIndex: 6, rating: 5,
      title: "Cultural immersion at its finest",
      comment: "Two days was barely enough. The depth of Ashanti culture and history that our guide brought to life was remarkable. The Golden Stool story alone is worth the trip. Kejetia Market is the real Kumasi — chaotic, generous, and full of life. The overnight hotel was comfortable and central. Highly recommend adding Kumasi to any Ghana itinerary.",
      daysAgo: 38, isVerified: true,
    },
    {
      authorIndex: 4, rating: 5,
      title: "Better than Cape Coast — controversial but true",
      comment: "I say this having loved the Cape Coast tour. Kumasi just has a different energy — it felt more alive, less touristic, more like the Ghana that exists outside of the heritage trail. The palace, the market, the kente village — all genuinely compelling. The guide was one of the best I've had anywhere in West Africa: funny, deep, and patient.",
      daysAgo: 62, isVerified: true,
    },
    {
      authorIndex: 1, rating: 4,
      title: "Highly recommended with minor caveats",
      comment: "Great two-day experience in Kumasi. The palace and market were both excellent. Main improvement area: the hotel was a step below what I expected at this price point — functional but not special. Everything else was top quality. The kente workshop was the highlight of the entire trip. Worth every cedi.",
      daysAgo: 80, isVerified: false,
    },
  ],

  "mole-national-park-safari": [
    {
      authorIndex: 7, rating: 5,
      title: "Saw elephants 15 metres away. Enough said.",
      comment: "The dawn walking safari delivered something I didn't think was possible in West Africa: wild elephants at extraordinarily close range, completely undisturbed. The armed ranger's calm demeanour and our guide's quiet expertise made this feel deeply safe while remaining genuinely wild. The Larabanga Mosque was a beautiful unexpected addition. Mole Motel is basic but the pool overlooking the watering hole is magical — sunsets with elephants grazing below.",
      daysAgo: 20, isVerified: true,
    },
    {
      authorIndex: 2, rating: 5,
      title: "Ghana's best-kept secret",
      comment: "Most visitors to Ghana never make it to the north and that is a shame. Mole National Park is extraordinary. Three days felt right — enough time to do both dawn safaris and the Larabanga visit without rushing. The guide's knowledge of animal behaviour was impressive. Warthogs, baboons, antelopes, kingfishers, and the elephants. Eat at the lodge — the simple local dishes were excellent.",
      daysAgo: 42, isVerified: true,
    },
    {
      authorIndex: 8, rating: 5,
      title: "Wildlife, stars, and silence — Africa at its best",
      comment: "After the safari and dinner, we sat by the pool until midnight watching the watering hole by moonlight. Two young elephants came to drink. No fence, no barrier, just the gentle sounds of the bush. That's not a tour moment, that's a life moment. The ranger and guide were exceptional throughout. This is genuine African wildlife tourism done with integrity.",
      daysAgo: 58, isVerified: true,
    },
    {
      authorIndex: 9, rating: 4,
      title: "Incredible wildlife — logistics could be smoother",
      comment: "The wildlife experience was a genuine 5 stars — elephants, baboons, stunning birdlife. The logistics around getting to Mole (long road journey) were a bit under-explained in the booking. The lodge is basic but the location makes up for it entirely. The ranger was exceptional. One of the top safari experiences I've had in West Africa. Would do again with better pre-trip information.",
      daysAgo: 75, isVerified: true,
    },
  ],

  "wli-waterfalls-nature-exploration": [
    {
      authorIndex: 11, rating: 5,
      title: "West Africa's highest waterfall — and worth every step",
      comment: "The hike through Agumatsa Wildlife Sanctuary was beautiful before we even reached the falls — fruit bats, butterflies, tropical birds. And then the Wli Falls came into view and the whole group went quiet. Eighty metres of white water crashing into a natural pool. The swim at the base is cold and perfect. The guide had botanical and ecological knowledge that made the trail come alive. Don't skip the upper falls trail if you're fit — it's extraordinary.",
      daysAgo: 10, isVerified: true,
    },
    {
      authorIndex: 5, rating: 5,
      title: "A day I'll never forget",
      comment: "I'm not a big hiker but this was entirely manageable — moderate fitness is genuinely sufficient. The guide set the right pace for our mixed group. The waterfall is magnificent, the ecosystem around it is healthy and thriving, and the Volta Region countryside is some of the most beautiful scenery in Ghana. The local lunch spot near the trailhead was a bonus. Perfect eco-tour.",
      daysAgo: 30, isVerified: true,
    },
    {
      authorIndex: 10, rating: 5,
      title: "Exactly what eco-tourism should look like",
      comment: "The guide's environmental commentary was some of the best I've heard on any nature tour — he clearly cares about this ecosystem. The sustainability practices (no plastic, staying on trails, supporting local vendors) were modelled without being preachy. The waterfall itself is breathtaking. This is how you do responsible tourism.",
      daysAgo: 48, isVerified: true,
    },
    {
      authorIndex: 0, rating: 4,
      title: "Beautiful and worthwhile — prepare for the hike",
      comment: "The falls are stunning and the hike is genuinely rewarding. One note: the trail description says moderate but some sections were more challenging than expected, especially with recent rain. Bring good grip footwear. The guide was excellent and the naturalist commentary on the wildlife sanctuary was fascinating. Brilliant day out if you come prepared.",
      daysAgo: 65, isVerified: false,
    },
  ],

  "legacy-return-diaspora-experience": [
    {
      authorIndex: 3, rating: 5,
      title: "The most meaningful travel experience of my life",
      comment: "I've traveled extensively and nothing has come close to this. The Akan naming ceremony was profound and handled with enormous care and respect — I felt genuinely welcomed, not performed at. The audience with the chief was an unexpected privilege. Walking through the Castle with a guide who understood the emotional weight of each room was shattering in the best way. The farewell feast on the final evening brought our small group together in a way I didn't anticipate. I returned home different.",
      daysAgo: 14, isVerified: true,
    },
    {
      authorIndex: 7, rating: 5,
      title: "Sacred journey, impeccably handled",
      comment: "Elysium clearly designed this tour with deep intentionality. The maximum group size of 8 is the right call — this needed intimacy. Our guide was equal parts historian, cultural ambassador, and counsellor. The libation ceremony at the Door of No Return was perhaps the most powerful 20 minutes of my life. The research consultation add-on I booked was also worth every cedi. An irreplaceable experience.",
      daysAgo: 32, isVerified: true,
    },
    {
      authorIndex: 4, rating: 5,
      title: "I came to trace roots and found a homecoming",
      comment: "My family has been in the diaspora for four generations. This tour gave me something I can't fully articulate — a felt sense of connection and belonging. The ceremony was beautiful and the guide navigated the emotional complexity of the group (some people were weeping, some laughing, some both) with remarkable skill. The community feast on Day 3 was joyful and generous. Ghana embraced us completely.",
      daysAgo: 55, isVerified: true,
    },
    {
      authorIndex: 1, rating: 5,
      title: "Worth every penny — and I don't say that lightly",
      comment: "This is the most expensive tour I've taken and it was worth every cedi. Every element was thoughtful: the small group, the specialised guide, the ceremony, the chief's audience. What could easily feel gimmicky was instead entirely authentic and moving. The W.E.B Du Bois Centre visit on Day 1 set the intellectual tone perfectly. I cannot recommend this highly enough to any member of the African diaspora.",
      daysAgo: 78, isVerified: true,
    },
  ],

  "canopy-bridges-kakum": [
    {
      authorIndex: 8, rating: 5,
      title: "One of only three canopy walkways in Africa — do it",
      comment: "Thirty metres above the rainforest floor, swaying gently on seven suspension bridges, surrounded by the sounds of the canopy. There is nothing like it. Our guide's knowledge of the forest ecology made every bridge crossing a nature lesson. The ground trail afterward showed us a completely different layer of the rainforest. The crocodile pond at Hans Cottage was a surreal bonus. A perfect adventure day.",
      daysAgo: 16, isVerified: true,
    },
    {
      authorIndex: 2, rating: 4,
      title: "Thrilling — go early to beat the crowds",
      comment: "The canopy walkway is genuinely exhilarating and the views from the higher bridges are spectacular. Our guide was excellent — knowledgeable about every bird call and plant. One note: we arrived mid-morning and the park was quite busy. I'd strongly recommend the earliest possible slot. The ground trail was much quieter and equally rewarding. Great challenging day tour.",
      daysAgo: 36, isVerified: true,
    },
    {
      authorIndex: 5, rating: 5,
      title: "Even better than I imagined",
      comment: "I'm not great with heights but the walkway felt secure and the guide was calming and encouraging throughout. The views once you relax into it are extraordinary. The forest itself is ancient and alive — our guide pointed out trees over 200 years old. The full-day format (walkway + ground trail + Hans Cottage) was the right call. Don't do this as a quick half-day.",
      daysAgo: 52, isVerified: false,
    },
  ],

  "accra-bustling-city-market-tour": [
    {
      authorIndex: 6, rating: 5,
      title: "Accra's markets deserve a dedicated guide",
      comment: "Makola, Kantamanto, Madina — three completely different market personalities and our guide understood all of them. She knew which stalls had the best quality, who was open to negotiation, and when to move on. The Jamestown lighthouse was a beautiful contrast to the market energy — quiet and historical. The W.E.B. Du Bois Centre was a moving and important stop. This is multi-day Accra done right.",
      daysAgo: 24, isVerified: true,
    },
    {
      authorIndex: 9, rating: 5,
      title: "Three days, three layers of Accra",
      comment: "Each day revealed a different Accra. Day 1 was historic — squares, monuments, museums. Day 2 was commercial — markets, traders, the city at work. Day 3 was creative — art, music, food. The guide threaded all three together beautifully. The cooking class add-on was excellent and the guide's market contacts meant we paid local prices everywhere. Highly recommended for anyone wanting to understand rather than just see Accra.",
      daysAgo: 44, isVerified: true,
    },
    {
      authorIndex: 11, rating: 4,
      title: "Excellent guide, excellent markets, slightly long days",
      comment: "The content was brilliant — the guide knows Accra deeply and shares that knowledge generously. The markets were fascinating and Independence Square and Jamestown were excellent. My only note is that some days ran long (9+ hours) which felt tiring by day 3. Great for energetic travelers; maybe pace yourselves if you're not used to full days on your feet. Overall strongly positive.",
      daysAgo: 68, isVerified: false,
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgoDate(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.\n");

  // 1. Upsert seed customers
  console.log("── Seed customers ──");
  const customerIds = {};
  for (const c of SEED_CUSTOMERS) {
    const doc = await User.findOneAndUpdate(
      { email: c.email },
      {
        $set: {
          firstName: c.firstName,
          lastName:  c.lastName,
          email:     c.email,
          password:  "$2b$10$seedPasswordHashNotUsedForLogin",
          role:      "customer",
          isVerified: true,
          status:    "active",
        },
      },
      { upsert: true, new: true }
    );
    customerIds[SEED_CUSTOMERS.indexOf(c)] = doc._id;
    console.log(`  ✓ ${c.firstName} ${c.lastName} (${doc._id})`);
  }

  // 2. Clear existing seed reviews
  const deleted = await Review.deleteMany({ _seedData: true });
  console.log(`\n── Cleared ${deleted.deletedCount} existing seed reviews ──`);

  // 3. Insert reviews tour by tour
  console.log("\n── Reviews ──");
  let totalInserted = 0;

  for (const [slug, reviewDefs] of Object.entries(REVIEWS_BY_TOUR)) {
    const pkg = await TourPackage.findOne({ slug });
    if (!pkg) {
      console.log(`  ⚠ Tour not found: ${slug} — skipping`);
      continue;
    }

    const docs = reviewDefs.map((r) => ({
      tourPackageId: pkg._id,
      customerId:    customerIds[r.authorIndex],
      rating:        r.rating,
      title:         r.title,
      comment:       r.comment,
      isVerified:    r.isVerified,
      isPublished:   true,
      createdAt:     daysAgoDate(r.daysAgo),
      updatedAt:     daysAgoDate(r.daysAgo),
      _seedData:     true,
    }));

    await Review.insertMany(docs);

    // Update tour package with live rating stats
    const allReviews = await Review.find({ tourPackageId: pkg._id, isPublished: true });
    const count = allReviews.length;
    const avg = count > 0
      ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      : 0;

    await TourPackage.findByIdAndUpdate(pkg._id, { rating: avg, reviewCount: count });

    console.log(`  ✓ ${pkg.title}`);
    console.log(`    ${docs.length} reviews | avg rating: ${avg}`);
    totalInserted += docs.length;
  }

  console.log(`\n✅ Seed complete — ${totalInserted} reviews across ${Object.keys(REVIEWS_BY_TOUR).length} tours.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
