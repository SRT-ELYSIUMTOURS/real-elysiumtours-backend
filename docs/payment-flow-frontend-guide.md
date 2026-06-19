# Payment Flow — Frontend / UI-UX Guide

Audience: UI/UX team building the customer-facing Elysium Tours frontend.
Source of truth: backend services in `services/payment.service.js`, `services/paymentPlan.service.js`, `mixins/payment/paystack.mixin.js`, plus mermaid diagrams referenced below.

---

## 1. Diagrams You Actually Need

From `mermaid diagrams/v2_fixed/`, only these touch payment:

| Diagram | What it tells you |
|---|---|
| **3. Pre-Packaged Tour Flow – Group Buy** | Group-buy purchase journey. Commitment fee → booking confirmed → payment plan kicks in. |
| **4. Pre-Packaged Tour Flow – Individual Seat Sales** | Same as group-buy but capacity is decremented per seat at commitment payment. |
| **5. Dynamic Tour (Build-Your-Own) Flow v2** | Customer accepts a quote → contract → commitment fee. **Same payment endpoints as pre-packaged**, only the front-of-funnel differs. |
| **7. Payment Plan and Milestone Flow** | Milestone schedule, reminders, grace period concept. **Note discrepancies in section 8 below.** |
| **11. Tour Lifecycle State Machine** | All booking statuses you'll see in responses. Mirror these in UI badges. |

Ignore diagrams 1, 2, 6, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24 for the payment screens — they're either architectural or scoped to other domains.

---

## 2. The Mental Model (Plain Language)

1. **Customer creates a booking.** Booking status becomes `pending_payment` (for free-sale inventory) or `pending_partner_confirmation` (for on-request inventory — partner must accept first).
2. **Customer pays the commitment fee** (default 15% of total). Frontend hits `POST /api/v1/payments/initiate`, gets back a Paystack `authorizationUrl`, and **redirects the browser to it**.
3. **Paystack hosts the actual checkout** — mobile money, card, or bank. You never collect card numbers yourself.
4. **After payment**, Paystack redirects the customer back to your callback URL with `?reference=ELY-PAY-...&trxref=...`.
5. **Callback page calls** `POST /api/v1/payments/verify { reference }` to confirm the payment. Booking transitions to `confirmed`.
6. **A payment plan is auto-created** on the backend (commitment fee + 2 more milestones, 30 days apart by default). The commitment fee milestone is marked paid automatically when the verified payment lands.
7. **For each remaining milestone**, customer repeats step 2-5 — same `initiate` endpoint, but `paymentType: "milestone"` and the milestone's exact `amount`.
8. **When all milestones are paid**, plan becomes `completed`, booking transitions to `fully_paid`, then `tour_scheduled`.

That's the whole loop. Refunds, reminders, and webhook handling are backend-driven — you mainly react to status changes.

---

## 3. API Contract (Customer-Facing)

Base URL: `/api/v1` (v2 exists with multi-tenant headers — same payloads).

### 3.1 Initiate a payment
`POST /api/v1/payments/initiate` — **auth required**

Request body:
```json
{
  "bookingId": "65f...",
  "paymentType": "commitment_fee" | "milestone" | "full_payment",
  "amount": 1500.00  // ONLY required when paymentType === "milestone"
}
```

Response (200):
```json
{
  "paymentId": "65f...",
  "authorizationUrl": "https://checkout.paystack.com/abc123",
  "accessCode": "abc123",
  "transactionRef": "ELY-PAY-1715620000000-a1b2"
}
```

**What the UI does**: persist `paymentId` + `transactionRef` (sessionStorage is fine), then `window.location.href = authorizationUrl`.

Error cases (HTTP / `errCode`):
| Code | Reason | UX message |
|---|---|---|
| 404 / `BOOKING_NOT_FOUND` | Invalid bookingId | "We couldn't find that booking." |
| 403 / `FORBIDDEN` | Booking belongs to another customer | "You don't have access to this booking." |
| 422 / `INVALID_BOOKING_TRANSITION` | Booking not in `pending_payment` | "This booking can't be paid right now (status: X). Refresh the page." |
| 422 / `COMMITMENT_FEE_REQUIRED` | Booking missing `commitmentFeeAmount` | Likely backend bug — log + show generic error. |
| 422 / `VALIDATION_ERROR` | Milestone missing/invalid amount | "Please enter a valid amount." |

### 3.2 Verify a payment (callback handler)
`POST /api/v1/payments/verify` — **no auth required**

This is unauthenticated by design: the callback page may render before the session is rehydrated.

Request body:
```json
{ "reference": "ELY-PAY-1715620000000-a1b2" }
```

Response (200):
```json
{
  "payment": { "_id": "...", "status": "success" | "failed", "paidAt": "...", "amount": 1500, ... },
  "booking": { "_id": "...", "status": "confirmed" | "pending_payment", ... }
}
```

**UX rules**:
- `payment.status === "success"` → show success screen, surface `booking.status`.
- `payment.status === "failed"` → backend has already reverted the booking to `pending_payment`. Show a retry CTA that re-runs `initiate`.
- This endpoint is idempotent — if already verified it returns the existing record. Safe to call from a callback page that may re-mount.

### 3.3 List my transactions
`GET /api/v1/payments/transactions?bookingId=&status=&page=1&pageSize=20` — **auth required**

Customers automatically see only their own payments. Admins/staff see all.

### 3.4 Get a single transaction
`GET /api/v1/payments/transactions/:id` — **auth required**

### 3.5 Get the payment plan for a booking
`GET /api/v1/payment-plans/booking/:bookingId` — **auth required**

Response:
```json
{
  "paymentPlan": {
    "_id": "...",
    "totalAmount": 10000,
    "paidAmount": 1500,
    "remainingAmount": 8500,
    "currency": "GHS",
    "commitmentFeePercent": 15,
    "commitmentFeeAmount": 1500,
    "numberOfMilestones": 3,
    "status": "active" | "completed" | "defaulted" | "cancelled"
  },
  "milestones": [
    {
      "_id": "...",
      "milestoneNumber": 1,
      "label": "Commitment Fee",
      "amount": 1500,
      "dueDate": "2026-05-14T...",
      "status": "paid" | "pending" | "overdue" | "waived",
      "paidAt": "...",
      "isOverdue": false
    },
    ...
  ]
}
```

### 3.6 Get the next due milestone
`GET /api/v1/payment-plans/booking/:bookingId/next-due` — **auth required**

Returns the next `pending` or `overdue` milestone (or `null` if all paid). Use this to drive a "Pay next milestone" CTA.

---

## 4. Payment Methods Available

Paystack is configured to expose **three channels** on the hosted checkout:
- `mobile_money` (MoMo — primary for Ghana customers)
- `card` (Visa/Mastercard)
- `bank` (bank transfer)

Customers choose on the Paystack page — no UI work required on your side except branding the callback/return screen.

**Currency**: `GHS` (Ghana Cedis) is the only currency. Display amounts in major units (e.g., `GHS 1,500.00`). The backend handles pesewa conversion when talking to Paystack.

---

## 5. Booking & Payment Statuses to Render

Map these to UI badges/colors. **These come straight from `utils/constants.js` — use the strings verbatim.**

### Booking statuses (`booking.status`)
| Status | Meaning | Suggested UI |
|---|---|---|
| `pending_partner_confirmation` | Waiting on partner (hotel/transport) to accept the on-request booking | Grey "Awaiting confirmation" |
| `pending_payment` | Ready for commitment fee | Yellow "Action needed — Pay commitment fee" |
| `payment_processing` | Customer was redirected to Paystack but not yet verified | Blue spinner "Processing payment…" |
| `confirmed` | Commitment fee verified, payment plan active | Green "Confirmed" |
| `fully_paid` | All milestones paid | Green "Fully paid" |
| `tour_scheduled` | Tour date locked in | Green "Tour scheduled" |
| `tour_in_progress` | Customer is on the tour | Blue "In progress" |
| `tour_completed` | Tour done | Grey "Completed" |
| `review_requested` | Asking for review | Purple "Leave a review" |
| `cancelled` | No-refund cancellation | Red "Cancelled" |
| `cancelled_with_refund` | Refunded cancellation | Red "Refunded" |
| `cancellation_overdue` | Cancellation pending grace period (rare) | Orange "Cancellation in progress" |

### Payment statuses (`payment.status`)
| Status | Meaning |
|---|---|
| `pending` | Created but Paystack not yet initialized |
| `processing` | Initialized; customer on Paystack page |
| `success` | Verified by Paystack |
| `failed` | Paystack reported failure or abandonment |
| `refunded` | Fully refunded |
| `partially_refunded` | Partial refund issued |

### Milestone statuses (`milestone.status`)
| Status | Meaning |
|---|---|
| `pending` | Not yet due / awaiting payment |
| `overdue` | Past due date, unpaid |
| `paid` | Settled |
| `waived` | Admin waived (rare) |

---

## 6. Screen-by-Screen UX Bullets

### Checkout screen (post-booking)
- Show booking summary, total, commitment fee amount, what's covered.
- Single CTA: "Pay commitment fee — GHS X".
- On click → `POST /payments/initiate` → on success → `window.location.href = authorizationUrl`.
- Disable the button while the request is in flight (idempotency: don't let users double-click).

### Paystack callback / return page
- Route example: `/payment/callback?reference=...&trxref=...`
- Extract `reference` from query, call `POST /payments/verify { reference }`.
- Three outcomes:
  1. `payment.status === "success"` → success screen + "View booking" CTA.
  2. `payment.status === "failed"` → "Payment failed" screen + "Try again" CTA that returns to checkout.
  3. Network error → "We can't confirm your payment yet. We'll email you once it's verified, or check your bookings page." (Backend's webhook + reconciler will eventually settle it.)
- **Don't trust the redirect alone** — always verify. Customers can close the tab and the webhook is still the safety net.

### My bookings / booking detail
- For `pending_payment`: prominent "Pay now" CTA.
- For `confirmed` / payment-plan-active: show progress bar (`paidAmount / totalAmount`), list milestones with status pills, "Pay next milestone" CTA tied to `/payment-plans/booking/:id/next-due`.
- For `cancelled_with_refund`: show refund timeline ("Refund issued on X — usually arrives within 7–10 business days").

### Milestone payment screen
- Show the milestone label, due date, amount, current plan status.
- CTA → `POST /payments/initiate { bookingId, paymentType: "milestone", amount: milestone.amount }` → same Paystack redirect dance.
- If milestone is `overdue`: red banner, optional late-fee copy (no late fees implemented yet — just messaging).

### Transaction history
- Paginated list via `GET /payments/transactions`. Show ref, type, amount, status, date.
- Refund entries appear as **negative-amount payments** with `paymentType: "refund"` — render them with a minus sign and "Refund" pill.

---

## 7. Edge Cases You MUST Handle

1. **Double submission**: lock the "Pay" button until either redirect or error. The backend rejects re-initiating on a booking already in `payment_processing` (returns 422).
2. **Tab closed mid-payment**: customer may never hit the callback. The Paystack webhook (`POST /api/v1/webhooks/paystack`) will verify in the background. Your "My bookings" page should reflect the eventual status even without the callback fire.
3. **Stale state on callback**: if your callback page renders before the webhook fires, the verify call will trigger the verification itself. If the webhook fired first, verify returns the already-verified record. Both paths are safe.
4. **Failed payment**: backend reverts booking to `pending_payment`. UI should re-show the "Pay" CTA, **not** create a new booking.
5. **Capacity changes between view and pay (group buy / individual seats)**: backend can return `INSUFFICIENT_CAPACITY` on booking creation. Not on payment — but if the booking was created against a now-full tour, the UI should refresh the package detail page after a failed booking.
6. **Long Paystack queue**: backend has a reconciler that catches payments stuck in `pending`/`processing` over 1 hour. Admin-triggered; customer doesn't see this directly. Just don't assume "processing > 1 hour" means definitely failed — show "We're still confirming this — check back later or contact support".
7. **Partial refunds**: a single payment can have multiple refunds. `payment.status` flips to `partially_refunded` until cumulative refunds equal the original amount, then `refunded`. Render both states distinctly.
8. **Currency display**: always GHS, but format with locale separators (`GHS 1,500.00`, not `GHS1500`).

---

## 8. Backend ↔ Diagram Discrepancies (Heads-Up)

These are places where the diagrams promise behaviour the backend doesn't currently implement, or vice versa. Build for **what the backend actually does** (column 3), not what diagram 7 shows.

| Topic | Diagram 7 says | Backend actually does | UX implication |
|---|---|---|---|
| Reminder cadence | 7-day, 3-day, day-of reminders per milestone | Only 3-day reminder (`paymentPlan.sendReminders` queries `dueDate <= now+3d`) | Don't promise 7-day / day-of reminders in copy. Or flag this for backend to extend. |
| Grace period | Explicit `GracePeriod` node with 1–7 day window before cancel | Milestones flip to `overdue` past due date; no grace period state; no auto-cancellation | Don't show a "grace period" countdown UI. Show "Overdue" only. |
| Auto-cancellation after default | Diagram implies auto-cancel after grace period expires | Plan can be marked `defaulted` manually but no scheduled job cancels it | Admins handle this manually for now. Customer UI should not say "your booking will be auto-cancelled in X days". |
| Refund state on booking | Diagram 11 hints at `RefundProcessing` → `Refunded` sub-states | Booking has terminal `cancelled_with_refund`. Refund "in-progress" only lives on the payment record (`status: success` on a negative-amount payment is the trigger). | UI should infer "refund processing" by checking for refund-type payments with the most recent record. |
| Milestone schedule customization | Diagram is silent | Backend defaults to 3 milestones, 30-day spacing, 15% commitment fee — `commitmentFeePercent` and `numberOfMilestones` are tunable per booking but no UI surface yet | If you want to expose plan customization to customers, ask backend to add a `PUT /payment-plans/:id` endpoint — doesn't exist today. |

If any of these mismatches matter for your UX brief, raise them so we can decide whether to update the diagrams or implement the backend behaviour.

---

## 9. Things the Backend Owns — Don't Reimplement

- Computing the commitment fee amount (it's on `booking.commitmentFeeAmount`).
- Computing milestone due dates / amounts (read from `paymentPlan.getPlan`).
- Validating ownership (backend rejects with 403).
- Detecting overdue milestones (cron job — UI just reads the status).
- Validating Paystack webhook signatures.
- Currency conversion to pesewas.

---

## 10. Quick Reference — Endpoint Cheat Sheet

```
POST   /api/v1/payments/initiate                        Start a payment, get authorizationUrl
POST   /api/v1/payments/verify                          Confirm payment by reference (no auth)
GET    /api/v1/payments/transactions                    List user's payments
GET    /api/v1/payments/transactions/:id                Single payment
GET    /api/v1/payment-plans/booking/:bookingId         Plan + all milestones
GET    /api/v1/payment-plans/booking/:bookingId/next-due  Next unpaid milestone
GET    /api/v1/payment-plans/:planId/milestones         Milestones only
POST   /api/v1/webhooks/paystack                        Paystack-only (you never call this)
```

For v2 (multi-tenant), swap `/api/v1` for `/api/v2` and include the `X-Tenant-Slug` header — payloads are identical.

---

## 11. Environment Notes

- Paystack callback URL is set server-side via `PAYSTACK_CALLBACK_URL`. Default dev value is `http://localhost:5173/payment/callback`. If your dev port differs, ask backend to override it.
- The frontend never needs the Paystack secret key. The public key (`PAYSTACK_PUBLIC_KEY`) is only needed if you want to use Paystack Inline (we don't — we're using the hosted/redirect flow).

---

## 12. Open Questions for Product

Raise these before locking the design:
1. Should we expose milestone customization (number, spacing) to customers, or keep it backend-default?
2. Do we want an in-app "view receipt" PDF, or is Paystack's email receipt enough?
3. Refund UX — silent or actively notify the customer in-app?
4. Reminder gaps (no 7-day or day-of) — extend the backend, or update the diagram?
5. Grace period — do we want one? Currently the backend has none.
