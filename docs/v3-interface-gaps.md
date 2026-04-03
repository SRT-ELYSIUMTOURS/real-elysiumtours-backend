# V3 Interface Gaps — All Roles vs v2_fixed Diagrams

> Cross-reference of all 24 v2_fixed diagrams against current admin interface.
> Generated: 2026-04-03

---

## SUPER ADMIN INTERFACE (Diagram 24)

### Diagram 24 specifies:

| Feature | Specified | Built | Gap |
|---------|-----------|-------|-----|
| **Platform Overview** | Total Tenants, Active/Suspended count | OrganizationList shows this | OK |
| | Total Bookings (all tenants) | Dashboard shows bookings | OK but not cross-org labeled |
| | Platform Revenue (all tenants) | Analytics has cross-org section | OK |
| **Tenant Management** | Create New Tenant | OrganizationCreate (5-tab wizard) | OK |
| | Edit Tenant Config | OrganizationShow has config tab | **MISSING — no edit config UI** |
| | Suspend / Reactivate | Show page has suspend/activate buttons | OK |
| | View Tenant Activity | **No** | **MISSING — no activity log per org** |
| | Manage Subscription | Subscription shown in Show | **MISSING — no edit subscription** |
| **Billing & Revenue** | Per-Tenant Revenue | Cross-org analytics table | OK |
| | Transaction Fees Collected | **No** | **MISSING — no fee tracking** |
| | Subscription Status | Shown in org list | OK |
| | Usage vs Plan Limits | **No** | **MISSING — no usage tracking** |
| **Platform Health** | Service Status | **No** | **MISSING — getPlatformHealth exists but no UI** |
| | Database Performance | **No** | **MISSING** |
| | API Response Times | **No** | **MISSING** |
| | Error Rates per Tenant | **No** | **MISSING** |
| **Tenant Onboarding** | Wizard: Create Org | Yes (OrganizationCreate) | OK |
| | Configure Branding | Branding tab in create | OK |
| | Set Payment Keys | **No** | **MISSING — no payment gateway config in org** |
| | Send Default Data | **No** | **MISSING — no seed defaults action in UI** |
| | Verify & Go Live | **No** | **MISSING — no go-live workflow** |

### Super Admin additions needed:
1. **Platform Health page** — call `superAdmin.getPlatformHealth`, show services running, DB status
2. **Organization Edit** — edit config, subscription, branding (currently only Show)
3. **Org Activity Log** — recent bookings/users/events for a specific org
4. **Usage tracking** — API calls per org vs plan limits

---

## ADMIN (ORG) INTERFACE (Diagrams 9, 12, 14, 15-19)

### Diagram 9 — Admin Dashboard Architecture:

| Section | Feature | Built | Gap |
|---------|---------|-------|-----|
| **Dashboard** | Active Bookings Count | Total bookings shown | **Should show ACTIVE only** |
| | Pending Quotes Count | **No** | **MISSING — need quote count on dashboard** |
| | Revenue Summary | Yes (GHS total) | OK |
| | SLA Compliance | Yes (100% gauge) | OK |
| | Recent Activity Feed | Yes (recent bookings table) | OK |
| **Tour Mgmt** | Package CRUD | Yes | OK |
| | Set Pricing Tiers | Yes (ArrayInput in form) | OK |
| | Upload Photos | Yes (ImageUploadField) | OK |
| | Toggle Active/Inactive | Yes (ToggleActiveButton) | OK |
| | View Package Analytics | **No** | **MISSING — no per-package stats** |
| **Destination Mgmt** | Add/Edit | Yes | OK |
| | Map Regions | Region dropdown only | **MISSING — no map visualization** |
| | Assign Attractions | **No** | **MISSING — no attraction→destination assignment UI** |
| | Set Availability | **No** | **MISSING — no availability toggle/schedule** |
| **Pricing Desk** | Quote Queue | Yes (PricingDeskList) | OK |
| | SLA Timer Display | Date only | **MISSING — need real-time countdown** |
| | Priority Sorting | **No** | **MISSING** |
| | Assigned to Me filter | **No** | **MISSING** |
| | **Quote Builder** | Placeholder only | **CRITICAL — core staff workflow not built** |
| | Cost Calculator | **No** | **MISSING — transport/hotel/attraction/dining/margin** |
| | Load Partner Data | **No** | **MISSING — auto-populate from partner rates** |
| | Send Quote to Customer | Button only, no action | **INCOMPLETE** |
| | Quote History | **No** | **MISSING** |
| **Booking Mgmt** | List + filters | Yes | OK |
| | Status filter | Yes | OK |
| | Search by customer | Yes (text search) | OK |
| | Customer Info in detail | Yes | OK |
| | Payment Status | Yes | OK |
| | Update Status | Yes (BookingEdit) | OK |
| | Cancel/Refund | **Cancel only, no refund action** | **MISSING — refund button** |
| | **Partner Confirmations** | **No** | **MISSING — confirm/reject partner per booking** |
| | **Substitution flow** | **No** | **MISSING — suggest/accept substitute partner** |
| **Partner Mgmt** | 4 types CRUD | Yes | OK |
| | Commission Rates | Yes | OK |
| | **Inventory Model** | **No** | **MISSING — on_request/free_sale/allotment toggle** |
| | Close-out Dates (hotels) | **No UI** | **MISSING — close-out date management** |
| | View Performance | **No** | **MISSING — per-partner booking/revenue stats** |
| **Customer Mgmt** | List + search | Yes | OK |
| | Booking History | Yes (ReferenceManyField) | OK |
| | Communication Log | **No** | **MISSING** |
| | Send Email/DM | **No** | **MISSING** |
| | Support Tickets | **No** | **MISSING** |
| **Analytics** | Revenue (daily/weekly/monthly) | Yes (recharts) | OK |
| | By Package breakdown | **No** | **MISSING** |
| | By Destination breakdown | **No** | **MISSING** |
| | Commission Tracking | **No** | **MISSING** |
| | Conversion Rates | **No** | **MISSING** |
| | Popular Destinations | Shown in booking analytics | OK |
| | Group Size Trends | **No** | **MISSING** |
| | Seasonal Patterns | **No** | **MISSING** |
| | Staff Performance | **No** | **MISSING** |
| | Partner Reports | **No** | **MISSING** |
| **Settings** | SLA Configuration | **Placeholder** | **INCOMPLETE — needs real config wiring** |
| | Email Templates CRUD | **Placeholder** | **INCOMPLETE — needs real template editing** |
| | Notification Rules | **Placeholder** | **INCOMPLETE** |
| | Payment Gateway Config | **No** | **MISSING** |
| | Staff Accounts | Yes | OK |
| | Role Assignment | Yes (SelectInput) | OK |
| | Permission Matrix | **No** | **MISSING — visual permission grid** |
| | Activity Logs | **No** | **MISSING** |
| **CMS Management** | Blog posts | **No** | **MISSING — page in diagram 14 not built** |
| | FAQs | **No** | **MISSING** |
| | Testimonials | **No** | **MISSING** |
| **Communication Hub** | Email campaigns | **No** | **MISSING** |
| | Notification logs | **Placeholder** | **INCOMPLETE — needs real data** |

### Diagram 12 — Pricing Desk Workflow (CRITICAL for staff):

| Step | Flow | Built | Gap |
|------|------|-------|-----|
| 1 | Customer submits custom tour request | Backend exists | OK (backend) |
| 2 | QuoteRequest enters pricing queue | PricingDeskList shows queue | OK |
| 3 | Staff reviews customer request | **Placeholder detail page** | **INCOMPLETE** |
| 4 | System loads pre-loaded partner data | **No** | **MISSING — auto-load partner rates** |
| 5 | System pre-calculates quote | **No** | **MISSING — estimateCost endpoint exists but no UI** |
| 6 | Staff reviews calculation | **No** | **MISSING — cost breakdown display** |
| 7 | Staff adjusts components/margins | **No** | **MISSING — editable cost fields** |
| 8 | System generates final quote | **No** | **MISSING — finalize + format quote** |
| 9 | Send quote to customer | Button placeholder | **INCOMPLETE** |
| 10 | Customer receives quote | Backend event | OK (backend) |
| 11 | Customer accepts → Contract flow | Backend exists | OK (backend) |
| 12 | Customer rejects → Capture reason | **No UI** | **MISSING — rejection reason display** |
| 13 | Return for clarification | **No** | **MISSING** |
| 14 | Quote withdrawn | **No** | **MISSING** |
| 15 | SLA breach → Escalate to admin | **No** | **MISSING — escalation notification** |

### Diagram 15 — Partner Inventory Model:

| Feature | Built | Gap |
|---------|-------|-----|
| **On-Request** (Phase 1) — manual confirmation | Partner confirmation actions exist in backend | **MISSING — no UI for confirm/reject** |
| **Free Sale** (Phase 2) — auto-confirm unless close-out | Close-out dates on hotel model | **MISSING — no close-out management UI** |
| **Allotment** (Phase 3) — pre-bought blocks | **Not implemented** | Future phase |
| Inventory model toggle per partner | `inventoryModel` field on hotel model | **MISSING — no UI to set/view inventory model** |
| Contract status per partner | `contractStatus` field exists | **MISSING — no UI** |

### Diagram 16 — On-Request Booking Flow (Staff actions):

| Step | Built | Gap |
|------|-------|-----|
| Staff receives partner confirmation notification | **No** | **MISSING — no notification in admin** |
| Staff verifies availability with partner | Backend action exists | **MISSING — no UI** |
| Staff confirms OR suggests substitution | Backend actions exist | **MISSING — no UI for partner confirmation flow** |
| Customer accepts substitution | Backend exists | **No admin view** |

### Diagram 7 — Payment Plan & Milestones:

| Feature | Built | Gap |
|---------|-------|-----|
| View payment plan for booking | **No** | **MISSING — no payment plan page in admin** |
| View milestones with due dates | **No** | **MISSING** |
| Mark milestone as paid | **No** | **MISSING** |
| Overdue milestone alerts | **No** | **MISSING** |
| Payment plan status tracking | **No** | **MISSING** |

### Diagram 8 — Contract Acceptance Flow:

| Feature | Built | Gap |
|---------|-------|-----|
| View contracts for booking | **No** | **MISSING — no contract page in admin** |
| Send contract to customer | Backend exists | **MISSING — no UI** |
| Track contract status (sent/accepted/rejected) | **No** | **MISSING** |
| Admin notified of acceptance | **No** | **MISSING** |

### Diagram 6 — Expression of Interest Flow:

| Feature | Built | Gap |
|---------|-------|-----|
| View interests for a tour package | Backend exists (`interest.list`) | **MISSING — no interests page in admin** |
| Convert interests to booking invitations | Backend exists | **MISSING — no UI** |
| Interest count per package | Backend exists | **MISSING — not shown on tour list** |

---

## STAFF INTERFACE (Diagrams 12, 16, 19)

Staff's PRIMARY tool is the Pricing Desk. Secondary: booking management.

| Feature | Built | Gap |
|---------|-------|-----|
| **Pricing Desk Queue** | Basic list | **INCOMPLETE — needs SLA countdown, priority sort, self-assign filter** |
| **Quote Builder** | Placeholder | **CRITICAL MISSING — entire cost calculator workflow** |
| **Partner Confirmation** (Diagram 16) | **No UI** | **MISSING — confirm/reject/substitute partner for bookings** |
| **Mixed-Model Booking** (Diagram 19) | **No UI** | **MISSING — multi-destination booking confirmation steps** |
| **Booking Status Updates** | BookingEdit exists | OK but staff should only see their relevant bookings |
| **Notifications** | No in-admin notifications | **MISSING — new quote alerts, SLA warnings, partner responses** |
| **Personal SLA Stats** | **No** | **MISSING — "my performance" metrics** |

---

## PRIORITY RANKING FOR FIXES

### P0 — Critical (blocks core workflow):
1. **Quote Builder** — the entire pricing desk cost calculator (Diagram 12 steps 3-9)
2. **Partner Confirmation UI** — confirm/reject/substitute partners on bookings (Diagram 16)
3. **Settings wiring** — replace placeholders with real template/SLA/config editing
4. **Dashboard pending quotes count** — simple addition
5. **SLA countdown timer** on pricing desk queue

### P1 — Important (admin effectiveness):
6. **Payment Plan/Milestone view** per booking (Diagram 7)
7. **Contract tracking** per booking (Diagram 8)
8. **Interest/Waitlist view** per tour package (Diagram 6)
9. **Notification log wiring** — real data instead of placeholder
10. **Close-out date management** for hotel partners
11. **Inventory model toggle** on partner forms
12. **Platform Health page** for super admin
13. **Organization Edit** (config, subscription, branding)

### P2 — Nice to have:
14. Per-package analytics
15. Per-partner performance reports
16. Customer communication log
17. Staff performance metrics
18. Activity logs / audit trail
19. CMS management (blog/FAQ/testimonials)
20. Email campaign builder
21. Permission matrix visualization
22. Map visualization for destinations
23. Usage tracking per org

---

## SUMMARY

| Role | Pages Specified | Pages Built | Gap Count |
|------|----------------|-------------|-----------|
| **Super Admin** | 5 sections | 3 working (org list/show/create + cross-org analytics) | **8 missing features** |
| **Admin** | 17 pages | 17 pages (but 5 are placeholders, 3 incomplete) | **25+ missing features** |
| **Staff** | 3 core tools | 1 placeholder (pricing desk) | **CRITICAL — primary tool not functional** |

The biggest gap is the **Pricing Desk Quote Builder** — it's the staff's primary daily tool and is currently just a placeholder. This should be the #1 priority.
