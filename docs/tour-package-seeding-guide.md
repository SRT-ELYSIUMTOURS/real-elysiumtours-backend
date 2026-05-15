# Tour Package Seeding Guide

Audience: admins, content authors, and engineers seeding tour data (including the Achimota Centenary Tours).

This guide explains how to model the patterns that don't get their own schema field — shared events, dress codes, complimentary items, departure times, partner organisations — using the existing data model. Every pattern below has been validated against the Achimota brief.

---

## 1. Cross-package shared events

**Pattern:** the Combined Fundraising Alumni Dinner happens at Lancaster Hotel, Kumasi. It appears in both Tour 1 (Day 5) and Tour 2 (Day 3).

**How to model:** create ONE `DiningPartner` record for the dinner venue, then reference its ID in `diningIds[]` on each tour package's `destinations[]` entry for Kumasi.

```js
// 1. Create the shared DiningPartner once
await broker.call("diningPartner.create", {
  name: "Achimota Centenary Combined Dinner — Lancaster Hotel Kumasi",
  destinationId: kumasiDestinationId,
  cuisine: "Continental",
  // ... other DiningPartner fields
});
// → returns lancasterDinnerId

// 2. On Tour 1, reference it in the Kumasi destination subdoc
await broker.call("tourPackage.create", {
  title: "Northern Heritage Expedition",
  destinations: [
    /* ... other destinations ... */
    {
      destinationId: kumasiDestinationId,
      order: 5,
      nightsStay: 1,
      diningIds: [lancasterDinnerId],   // ← shared reference
      attractionIds: [manhyiaPalaceId],
    },
  ],
  // ...
});

// 3. On Tour 2, reference the SAME id
await broker.call("tourPackage.create", {
  title: "Western & Coastal Legacy Route",
  destinations: [
    /* ... */
    {
      destinationId: kumasiDestinationId,
      order: 3,
      nightsStay: 1,
      diningIds: [lancasterDinnerId],   // ← same reference
    },
  ],
});
```

**Why this works:** the booking flow doesn't care that two packages reference the same `DiningPartner`. The shared event lives in one place, edits propagate, and per-tour itinerary descriptions stay independent. No schema change needed.

**For ceremonies (flag-planting, durbar):** same pattern but use `Attraction` with `category: "ceremony"` referenced in `attractionIds[]`.

---

## 2. Smart attire / dress codes

**Pattern:** Tour 1's Fundraising Dinner says "Smart attire required". Tour 2's Combined Dinner has the same note.

**How to model:** put the note in the `Attraction.description` (or `DiningPartner.description`) for the specific event, AND surface it in the package's `highlights[]` so the customer sees it on the detail page without expanding the itinerary.

```js
{
  name: "Combined Fundraising Alumni Dinner",
  category: ATTRACTION_CATEGORIES.DINNER_EVENT,
  description:
    "A formal evening of speeches, fellowship, and fundraising for the " +
    "Achimota Centenary Fund. Smart attire required.",
  // ...
}
```

And on the package:

```js
highlights: [
  // ...
  "DINNER PARTY — Combined Fundraising Alumni Dinner, Kumasi (Tours 1+2 together, Day 5 evening). Smart attire required.",
]
```

The frontend can detect the "Smart attire required" string for a special-callout component if needed, or just render the highlights bullet list verbatim.

---

## 3. Complimentary items (breakfast, water, OAA service)

**Pattern:** Tour 3 has a Day 1 complimentary breakfast. All tours include 3 bottles of water/day and OAA service fees.

**How to model:** use `inclusions[]` (plain strings). The customer sees these as a bulleted list on the tour detail page.

```js
inclusions: [
  "Complimentary breakfast on Day 1 (Tour 3 only)",
  "3 bottles of bottled water per person, per day",
  "OAA (Old Achimotan Association) service costs",
  "Fundraising Alumni Dinner (formal attire required)",
  "All accommodation taxes and service charges",
]
```

**Decision rule:** if an item is included in the headline price, it goes in `inclusions[]`. If it costs extra, leave it for `exclusions[]`. The Achimota brief explicitly bundles water + dinner + OAA fees into the price — they're inclusions.

---

## 4. Departure time

**Pattern:** all three Achimota tours depart from Achimota School at 6:00 AM.

**How to model:** encode the time directly in the ISO timestamp on `startDate`. Set `pickupLocation: "Achimota School"` and `pickupIncluded: true`.

```js
{
  // Achimota School, Accra, 23 January 2027, 06:00 local (UTC+0)
  startDate: "2027-01-23T06:00:00.000Z",
  endDate: "2027-01-28T18:00:00.000Z",
  pickupIncluded: true,
  pickupLocation: "Achimota School, Accra",
  // ...
}
```

**Why this works:** `startDate` is already a `Date` field — it stores time, not just date. No separate `departureTime` field needed. Frontend renders the time component with `toLocaleTimeString()` when relevant.

**Note:** Ghana is UTC+0 year-round — no DST. So the timestamp above is also wall-clock 6:00 AM.

---

## 5. Partner organisation (OAA, etc.)

**Pattern:** the Achimota Centenary tours are a partnership with the Old Achimotan Association.

**How to model:** create an `Organization` for the partnership and scope these tours under it via `organizationId`. Multi-tenancy is already wired through every model.

```js
// 1. Create the OAA-scoped organisation (if it doesn't already exist)
await broker.call("organization.create", {
  name: "Achimota Centenary Tours (Elysium × OAA)",
  slug: "achimota-centenary",
  status: ORG_STATUSES.ACTIVE,
  // ...
});
// → returns oaaOrgId

// 2. Set ctx.meta.organizationId to oaaOrgId on subsequent calls
//    (handled by the tenantScope middleware via X-Tenant-Slug header)
await broker.call("tourPackage.create", { /* ... */ }, {
  meta: { user, organizationId: oaaOrgId },
});
```

When the OAA-Elysium partnership grows, the entire OAA catalogue lives under that organisation and can be branded / reported separately. No new schema needed.

**Caveat:** the customer-facing tourist site currently consumes `v1` (no tenant header). For tenant-scoped Achimota tours to appear there, either (a) seed under the default Elysium org, or (b) point the tourist site to `v2/api` with the `X-Tenant-Slug: achimota-centenary` header. Decide with product before seeding.

---

## 6. Customer overlap warning

**Pattern:** Achimota Tour 1 ends 28 Jan; Tour 3 also ends 28 Jan, starting 26 Jan. A customer trying to book both should be warned (not blocked).

**How to use:** call `POST /api/v1/bookings/check-overlap` before showing the booking confirmation step.

```http
POST /api/v1/bookings/check-overlap
Authorization: Bearer <token>
Content-Type: application/json

{
  "tourDate": "2027-01-26T06:00:00.000Z",
  "endDate":  "2027-01-28T18:00:00.000Z"
}
```

Response:
```json
{
  "hasOverlap": true,
  "overlaps": [{
    "bookingId": "...",
    "bookingRef": "ELY-BK-001",
    "status": "confirmed",
    "tourDate": "2027-01-23T06:00:00.000Z",
    "endDate":  "2027-01-28T18:00:00.000Z",
    "packageId": "...",
    "groupSize": 2
  }]
}
```

If `hasOverlap` is `true`, prompt the customer with the conflicting booking's ref and dates and let them decide. `createBooking` also runs the check server-side and returns an `overlapWarning` field on the response (non-fatal). The customer is never hard-blocked — admins handle truly conflicting bookings manually.

**Status filter:** the check only counts bookings in active statuses (`pending_partner_confirmation`, `pending_payment`, `payment_processing`, `confirmed`, `fully_paid`, `tour_scheduled`, `tour_in_progress`). Cancelled and completed bookings never raise a warning.

---

## 7. Structured attraction categories

**Pattern:** flag plantings, dinners, safaris, slave-trade sites, palaces, waterfalls — all distinct event types that benefit from consistent tagging for frontend filters and analytics.

**How to use:** fetch the canonical list at admin form-load time:

```http
GET /api/v1/partners/attractions/categories
```

Returns:
```json
[
  { "value": "natural_site",      "label": "Natural Site" },
  { "value": "wildlife_tour",     "label": "Wildlife Tour" },
  { "value": "museum",            "label": "Museum" },
  { "value": "palace",            "label": "Palace" },
  { "value": "monument",          "label": "Monument" },
  { "value": "bridge",            "label": "Bridge" },
  { "value": "slave_trade_site",  "label": "Slave Trade Site" },
  { "value": "fort",              "label": "Fort" },
  { "value": "religious_site",    "label": "Religious Site" },
  { "value": "cultural_village",  "label": "Cultural Village" },
  { "value": "beach",             "label": "Beach" },
  { "value": "boat_ride",         "label": "Boat Ride" },
  { "value": "hiking",            "label": "Hiking" },
  { "value": "ceremony",          "label": "Ceremony" },
  { "value": "dinner_event",      "label": "Dinner Event" },
  { "value": "performance",       "label": "Performance" },
  { "value": "market",            "label": "Market" },
  { "value": "other",             "label": "Other" }
]
```

**Mapping for the Achimota brief:**

| Brief item | Category |
|---|---|
| Kintampo Waterfalls | `natural_site` |
| Red Clay Ethnographic Museum | `museum` |
| Gambaga / Wiawso / Keta Flag Planting | `ceremony` |
| Mole National Park Safari | `wildlife_tour` |
| Shea Butter Village | `cultural_village` |
| Manhyia Palace | `palace` |
| Fundraising Alumni Dinner | `dinner_event` |
| Assin Manso Slave River Site | `slave_trade_site` |
| Elmina Castle | `slave_trade_site` (or `fort`) |
| Adomi Bridge | `bridge` |
| Dodi Princess Boat Ride | `boat_ride` |
| Fort Prinzenstein | `fort` |
| Keta Lagoon Sunset Walk | `beach` |

**Soft-enum note:** the `Attraction.category` field is not mongoose-enum-constrained, so legacy free-form values won't break. New entries should always use a value from `listCategories` for consistency.

---

## 8. Quick checklist for seeding the three Achimota tours

When you sit down to seed, work in this order:

- [ ] Destinations: `Kintampo`, `Tamale`, `Gambaga`, `Mole`, `Kumasi`, `Cape Coast`, `Wiawso`, `Elmina`, `Atimpoku`, `Dodi Island`, `Keta`, `Aborigines Beach`
- [ ] Hotel partners with `tier` set (3-star/4-star/5-star variants in Tamale, Kumasi, etc.) — these populate the `accommodationOptions[].destinationHotels[]` map
- [ ] Attractions with structured `category` (use the table in §7)
- [ ] DiningPartners — including the ONE shared Combined Dinner record at Lancaster Hotel
- [ ] Forex rate: seed at least one `USD → GHS` rate via `POST /api/v1/forex-rates` before going live
- [ ] Organization (optional, only if scoping under OAA partnership)
- [ ] Tour packages with:
  - `displayCurrency: "USD"`
  - `accommodationOptions[]` populated per the brief's tier ranges
  - `destinations[]` with per-destination `hotelPartnerId`, `diningIds`, `attractionIds`
  - `startDate` carrying the 06:00 departure time
  - `pickupLocation: "Achimota School"`
  - `inclusions[]` listing water, dinner, OAA fees, breakfast (Tour 3 only)
  - `highlights[]` echoing the brief's bullet list verbatim

---

## 9. What is NOT handled by seeding

Two things in the brief still require frontend cooperation or product decisions:

1. **Auto-cancellation on payment default.** No backend cron does this. Admin must manually cancel + refund. Diagram 7 implies an auto-cancel grace period but the code doesn't implement it.
2. **7-day and day-of payment reminders.** Only the 3-day-before reminder is wired (`paymentPlan.sendReminders`). Earlier reminders are TBD — flag for product if the marketing team promises them.

Otherwise, the schema and existing services cover everything in the Achimota brief.
