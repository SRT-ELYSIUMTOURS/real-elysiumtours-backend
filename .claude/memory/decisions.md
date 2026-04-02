# Architectural Decisions — Elysium Tours Backend

## Model-as-Service Pattern
Each Mongoose model is its own Moleculer service (e.g., `tourPackage.model`).
- **Why:** Ensures models register before domain services start; avoids race conditions at broker startup.
- **Convention:** Model service name = `camelCase.model`, file in `services/models/<domain>/`.

## DbService Mixin with MONGOOSE_COLLECTIONS Whitelist
Single `db.mixin.js` factory that switches between Mongoose adapter and raw MongoAdapter based on a whitelist.
- **Why:** Uniform data access pattern across all 21 services; single place to add new collections.
- **Rule:** Any new collection must be added to MONGOOSE_COLLECTIONS array in `mixins/db.mixin.js`.

## Simplified 3-Role RBAC (vs. complex multi-tenant)
Three roles: `customer`, `staff`, `admin`. Middleware reads `action.auth` and `action.role`.
- **Why:** The reference codebase had 51+ services and complex org scoping. Elysium only needs 3 roles.
- **Implementation:** `rbacPermissions.middleware.js` — `auth: "required"` + optional `role: "admin"` on actions.

## Event-Driven Side Effects
Actions emit events; side effects (email, notifications) are handled in service `events` blocks, never called directly from action handlers.
- **Why:** Decouples domain logic from comms services. Prevents tight coupling across containers.
- **Example:** `booking.confirmed` event → email service listens and sends confirmation.

## State Machine Config File
All valid booking/quote/tour state transitions are encoded in `config/bookingStates.config.js`.
- **Why:** Diagram 9 is the source of truth. Centralizing transitions makes them auditable and testable.
- **Rule:** Any `updateStatus` action validates against this config before writing to DB.

## Commitment Fee + Milestone Payment Plan
Payment is NOT a single charge. Commitment fee (10-20%) is charged first, then milestones via Bull delayed jobs.
- **Why:** PRD v2 business model — reduces dropout, aligns with installment culture in Ghana.
- **Implementation:** `paymentPlan.service.js` auto-generates milestones from booking totalAmount.

## Digital Contract Before Confirmation
Booking cannot move to `confirmed` status until customer accepts the contract.
- **Why:** Legal requirement — PRD v2 specifies this as P0.
- **Implementation:** `contract.service.js` → `verifyAcceptance` called by `booking.service` in the confirmation flow.

## URL Path Versioning for API Contracts
All routes use `/api/v1/` prefix. Version is in the URL path, not headers or query params.
- **Why:** URL path versioning is the industry standard (2026). It's cache-friendly, explicitly visible, easy to test in browser/Postman, and allows running v1 and v2 side by side when breaking changes are needed. Header versioning was considered but rejected — harder to test, not cache-friendly, less visible to consumers.
- **Breaking change policy:** Never modify v1 response contracts in place. Breaking changes (field removal, type changes, endpoint removal) require a new `/api/v2/` route group. Non-breaking changes (new fields, new endpoints, new filters) stay in v1.
- **Implementation:** Each route in `api.service.js` uses `path: "/api/v1/<resource>"`. See CLAUDE.md "API Versioning Policy" section for the full rules.

## Hubtel as Primary SMS, Twilio as Fallback
SMS routing: Hubtel first (Ghana-focused, cheaper), Twilio as fallback.
- **Why:** Hubtel is the dominant SMS gateway in Ghana with better local delivery rates and lower cost. Twilio covers international numbers and WhatsApp.
- **Implementation:** `utils/whatsapp.utils.js` — `sendSMS()` tries Hubtel API first (`smsc.hubtel.com/v1/messages/send`), falls back to Twilio on failure. WhatsApp remains Twilio-only.
- **Env vars:** `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`, `HUBTEL_SENDER_ID`

## Caching Disabled Until Post-Development
`cacher: null` is explicitly set in `moleculer.config.js`. No action uses `cache: true`.
- **Why:** Cache poisoning risk. Moleculer's cacher can serve stale data after writes, especially across services in a distributed setup. Debugging cache-related bugs during active development wastes time and masks real issues. User directive: only enable after development is complete with dedicated testing.
- **When to enable:** After Phase 4 is complete and all tests pass. Enable Redis-backed cacher only, with per-action cache invalidation on writes, tuned TTLs, and full regression testing.

## Bull for SLA Timers and Payment Reminders
Bull delayed jobs (not cron) are used to enforce SLA breach alerts and payment reminder sequences.
- **Why:** Bull's delayed jobs are Redis-backed and survive process restarts. More reliable than in-memory setTimeout.

## Partner Inventory Three-Tier System (On-Request → Free-Sale → Allotment)
Added `pending_partner_confirmation` booking status and partner confirmation workflow.
- **Why:** PRD v2 diagrams 15-19 define a three-tier partner inventory model. Phase 1 default is "on_request" — every booking requires manual partner confirmation before proceeding to payment.
- **Implementation:** `booking.service.js` checks `hotelPartner.checkAvailability` during `createBooking`. On-request → status `pending_partner_confirmation`. Free-sale with no close-outs → auto-confirmed → `pending_payment`. Close-out dates checked against tour dates.
- **New actions:** `confirmPartner`, `rejectPartner`, `suggestSubstitution`, `acceptSubstitution` in booking.service.
- **New field:** `partnerConfirmations[]` on booking model tracks each partner's confirmation status.

## dbIdNormalizer — Outbound Only (No Inbound Conversion)
Removed all inbound string→ObjectId conversion from the middleware. Only converts ObjectIds and Dates to strings on responses.
- **Why:** Mongoose handles string→ObjectId conversion natively. The inbound conversion caused moleculer-db's `get` action to fail (expects `id` as string/number, not ObjectId object). Discovered during E2E testing against real MongoDB Atlas.
- **Lesson:** Unit tests with mocked models don't catch real adapter issues. Always E2E test against real DB early.

## Gateway authorize() for Auth Enforcement
Auth enforcement moved to the API gateway's `authorize()` method, not just the rbacPermissions middleware.
- **Why:** The rbacPermissions middleware `localAction` wrapper runs on service actions, but moleculer-web's gateway routing can bypass it for certain request paths. The `authorize()` method runs AFTER `authenticate()` and BEFORE the action, catching all requests.
- **Implementation:** `api.service.js` `authorize()` checks `action.auth`, `action.role`, and `ctx.meta.user`.

## Multi-Tenancy via API v2 (Shared DB + Organization Scoping)
Added `/api/v2/` routes with multi-tenancy support alongside existing `/api/v1/` single-tenant routes. Both run simultaneously.
- **Why:** v2 mermaid diagrams (21-24) define multi-tenancy. Rather than refactoring v1, we added v2 as a non-breaking addition. Existing clients use v1 unchanged; new multi-org clients use v2.
- **Architecture:** Shared MongoDB database. Every collection has optional `organizationId` field. v2 routes require org context (from JWT). v1 routes work without it.
- **Key components:**
  - `organization.model.js` — Organization schema with flexible `config` (Schema.Types.Mixed for arbitrary nested key-value pairs)
  - `organization.service.js` — CRUD + `setConfig` (dot notation), `mergeConfig`, `deleteConfigKey`
  - `superAdmin.service.js` — Cross-org management, platform health, revenue analytics
  - `tenantScope.middleware.js` — Extracts orgId from JWT, enforces on v2 routes via `tenantRequired` flag
  - `organizationScope.mixin.js` — `scopeQuery()`, `scopeData()`, `assertOrgOwnership()` helpers
  - Compound unique indexes with `partialFilterExpression` — only activate when `organizationId` is set (v2 records)
- **Roles:** Added `SUPER_ADMIN` role that bypasses org scoping and can access all data.
- **Route parity:** 21 v1 routes, 21 v2 routes (v2 has `/platform` instead of v1's `/webhooks`).

## Flexible Organization Config (Schema.Types.Mixed)
Organization `config` field uses `Schema.Types.Mixed` — accepts any JSON structure.
- **Why:** Super admin needs to configure each org differently (payment keys, SMS providers, SLA hours, feature flags, custom policies) without schema migrations. Rigid schemas would require model changes for every new config option.
- **Implementation:** Dot-notation path helpers for `setConfig("payment.gracePeriodDays", 5)`, `mergeConfig({...})`, `deleteConfigKey("custom.oldFlag")`. No lodash dependency.

## super_admin Role Hierarchy
`super_admin` bypasses ALL role checks — can access admin, staff, and customer actions across all organizations.
- **Why:** Platform operator needs unrestricted access for org management, debugging, cross-org analytics.
- **Implementation:** Both `rbacPermissions.middleware.js` and `api.service.js` `authorize()` check for super_admin early and return immediately.

## CMS via Sanity (Not MongoDB)
Blog, FAQ, testimonial, gallery, about, and site settings content served from Sanity CMS, not MongoDB.
- **Why:** Editorial content changes frequently and non-technical staff need to edit it. Sanity provides a hosted studio UI. Tour/booking/payment data stays in MongoDB for transactional integrity.
- **Implementation:** `cms.service.js` uses GROQ queries against Sanity API. No Mongoose models. Gracefully returns stub responses if Sanity credentials are missing.
- **Studio:** Scaffolded at `studio/` with 9 schemas matching CMS service queries.
- **Credentials:** SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION, SANITY_API_TOKEN in .env.

## Reviews + Contact + Newsletter as Separate Services
Reviews use MongoDB (transactional, linked to bookings). Contact form sends email (no storage). Newsletter uses MongoDB subscriber model.
- **Why:** Reviews need verification (was booking completed?), rating aggregation, admin responses — fits MongoDB. Contact is fire-and-forget email. Newsletter needs dedup + unsubscribe — fits a simple model.
- **Implementation:** `review.service.js` (6 actions), `contact.service.js` (2 actions), `review.model.js`, `subscriber.model.js`.

## Event Handler System Meta for Internal Calls
Event handlers use `{ meta: { user: { id: "system", role: "admin" } } }` when calling authenticated actions internally.
- **Why:** Event handlers (e.g., `payment.verified` → `paymentPlan.payMilestone`) run without HTTP request context, so `ctx.meta.user` is null. Internal calls need a system-level identity to pass auth checks.
- **Implementation:** `paymentPlan.service.js` `payment.verified` handler passes system meta.

## Notification Event Handlers — Guard Against Missing Payload Fields
All notification event handlers check for required fields before calling `notification.send`.
- **Why:** Different event emitters include different payload fields. Notification handlers that expected `staffId` or `customerId` from events that didn't include them caused `Parameters validation error!` failures.
- **Implementation:** Each handler checks required fields with early return + `this.logger.debug()` if missing.
