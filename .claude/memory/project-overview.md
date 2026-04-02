# Project Overview — Elysium Tours Backend

## Identity
- **Project:** Elysium Tours backend — Ghana-based subsidized tour platform
- **Framework:** MoleculerJS 0.14 (microservices, CommonJS)
- **Database:** MongoDB Atlas + Mongoose
- **Cache/Queues:** Redis + Bull
- **API:** REST via Moleculer API Gateway, dual versioning (v1 single-tenant, v2 multi-tenant)
- **Auth:** JWT + bcrypt + OTP (email verification)
- **Payments:** Paystack (Ghana) — verified with real sandbox
- **Email:** Gmail SMTP (verified) + SendGrid fallback
- **SMS:** Hubtel (Ghana, primary, verified) + Twilio (fallback)
- **Media:** Cloudinary (verified)
- **CMS:** Sanity.io (blog, FAQ, testimonials, gallery, about, settings)
- **Deployment:** Docker containers on Render/Railway

## 24 Services (was 21, grew to 24)
| Container | Services |
|---|---|
| api | api (gateway) |
| core-worker | auth, user, rbac, tourPackage, dynamicTour, booking, payment, paymentPlan, contract, interest |
| partner-worker | hotelPartner, transport, attraction, dining, pricingDesk, destination |
| comms-worker | email, notification, template, media, cms |
| platform | organization, superAdmin (v2 only) |
| standalone | contact, review (lightweight, no heavy dependencies) |

## 25 Models (MongoDB Collections)
users, roles, permissions, rolepermissions, tourpackages, packagepricings, tourrequests, quotes, bookings, payments, hotelpartners, transportproviders, vehicles, attractions, diningpartners, destinations, contracts, contracttemplates, paymentplans, milestones, interests, notifications, templates, organizations, reviews, subscribers

## Four Roles
- `customer` — browse, book, pay, view own bookings
- `staff` — access pricing desk, manage quotes, confirm partners
- `admin` — full platform access within an organization
- `super_admin` — cross-org platform management (v2 only)

## API Versioning
- **v1 (`/api/v1/`):** 21 route groups, single-tenant, backwards compatible
- **v2 (`/api/v2/`):** 21 route groups, multi-tenant (requires organizationId in JWT), `tenantRequired` enforcement
- Both versions run simultaneously, point to same service actions

## Three Booking Flows
1. **Pre-packaged** — fixed-price tours, group or individual seats, partner confirmation
2. **Dynamic (Build-Your-Own)** — multi-destination custom tours → pricing desk → quote → booking
3. **Expression of Interest** — sign up without paying; admin notified at threshold

## Partner Inventory Models (Three-Tier)
- **On-Request (Phase 1 default):** manual partner confirmation per booking
- **Free-Sale (Phase 2):** pre-agreed rates, auto-confirm unless close-out dates
- **Allotment (Phase 3, future):** Elysium pre-buys blocks, auto-decrement

## Key Business Rules
- Commitment fee (configurable 15% default) paid first, then milestone-based payment plan
- Digital contract acceptance required before tour confirmation
- Partner confirmation workflow for on-request inventory model
- SLA: quotes must be sent within 72 hours (configurable)
- Booking reference format: `ELY-YYYYMMDD-XXXX`

## Source Files
- PRD: `Elysium_Tours_Backend_PRD_v2.docx`
- Diagrams: `docs/architecture_mermaid_diagrams.md` (11 original) + `v2_fixed/` (24 v2 diagrams)
- Frontend repo: `github.com/SRT-ELYSIUMTOURS/elysiumtours-frontend.git` (static prototype, no API integration)
- Sanity Studio: `studio/` (9 schemas, seeded with sample content)
