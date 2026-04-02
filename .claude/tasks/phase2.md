# Phase 2 Tasks — Tour & Booking Domain (Weeks 4–6)

> Prerequisite: Phase 1 gate passed (test-phase1.js exits 0)

## Week 4 — Tour Package and Dynamic Tour
- [ ] `services/models/tour/tourPackage.model.js` — images[], attractionIds[], status enum, isActive
- [ ] `services/models/tour/packagePricing.model.js` — minGroupSize/maxGroupSize/pricePerPerson tiers
- [ ] `services/models/tour/tourRequest.model.js` — status enum matches diagram 9
- [ ] `services/models/tour/quote.model.js` — slaDeadline, costBreakdown subdoc, status enum
- [ ] `utils/slug.utils.js` — slug generation for packages/destinations
- [ ] `services/tourPackage.service.js` — listPackages (with filters), getPackage, createPackage, updatePackage, toggleActive, getPricingTiers, validatePackage
- [ ] `services/dynamicTour.service.js` — getDestinations, getOptions (aggregates by destination), buildTourRequest, submitForPricing, getMyRequests, cancelRequest
- [ ] `tests/unit/services/tourPackage.service.test.js`
- [ ] `tests/unit/services/dynamicTour.service.test.js`

**Parallel agents for Week 4:**
- Agent A: tourPackage.model.js + packagePricing.model.js + tourPackage.service.js + unit test
- Agent B: tourRequest.model.js + quote.model.js + dynamicTour.service.js + unit test

## Week 5 — Pricing Desk and Expression of Interest
- [ ] `config/bookingStates.config.js` — encode diagram 9 as a transition map
- [ ] `services/pricingDesk.service.js` — getQueue, assignQuote, submitQuote, sendToCustomer, customerAccept, customerReject, getSLAMetrics, SLA timer via Bull delayed job
- [ ] `services/models/interest/interest.model.js`
- [ ] `services/interest.service.js` — submitInterest, listInterests (admin), updateInterestStatus
- [ ] `tests/unit/services/pricingDesk.service.test.js`

**Parallel agents for Week 5:**
- Agent A: bookingStates.config.js + pricingDesk.service.js + unit test
- Agent B: interest.model.js + interest.service.js

## Week 6 — Booking and Commitment Fee Payment
- [ ] `services/models/booking/booking.model.js` — bookingRef (ELY-YYYYMMDD-XXXX), bookingType enum (packaged|dynamic|interest), status enum
- [ ] `services/models/booking/payment.model.js` — transactionRef, provider, commitment fee fields
- [ ] `utils/bookingRef.utils.js` — ELY-YYYYMMDD-XXXX generator
- [ ] `mixins/booking/bookingRef.mixin.js`
- [ ] `mixins/booking/bookingStatus.mixin.js` — transition(from, to) validates against bookingStates.config.js
- [ ] `mixins/payment/paystack.mixin.js` — RESEARCH PAYSTACK API FIRST
- [ ] `services/booking.service.js` — createBooking (validates package OR quote), getBooking, listBookings (role-scoped), updateStatus, cancelBooking, generateInvoice
- [ ] `services/payment.service.js` — initiatePayment (commitment fee first), verifyPayment (Paystack webhook), refundPayment, getTransactions, reconcile (admin)
- [ ] `tests/unit/services/booking.service.test.js`
- [ ] `tests/unit/services/payment.service.test.js`
- [ ] `tests/integration/booking.packaged.flow.test.js`

**Parallel agents for Week 6 (after pricingDesk is complete):**
- Agent A: booking.model.js + bookingStatus.mixin.js + booking.service.js + unit test
- Agent B: payment.model.js + paystack.mixin.js + payment.service.js + unit test

## Phase 2 Gate
- [ ] `scripts/testScripts/test-phase2.js` — covers: package list/get, dynamic tour submit, booking create, payment initiate/verify
- [ ] `node scripts/testScripts/test-phase2.js` exits with code 0

## Diagram Validation — Phase 2
- [ ] Diagram 3 checklist complete (pre-packaged flow)
- [ ] Diagram 4 checklist complete (dynamic tour flow)
- [ ] Diagram 9 state machine: all booking/quote status enums verified
