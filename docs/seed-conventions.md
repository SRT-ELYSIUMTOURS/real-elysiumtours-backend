# Seed & Content Conventions

Operational rules for how non-code product details get encoded into the existing schemas. These cover the "soft gap" items from the [Achimota readiness verdict](achimota-centenary-backend-readiness-verdict.docx) that ship via data rather than new schema fields.

Audience: anyone seeding tour packages, attractions, or partner data — admins, content team, dev seed scripts.

---

## 1. Cross-tour shared events (combined dinners, joint ceremonies)

**Example:** Achimota Tours 1 + 2 share the "Combined Fundraising Alumni Dinner" at Lancaster Hotel, Kumasi.

**Convention:** create the event as a single `DiningPartner` (or `Attraction` if it's not dining), then reference it from each tour package independently. There is no shared-event linkage; the two bookings live entirely independently and merely point at the same partner.

**Steps:**

1. Create one `DiningPartner` record:
   - `name: "Combined Centenary Alumni Dinner — Lancaster Hotel"`
   - `destinationId: <kumasi-destination-id>`
   - `cuisine` / `priceRange` / etc. as appropriate
2. On `TourPackage` 1 (Northern Heritage), add the dining partner's ID to `diningIds[]` AND mention it as a Day-5 entry in `itinerary[]`.
3. On `TourPackage` 2 (Western & Coastal), do the same — same `diningId`, Day-3 itinerary entry.
4. In `highlights[]` on both, include text like `"DINNER PARTY — Combined Fundraising Alumni Dinner, Lancaster Hotel (joint with Tour <other>)"`.

The booking flow does **not** need to know that two packages "share" an event. Capacity, dietary requests, and dinner-specific logistics are managed at the dining partner level, not the booking.

---

## 2. Structured attraction categories

**Convention:** all `Attraction.category` values should come from the canonical list exposed by `GET /api/v1/partners/attractions/categories` (also v2). The model itself accepts free-form strings for backward compatibility, but admin pickers and frontend filters must pull from the canonical list.

**Canonical categories** (from `utils/constants.js → ATTRACTION_CATEGORIES`):

| Category | Use for |
|---|---|
| `natural_site` | Waterfalls, lakes, forests (e.g. Kintampo Waterfalls, Keta Lagoon) |
| `wildlife_tour` | Safaris, sanctuaries (e.g. Mole National Park) |
| `museum` | Ethnographic, historical, art museums (e.g. Red Clay Museum) |
| `palace` | Royal seats (e.g. Manhyia Palace) |
| `monument` | Landmarks, statues |
| `bridge` | Notable bridges (e.g. Adomi Bridge) |
| `slave_trade_site` | Forts/sites tied to the slave trade (e.g. Assin Manso, Elmina Castle) |
| `fort` | Forts and castles not classed as slave-trade-specific (e.g. Fort Prinzenstein) |
| `religious_site` | Shrines, churches, mosques |
| `cultural_village` | Artisan villages (e.g. Shea Butter Village) |
| `beach` | Coastline, beach walks |
| `boat_ride` | Lake cruises, river rides (e.g. Dodi Princess) |
| `hiking` | Trails, mountains |
| `ceremony` | Flag-planting, durbars, festivals |
| `dinner_event` | Formal alumni dinners, fundraisers |
| `performance` | Music, dance, theatre |
| `market` | Cultural / craft markets |
| `other` | Escape hatch — avoid where possible |

**Rule:** if your attraction needs a new category, add it to `utils/constants.js` and update this doc — don't invent a one-off string.

---

## 3. Dress code / "smart attire required"

**Convention:** put the dress-code rule in two places so frontends can render it consistently:

1. **`Attraction.description`** — full prose explanation (e.g. "Formal evening attire required — jacket and tie or equivalent. The hotel will turn away guests in casual dress.").
2. **`TourPackage.highlights[]`** — a short tag line for the highlights reel, prefixed for easy parsing: `"DINNER PARTY — <event name>, <city> (Day N evening). Smart attire required."`.

The frontend looks for the literal string `"Smart attire required"` (case-sensitive) inside any `highlights[]` entry to render a 👔 badge. Don't reword that phrase unless the frontend convention is updated first.

No structured field exists for this — adding one would be over-engineering. Free-text wins.

---

## 4. Complimentary items (breakfast, water bottles, welcome gifts)

**Convention:** itemize complimentaries in `TourPackage.inclusions[]` as free-form strings. The frontend renders them as a bulleted checklist.

**Rules:**

- One inclusion per array entry — don't bundle ("Breakfast and water and dinner" → split into three).
- Lead with what's included, parenthesize quantity/scope:
  - `"Complimentary breakfast on Day 1"`
  - `"3 bottles of water per person per day"`
  - `"Fundraising dinner (Tour 1 Day 2 evening, Tamale)"`
- If the inclusion is **conditional** (e.g. only for Tour 1, only for double-room guests), spell it out in the same string. No flags.

---

## 5. OAA service costs & itemized fees

The Achimota brief mentions "OAA service costs" bundled into pricing. Backend has no `feeBreakdown` field — and doesn't need one for v1.

**Convention:**

- Customer-facing display: the bundled price is what shows. Add a line to `TourPackage.inclusions[]` such as `"Old Achimotan Association coordination fee included"`.
- Internal accounting (commissions, partner splits, OAA cut): handled outside the booking flow — finance maintains its own ledger.

If finance later needs an itemized fee structure exposed via API, add a `feeBreakdown: [{ label, amount, currency }]` field to `TourPackage`. Until then, free-text in `inclusions[]` is the source of truth for what the customer sees.

---

## 6. Departure time (e.g. "6:00 AM from Achimota School")

`TourPackage` has only `startDate: Date` — no separate `departureTime` field. The Date type already carries time, so encode the full departure time in the ISO string.

**Convention:**

- `startDate: "2027-01-23T06:00:00+00:00"` for the Achimota Northern Heritage Expedition.
- `pickupLocation: "Achimota School Main Gate"` to anchor the where.
- Frontend formats the time separately for display ("Departs 6:00 AM, Achimota School").

Avoid setting `startDate: "2027-01-23"` (midnight UTC) — if you do, the frontend can't distinguish "morning" from "evening" departures.

---

## 7. Partner organization (Old Achimotan Association as co-marketing partner)

The Achimota tours are co-marketed with the OAA. Backend has `Organization` for multi-tenancy, but no explicit "partner organization" entity.

**Convention:**

- Scope the three Achimota packages under an `organizationId` representing the Elysium-OAA partnership tenant (create one if it doesn't exist).
- Surface the partnership on the customer-facing detail page via `TourPackage.description` and `highlights[]`.
- Co-marketing branding (logos, copy) lives in `Organization.brandingConfig` if/when that's exposed; for v1, text-in-description is sufficient.

No new schema field is needed. If we later run many partnership tours and need queryable joins on the partner, the right move is a new `PartnerOrg` collection — not a field on TourPackage.

---

## 8. Overlap-booking warnings

`booking.checkOverlap` already detects when a customer's proposed booking overlaps an existing active booking (see [Soft-Gap #7 implementation](#)). Achimota Tour 1 (23–28 Jan) and Tour 3 (26–28 Jan) both end on the 28th — a customer trying to book both will trigger a warning.

**Convention:**

- The check is **a soft warning, not a block** — some customers legitimately book back-to-back or overlapping tours (e.g. a parent + child on different tours).
- The frontend should call `POST /api/v1/bookings/check-overlap` before submitting the booking and show a confirmation modal if `hasOverlap === true`.
- `booking.createBooking` returns the same overlap data on its response under `overlapWarning` for the case where the frontend skipped the pre-check.

No data-modeling changes; this is purely a runtime check.

---

## 9. Seed-script structure recommendation

When seeding the Achimota tours (or any partnership tours), follow this order to satisfy `dependencies` arrays:

1. `Organization` — Elysium-OAA partnership tenant
2. `Destination[]` — Kintampo, Tamale, Gambaga, Mole NP, Kumasi, Cape Coast, Wiawso, Volta, Keta
3. `HotelPartner[]` — one per (destination × tier) combination needed by the packages
4. `Attraction[]` + `DiningPartner[]` — every highlight in the brief, with consistent `category` strings
5. `TourPackage[]` — the three packages, referencing the IDs above. Include:
   - `displayCurrency: "USD"`
   - `accommodationOptions[]` with `destinationHotels[]` mapping the tier to each city's hotel
   - `pricing[]` rows for `single` and `double` room types
   - `itinerary[]` day-by-day
   - `highlights[]` with the bullets from the brief
6. `ForexRate` — at least one `USD → GHS` rate so payments can FX-lock at initiation

Seed scripts live in `scripts/` and should be idempotent — check for existing records by slug/name before creating.
