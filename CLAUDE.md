# CLAUDE.md — Elysium Tours Backend Development Rules

## Project Identity
- MoleculerJS 0.14 microservices backend (CommonJS only — no ESM, no TypeScript)
- MongoDB + Mongoose, Redis + Bull, REST via Moleculer API Gateway
- Ghana-based tour platform: 21 services across 4 Docker containers
- Payment: Paystack | Email: Nodemailer + SendGrid | SMS: Twilio | Media: Cloudinary

## Source of Truth Documents
Before writing any service, read these files:
1. `docs/architecture_mermaid_diagrams.md` — ALL flows and data models (11 diagrams)
2. `config/bookingStates.config.js` — state machine (diagram 9)
3. `config/roles.config.js` + `config/permissions.config.js` — RBAC matrix

---

## API Versioning Policy

All API routes use **URL path versioning**: `/api/v1/<resource>`.

### Rules:
1. Every route in `api.service.js` must use the `/api/v1/` prefix — never bare `/api/`
2. Version is part of the URL path (not headers or query params) — this is the industry standard for REST APIs
3. When a breaking change is needed, create `/api/v2/` routes alongside v1 — never modify v1 contracts in place
4. Non-breaking changes (additive fields, new endpoints) can be added to the current version
5. Deprecated versions must include `Deprecation: true` and `Sunset: <date>` response headers

### What counts as a breaking change (requires v2):
- Removing or renaming a field from a response body
- Changing a field's type (e.g., string → object)
- Removing an endpoint
- Changing required parameters
- Changing authentication/authorization behavior on an endpoint
- Altering error response structure

### What is NOT a breaking change (stays in v1):
- Adding new optional fields to request params
- Adding new fields to response body
- Adding new endpoints
- Adding new query filter options
- Loosening validation (e.g., making a required field optional)

### Route pattern:
```
/api/v1/auth/login          ← Auth (public)
/api/v1/users/profile       ← User management
/api/v1/destinations        ← Destinations
/api/v1/partners/hotels     ← Partner services
/api/v1/tours/packages      ← Tour packages
/api/v1/bookings            ← Bookings
/api/v1/payments/initiate   ← Payments
/api/v1/admin/dashboard     ← Admin
```

---

## Research Policy — When to Search vs Code from Memory

### ALWAYS use WebSearch/WebFetch before coding these APIs:
- **Moleculer API Gateway:** route aliases, file upload (multipart streams), authentication hooks
- **Paystack API:** initializeTransaction, verifyTransaction, webhook signature verification
- **Bull queue:** job options, repeatable jobs, delayed jobs, job events
- **Twilio WhatsApp Business API:** message templates, sandbox vs production behavior
- **Cloudinary upload stream** in Node.js (streams API — NOT base64)
- **MongoDB Atlas Search:** aggregation pipeline syntax
- **Moleculer-web file upload:** multipart stream pattern (ctx.params is a ReadStream)

### Code from memory (stable, well-known patterns):
- Mongoose schema definitions and indexes
- JWT sign/verify with jsonwebtoken
- bcrypt hash/compare
- Moleculer service skeleton (name, dependencies, mixins, actions, events, methods)
- Nodemailer transport setup
- Bull basic queue create/process/add

### Decision rule: If the API version or behavior is uncertain — search first. Paystack and Twilio change frequently. When in doubt, search.

---

## MoleculerJS Conventions

### Services
1. Service name must match filename: `tourPackage.service.js` → `name: "tourPackage"`
2. Model services use dot notation: `name: "tourPackage.model"` file: `services/models/tour/tourPackage.model.js`
3. Every action declares `auth: "required"` OR `auth: undefined` (public) — never omit this field
4. Cross-service calls always forward meta: `this.broker.call("x.action", params, { meta: ctx.meta })`
5. Actions NEVER call email/notification directly — emit an event, handle it in the `events` block
6. All throws use `MoleculerClientError` with a code from `utils/constants.js` ERROR_CODES — never throw generic `Error`
7. `dependencies` array must list ALL model services the service queries — prevents startup race conditions

### Models
1. Collection name in `DbService("collection")` must match `collection:` in schema AND entry in `db.mixin.js` MONGOOSE_COLLECTIONS array
2. Every new model must be added to MONGOOSE_COLLECTIONS in `mixins/db.mixin.js`
3. All schemas include `timestamps: true`
4. No business logic in model services — pure data layer only
5. Status enums must match diagram 9 state machine exactly

### Middleware Order (NEVER reorder)
`dbIdNormalizer → rbacPermissions → rateLimiter → auditLog`

---

## Progressive Testing Habits

### Before writing any action:
1. Write the unit test first (TDD) or simultaneously — NEVER after the fact
2. Add the expected ERROR_CODE to `utils/constants.js`
3. Define Mongoose schema fields needed

### Per-action test checklist:
- [ ] Happy path returns correct shape
- [ ] Missing required params return 422
- [ ] Unauthorized access returns 401/403
- [ ] Not-found returns 404 with correct ERROR_CODE
- [ ] State machine rejects invalid transitions (for status-changing actions)

### Running tests:
```bash
npm test                      # all tests + coverage
npm run test:unit             # unit only (no DB, fast)
npm run test:integration      # requires TEST_MONGO_URI
node scripts/testScripts/test-phase1.js   # phase 1 completion gate
node scripts/testScripts/test-phase2.js   # phase 2 completion gate
node scripts/testScripts/test-phase3.js   # phase 3 completion gate
```

### Phase gate rule
Do NOT start the next phase until the current phase's test script exits with code 0.

### Coverage threshold
Maintain 70% branch + function coverage on all service files (not model files — those are data layer).

---

## Parallel Agent Strategy

When building, spin up parallel agents for features with no shared dependencies. Any two services with no overlapping `dependencies` array entries can be built by separate agents simultaneously.

### Phase 1 parallel groups:
- **A:** `db.mixin.js`, `dbIdNormalizer.middleware.js`, `utils/constants.js`, `utils/db.utils.js`
- **B:** `config/roles.config.js`, `config/permissions.config.js`, `config/bookingStates.config.js`
- **C:** `jest.config.js`, `tests/setup.js`, `docker-compose.dev.yml`, `.env.example`

After infrastructure (single message, 3 agents):
- **A:** RBAC models → `rbac.service.js`
- **B:** `user.model.js` + auth helpers → `auth.service.js`
- **C:** destination + all partner models → partner services

### Phase 2 parallel groups (after models exist):
- **A:** `tourPackage.service.js` + unit test
- **B:** `dynamicTour.service.js` + unit test
- **C:** `interest.model.js` + `interest.service.js`

Then in parallel: **A** `booking.service.js` | **B** `paystack.mixin.js` + `payment.service.js`

### Phase 3 parallel groups:
- **A:** `paymentPlan.service.js` + Bull reminder jobs
- **B:** `contract.service.js`
- **C:** `notification.service.js` (after template.service exists)

### Phase 4 parallel groups:
- **A:** `media.service.js` + `cloudinary.utils.js`
- **B:** Search index + `tourPackage.search`
- **C:** Analytics aggregations + admin endpoints

---

## Diagram Validation Checklists

Run before marking any service complete.

### Diagram 3 — Pre-packaged booking flow:
- [ ] `booking.createBooking` calls `tourPackage.validatePackage` first
- [ ] Booking created with status `pending_payment`
- [ ] Payment verified → booking status → `confirmed`
- [ ] `booking.confirmed` event fires → email + in-app notification

### Diagram 4 — Dynamic tour flow:
- [ ] `dynamicTour.submitForPricing` creates record in pricingDesk queue
- [ ] SLA timer (Bull delayed job) started at quote creation
- [ ] `pricingDesk.customerAccept` triggers same payment flow as pre-packaged
- [ ] `pricingDesk.customerReject` notifies staff

### Diagram 9 — State machine:
- [ ] All `status` enums in booking/tourRequest/quote match diagram 9 exactly
- [ ] `bookingStates.config.js` encodes all valid transitions
- [ ] Cancellation and rejection states are distinct

### Diagram 6 — Data model:
- [ ] `TOUR_PACKAGE` has `attractionIds[]`, `diningIds[]`, `hotelPartnerId`, `destinationId`
- [ ] `QUOTE` has `slaDeadline`, `costBreakdown`, `sentAt`, `respondedAt`
- [ ] `PAYMENT` stores `transactionRef` and `provider`

### Diagram 7 — Middleware/auth flow:
- [ ] `ctx.meta.user` set before RBAC check
- [ ] Public routes pass without token check
- [ ] Admin routes enforced at middleware level

### Diagram 8 — Deployment topology:
- [ ] 4 containers: api, core-worker, partner-worker, comms-worker
- [ ] Each container loads its own domain model services
- [ ] Redis transporter used for all inter-container communication

---

## Deployment Conventions

```
SERVICES=api                                           → api container
SERVICES=auth,user,rbac,tourPackage,dynamicTour,...   → core-worker
SERVICES=hotelPartner,transport,attraction,...         → partner-worker
SERVICES=email,notification,template,media            → comms-worker
```

Each container also loads its own model services. Models are NOT shared across containers.

---

## Environment Variables

Never hardcode. Add to `.env.example` first, then read from `process.env` in config files.

```
MONGO_URI=
TEST_MONGO_URI=
REDIS_URL=
JWT_SECRET=
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=
SENDGRID_API_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
```

---

## Caching Policy — DISABLED During Development

Caching (`cacher` in `moleculer.config.js`) is **explicitly set to `null`**. Do NOT enable it until development is complete.

**Why:** Cache poisoning — stale or incorrect data in request/response cycles causes hard-to-debug issues. Moleculer's built-in caching can serve outdated records after writes, especially across services. This is a known footgun in microservice architectures.

**Rules:**
1. Never set `cacher` to anything other than `null` during development
2. Never add `cache: true` or `cache: { ... }` to any action definition
3. Never use `ctx.cachedResult` or `this.broker.cacher` in service code
4. When development is complete, caching will be enabled and tested as a dedicated task with:
   - Redis-backed cacher only (not in-memory)
   - Cache invalidation on every write action (create/update/delete)
   - Per-action cache TTLs tuned to data volatility
   - Full regression testing to verify no stale data is served

## Do NOT List
- No ESM (`import`/`export`) — CommonJS throughout
- No caching (`cache: true` on actions, `cacher` in config) until post-development
- No ORMs other than Mongoose
- No global error catching in services — let Moleculer's error handler manage it
- No `broker.call` inside model service actions
- No `strict: false` in schemas unless explicitly needed for dynamic fields
- No committing `.env` — only `.env.example`
- No skipping the `dependencies` array in service definitions
- No calling email/notification services directly from action handlers — use events
