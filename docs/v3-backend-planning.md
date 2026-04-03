# V3 Backend & Admin Planning — Data Gap Analysis

> Generated from deep dive of tourist frontend, v2_fixed diagrams, PRD, and current backend models.
> Date: 2026-04-03

---

## 1. TOUR PACKAGE — Missing Fields

### Frontend expects (from PopularTourCard, TourDetailPage):
| Field | Frontend Uses | Backend Has | Status |
|-------|--------------|-------------|--------|
| `title` | Yes | Yes | OK |
| `description` | Yes | Yes | OK |
| `slug` | Navigation | Yes | OK |
| `images[]` | Gallery, hero | Yes | OK |
| `rating` | Star display (4.9) | **NO** | MISSING |
| `reviewCount` | "231 reviews" | **NO** | MISSING |
| `price` | "Ghs.400.00" | Via pricingTiers | DERIVED — need formatted price field or API to return base price |
| `location` | "Cape Coast/Ghana" | Via destinationId ref | DERIVED — need populated destination name |
| `country` | Navigation, filter | **NO** | MISSING — destination has `region` but not `country` |
| `duration.class` | "Multi-Day" / "Day Tour" | **NO** | MISSING — has `durationDays` but not class/span format |
| `duration.span` | "3 Days/2 Nights" | **NO** | MISSING — same |
| `availabilityBadge` | "Opened Daily" | **NO** | MISSING |
| `tags[]` | ["Cultural", "Diaspora"] | **NO** | MISSING — no tour type/category tags |
| `maxGroupSize` | "Max 12 guests" | Via pricingTiers.maxGroupSize | DERIVED |
| `pickupIncluded` | Pickup icon | **NO** | MISSING |
| `featureType` | "eco"/"lunch"/"business"/"pickup" | **NO** | MISSING |
| `featureLabel` | Feature text | **NO** | MISSING |
| `statusBadge` | { label, color } | `status` field exists | PARTIAL — need mapping |
| `languages` | "English" | **NO** | MISSING |
| `cancellation` | "Free cancellation" | **NO** | MISSING — no cancellation policy field |
| `bestFor[]` | ["Families", "Groups"] | **NO** | MISSING |
| `included[]` | [{type:"check", text}] | `inclusions[]` (strings only) | PARTIAL — no check/cross type |
| `guide` | { name, rating, reviews, speciality, image } | **NO** | MISSING — no guide/tour leader model |
| `reviews[]` | Individual reviews with ratings | Via review.model | OK but not embedded |
| `ratingBreakdown` | { 5: count, 4: count, ... } | **NO** | MISSING — need aggregation endpoint |
| `heroMainImage` | Main hero image | `images[0]` | DERIVED |
| `itinerary[].activities[]` | Day-by-day activities | Yes | OK |

### Image fields gap:
Backend has `images: [String]` (flat gallery array). Frontend TourDetailPage needs:
- `coverImage` — main hero image (left panel, 856x717)
- `heroImages: [String]` — 2 secondary hero images (top-right, bottom-right stacked)
- `images[]` — full gallery (exists, used for "3 of 24 images" modal)

Convention: add `coverImage` + `heroImages` to model. For cards, use `coverImage` or `images[0]`.

### Fields to add to TourPackage model:
```
coverImage: String (main card/hero image)
heroImages: [String] (secondary hero images for detail page layout)
rating: Number (aggregated from reviews, cached)
reviewCount: Number (aggregated, cached)
tags: [String] (e.g., ["Cultural", "Heritage", "Diaspora"])
country: String (or derive from destination.country)
durationLabel: String (e.g., "3 Days/2 Nights")
tourType: String enum ["day_tour", "multi_day", "express"]
availabilitySchedule: String (e.g., "Opened Daily", "Weekends Only")
pickupIncluded: Boolean
pickupLocation: String
languages: [String] (e.g., ["English", "French", "Twi"])
cancellationPolicy: String (e.g., "Free cancellation up to 24h")
bestFor: [String] (e.g., ["Families", "Couples", "Solo Travelers"])
featuredBadge: { type: String, label: String }
minAge: Number
maxAltitude: Number (for adventure tours)
difficulty: String enum ["easy", "moderate", "challenging"]
```

---

## 2. DESTINATION — Missing Fields

### Frontend expects (from FeaturedDestinationCard, sections):
| Field | Frontend Uses | Backend Has | Status |
|-------|--------------|-------------|--------|
| `name` | Yes | Yes | OK |
| `description` | Yes | Yes | OK |
| `images[]` | Yes | Yes | OK |
| `subtitle` | "Discover Ghana's most..." | **NO** | MISSING |
| `country` | Filter, nav | **NO** | MISSING — only `region` |
| `tourCount` | "5 tours" | **NO** | MISSING — need aggregation |
| `highlights[]` | Yes | Yes | OK |
| `weather` | Weather tips | **NO** | MISSING |
| `bestTimeToVisit` | Season info | **NO** | MISSING |
| `travelTips` | Tips section | **NO** | MISSING |

### Image fields gap:
Backend has `images: [String]` (flat gallery array). Frontend needs:
- `coverImage` — single hero/banner for destination detail page
- `image` for cards is derived from `coverImage` or `images[0]`

Convention: add `coverImage` to model, API returns `coverImage` for cards, `images` for gallery.

### Fields to add to Destination model:
```
country: String, required (e.g., "Ghana", "Senegal")
subtitle: String (tagline for cards e.g., "Discover Ghana's most captivating destinations")
coverImage: String (hero/banner image, separate from gallery)
tourCount: Number (cached aggregation)
weather: { avgTemp: Number, rainyMonths: [String], bestMonths: [String] }
bestTimeToVisit: String
travelTips: [String]
aboutText: String (longer "about" text for detail page)
```

---

## 3. PARTNER MODELS — Missing Fields

### Hotels — Frontend expects (PartnerListingCard):
| Field | Frontend Needs | Backend Has | Status |
|-------|---------------|-------------|--------|
| `name` | Yes | Yes | OK |
| `rating` | Star rating | **NO** | MISSING |
| `title` | Experience title | **NO** | MISSING |
| `location` | "Cape Coast / Central" | Via destinationId | DERIVED |
| `availability` | "Opened Daily" | `availabilityStatus` | PARTIAL |
| `price` | Display price | Via `rateData.standardRate` | DERIVED |
| `partnerName` | Display name | `name` | OK |
| `starRating` | 1-5 stars | **NO** | MISSING on model (admin form has it but schema doesn't) |

### Fields to add to HotelPartner:
```
starRating: Number, min: 1, max: 5
rating: Number (from reviews, cached)
reviewCount: Number
shortDescription: String
coverImage: String (main display image)
priceRange: String enum ["budget", "moderate", "premium", "luxury"]
```

### Attractions — missing:
```
rating: Number
reviewCount: Number
coverImage: String
duration: String (e.g., "2-3 hours")
suitableFor: [String] (e.g., ["families", "adventure", "history"])
```

### Dining — missing:
```
rating: Number
reviewCount: Number
coverImage: String
priceRange: String enum ["budget", "moderate", "premium", "luxury"]
openingHours: { open: String, close: String, closedDays: [String] }
```

### Transport — missing:
```
coverImage: String
rating: Number
serviceArea: [String] (currently missing from model, present in admin form)
baseRatePerKm: Number (missing from model, present in admin form)
```

---

## 4. REVIEW/TESTIMONIAL — Missing Fields

### Frontend expects (TestimonialCard):
| Field | Frontend Needs | Backend Has | Status |
|-------|---------------|-------------|--------|
| `quote` | Headline quote | **NO** | MISSING |
| `body` | Full text | `comment` | RENAME or add `quote` |
| `attribution` | "Sarah M., UK" | **NO** | MISSING — need to derive from user |
| `reviewerName` | Display name | Via `customerId` ref | DERIVED |
| `timestamp` | "2 weeks ago" | `createdAt` | DERIVED |
| `rating` | Stars | Yes | OK |
| `avatar` | Reviewer photo | Via user ref | DERIVED |
| `title` | Review title | Yes | OK |

### Fields to add to Review:
```
quote: String (short headline excerpt)
```
The rest can be populated via user reference joins.

---

## 5. GALLERY — No Model Exists

### Frontend expects (GalleryMasonryCard, GalleryPhotoCard, GalleryVideoCard):
```
id, image, title, count, isVideo, size, videoUrl
```

### Need new Gallery/Media model:
```
GalleryItem {
  title: String
  organizationId: ObjectId
  type: String enum ["photo", "video"]
  url: String (Cloudinary URL)
  thumbnailUrl: String
  destinationId: ObjectId (optional)
  tourPackageId: ObjectId (optional)
  category: String (e.g., "heritage", "nature", "adventure")
  tags: [String]
  caption: String
  sortOrder: Number
  isPublished: Boolean
  createdAt, updatedAt
}
```

---

## 6. BLOG — No Model Exists (CMS Sync)

### Frontend expects (BlogContentCard):
```
image, category, title, subLabel, size, slug, author, publishedAt, excerpt, content
```

The architecture references **Sanity CMS** for blog content with a `cms.service.js` for syncing. Check if the CMS service endpoints cover all these fields.

### If moving away from Sanity, need Blog model:
```
BlogPost {
  title: String
  slug: String
  excerpt: String
  content: String (rich text/markdown)
  coverImage: String
  category: String
  tags: [String]
  author: { name: String, avatar: String }
  publishedAt: Date
  isPublished: Boolean
  organizationId: ObjectId
}
```

---

## 7. MISSING SERVICES/FLOWS

### 7a. Guide/Tour Leader — No model exists
Frontend TourDetailPage shows a tour guide with name, rating, reviews, speciality, image. No backend model for this.

```
TourGuide {
  name: String
  organizationId: ObjectId
  specialities: [String]
  languages: [String]
  bio: String
  avatar: String
  rating: Number (cached)
  reviewCount: Number (cached)
  isActive: Boolean
}
```
TourPackage would need a `guideId: ObjectId` reference.

### 7b. Rating Aggregation — No endpoint
Frontend shows tour ratings (4.9 stars, 231 reviews). Backend `review.service.js` has `getStats` which returns aggregated stats, but the result isn't cached on the tour package. Need:
- Cron/event to recalculate `rating` and `reviewCount` on TourPackage when a review is created/updated/deleted
- OR compute on-the-fly in `tourPackage.get`

### 7c. Search & Filter Infrastructure
Frontend has complex filters:
- Tour type filter (Cultural, Adventure, Heritage, etc.) — needs `tags[]` on TourPackage
- Country filter — needs `country` on Destination
- Price range filter — needs min/max price computation from pricingTiers
- Duration filter — needs `tourType` or `durationDays` range
- Sort by: recent, oldest, popular, price-asc, price-desc — `popular` needs booking count or view count

### 7d. Contact Form Submissions — Missing admin view
Backend has `contact.service.js` with `submit` and `submitNewsletter`. The admin interface should list contact submissions. Need:
```
ContactSubmission {
  name: String
  email: String
  phone: String
  subject: String
  message: String
  status: enum ["new", "read", "responded"]
  organizationId: ObjectId
  respondedAt: Date
  respondedBy: ObjectId
}
```
Currently the contact service may just send an email without persisting.

### 7e. FAQ Model — Missing
Frontend has FAQAccordion component. FAQs are likely from Sanity CMS, but if self-hosted:
```
FAQ {
  question: String
  answer: String
  category: String
  sortOrder: Number
  isPublished: Boolean
  organizationId: ObjectId
}
```

---

## 8. STATE MACHINE GAPS (Diagram 11 vs bookingStates.config.js)

### Diagram 11 shows these states not in the config:
| State | In Diagram | In Config | Gap |
|-------|-----------|-----------|-----|
| Browsing | Yes | No | UI-only state |
| Selection | Yes | No | UI-only state |
| GroupBuyStart | Yes | No | Not implemented |
| IndividualSeatStart | Yes | No | Mapped to sellingMode |
| CheckCapacity | Yes | No | Service logic |
| SelectGroupSize | Yes | No | UI flow |
| ContractAcceptance | Yes | Yes (booking flow) | OK |
| CommitmentPayment | Yes | Yes (payment_processing) | OK |
| BookingConfirmed | Yes | Yes (confirmed) | OK |
| PaymentPlanActive | Yes | Yes (in paymentPlan) | OK |
| MilestonePayments | Yes | Yes (in milestones) | OK |
| FullyPaid | Yes | No explicit state | MISSING — need `fully_paid` booking state |
| TourScheduled | Yes | Yes | OK |
| InProgress | Yes | Yes | OK |
| Completed | Yes | Yes (tour_completed) | OK |
| CancellationOverdue | Yes | No | MISSING — for overdue payment cancellation |
| ReviewQuote | Yes | Yes (in quotes) | OK |
| AcceptQuote | Yes | Yes | OK |
| ExpressionOfInterest | Yes | Yes (interest model) | OK |
| WaitThreshold | Yes | No | MISSING — threshold trigger logic |
| AcceptInvitation | Yes | No | PARTIAL — interest.convertToBulkInvitation exists |

### States to add to booking config:
```
fully_paid: ["tour_scheduled"]  // after all milestones paid
cancellation_overdue: ["cancelled"]  // auto-cancel on payment default
```

---

## 9. ADMIN INTERFACE ADJUSTMENTS NEEDED

Based on the role analysis and data gaps:

### Super Admin Dashboard should show:
- Platform health (services running) — endpoint exists but not surfaced
- Per-tenant usage vs plan limits — need to track API call counts per org
- Subscription expiry alerts — need cron job to check endDate

### Org Admin needs:
- Contact form submissions list (new service/model needed)
- Blog/CMS management (if moving off Sanity)
- Gallery management (new model needed)
- Review moderation (respond to reviews) — endpoint exists
- Guide/team management (new model needed)

### Staff Pricing Desk needs:
- Cost estimation helper that auto-populates from partner data — `pricingDesk.estimateCost` exists
- SLA color coding in the queue (green/yellow/red based on deadline)
- Quote revision history tracking
- Customer communication log within quote detail

---

## 10. PRIORITY ORDER FOR V3

### P0 — Critical (blocks frontend from showing real data):
1. Add `rating`, `reviewCount`, `tags[]`, `country` to TourPackage (or derived fields)
2. Add `country`, `subtitle`, `tourCount` to Destination
3. Add `starRating`, `rating` to HotelPartner
4. Implement rating aggregation (event-driven cache on tour/partner)
5. Add Gallery model + CRUD service

### P1 — Important (rich frontend experience):
6. Add `languages`, `cancellationPolicy`, `bestFor[]`, `pickupIncluded`, `tourType` to TourPackage
7. Add `weather`, `bestTimeToVisit`, `travelTips` to Destination
8. Add TourGuide model + reference from TourPackage
9. Add ContactSubmission model + list endpoint for admin
10. Add `rating`, `coverImage` to all partner models

### P2 — Nice to have:
11. Blog model (if replacing Sanity CMS)
12. FAQ model (if self-hosted)
13. `fully_paid` and `cancellation_overdue` booking states
14. Subscription usage tracking for tenant billing
15. `difficulty`, `minAge` for adventure tours

---

## 11. ADMIN FORM UPDATES NEEDED AFTER V3

When backend models get new fields, update these admin forms:

| Resource | New Fields to Add |
|----------|------------------|
| TourPackageCreate/Edit | tags, tourType, languages, cancellationPolicy, bestFor, pickupIncluded, rating (read-only), reviewCount (read-only) |
| DestinationCreate/Edit | country, subtitle, weather, bestTimeToVisit, travelTips, coverImage |
| HotelCreate/Edit | starRating, rating (read-only), coverImage, shortDescription |
| AttractionCreate/Edit | rating (read-only), coverImage, duration, suitableFor |
| DiningCreate/Edit | rating (read-only), coverImage, openingHours |
| TransportCreate/Edit | coverImage, rating (read-only), serviceArea, baseRatePerKm |
| New: GalleryResource | Full CRUD for gallery items |
| New: TourGuideResource | Full CRUD for tour guides |
| New: ContactSubmissions | Read-only list with respond action |
