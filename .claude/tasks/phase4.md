# Phase 4 Tasks — Search, Media, Analytics, Deploy (Weeks 10–12)

> Prerequisite: Phase 3 gate passed (test-phase3.js exits 0)

## Week 10 — Media and Search
- [ ] `utils/cloudinary.utils.js` — RESEARCH CLOUDINARY STREAM UPLOAD FIRST
- [ ] `services/media.service.js` — upload (multipart stream, ctx.params is ReadStream), deleteMedia, listMedia (admin)
- [ ] Add MongoDB text indexes to `tourPackage.model.js` and `destination.model.js`
- [ ] Implement `tourPackage.search` action using $text aggregation

**Parallel agents for Week 10:**
- Agent A: cloudinary.utils.js + media.service.js
- Agent B: search indexes + tourPackage.search action

## Week 11 — Semi-automated Pricing and Analytics
- [ ] Extend `pricingDesk.service.js` with `estimateCost` — auto-populate cost breakdown from partner rates (lookup hotelPartner, transport, attraction, dining by destination and group size)
- [ ] Analytics aggregations in `booking.service.js` — revenue by period, popular destinations, group size trends
- [ ] Analytics aggregations in `payment.service.js` — commission tracking, payment plan adherence rates

**Parallel agents for Week 11:**
- Agent A: pricingDesk estimateCost action
- Agent B: booking + payment analytics aggregations

## Week 12 — Docker and Hardening
- [ ] `docker-compose.yml` — 4 containers:
  - `api`: SERVICES=api
  - `core-worker`: SERVICES=auth,user,rbac,tourPackage,dynamicTour,booking,payment,paymentPlan,contract,interest
  - `partner-worker`: SERVICES=hotelPartner,transport,attraction,dining,pricingDesk,destination
  - `comms-worker`: SERVICES=email,notification,template,media
- [ ] Each container also loads its own domain model services
- [ ] `middlewares/rateLimiter.middleware.js` — 100 req/15min on auth routes, 1000 req/15min on API
- [ ] `middlewares/auditLog.middleware.js` — write-action audit trail
- [ ] `mixins/paginate.mixin.js` — shared list/paginate helper
- [ ] Full `npm test` with coverage thresholds (70% branch + function on service files)
- [ ] Verify all diagram validation checklists in CLAUDE.md are complete

## Phase 4 Gate
- [ ] `npm test` passes with 0 failures
- [ ] Coverage thresholds met (70% branch + function)
- [ ] `docker-compose up` brings all 4 containers online without errors
- [ ] All 11 diagram validation checklists in CLAUDE.md completed

## Success Metrics Targets (from PRD)
- [ ] 6+ tour packages creatable via admin API
- [ ] Quote response time: 90% within SLA (2-3 business days)
- [ ] Payment plan milestones send reminders automatically
- [ ] Individual seat fill rate trackable via analytics endpoint
