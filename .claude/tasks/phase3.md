# Phase 3 Tasks — Payments, Plans, Contracts, Notifications (Weeks 7–9)

> Prerequisite: Phase 2 gate passed (test-phase2.js exits 0)

## Week 7 — PaymentPlan and Contract
- [ ] `services/models/paymentPlan/paymentPlan.model.js` — milestones subdoc array, totalAmount, paidAmount, status
- [ ] `services/models/paymentPlan/milestone.model.js` — dueDate, amount, status, paidAt
- [ ] `services/paymentPlan.service.js` — createPlan (auto-generate milestones from booking totalAmount), payMilestone, getMilestones, sendReminder, Bull job for pre-due-date reminders
- [ ] `services/models/contract/contractTemplate.model.js` — HTML body with Handlebars variables
- [ ] `services/models/contract/contract.model.js` — templateId, bookingId, acceptedAt, acceptedByIp, signatureToken
- [ ] `services/contract.service.js` — generateFromBooking, sendToCustomer, customerAccept (records IP + timestamp), verifyAcceptance, listContracts (admin)
- [ ] `tests/unit/services/paymentPlan.service.test.js`
- [ ] `tests/unit/services/contract.service.test.js`

**Parallel agents for Week 7:**
- Agent A: paymentPlan models + paymentPlan.service.js + Bull reminder jobs + unit test
- Agent B: contract models + contract.service.js + unit test

## Week 8 — Notifications and WhatsApp/SMS
- [ ] `services/models/notification/notification.model.js` — recipientId, type, channel enum (email|sms|whatsapp|in_app), read/unread
- [ ] `utils/whatsapp.utils.js` — RESEARCH TWILIO WHATSAPP API FIRST
- [ ] `services/notification.service.js` — send (routes to correct channel), markRead, listForUser, bulkSend (admin)
- [ ] Wire booking events → notification.send
- [ ] Wire payment events → email + notification
- [ ] Wire contract events → email
- [ ] Wire SLA breach events → staff notification

## Week 9 — Admin APIs and Pricing Desk Completion
- [ ] `/api/admin/*` route group in `api.service.js` — restricted to role: "admin"
- [ ] `pricingDesk` getSLAMetrics finalized with real MongoDB aggregations
- [ ] Payment reconciliation endpoint in `payment.service.js`
- [ ] Admin booking actions: updateStatus, forceCancel, issueRefund
- [ ] `tests/integration/payment.plan.flow.test.js`
- [ ] `scripts/testScripts/test-phase3.js`

## Phase 3 Gate
- [ ] `scripts/testScripts/test-phase3.js` — covers: paymentPlan generate/pay milestone, contract generate/accept, notification delivery
- [ ] `node scripts/testScripts/test-phase3.js` exits with code 0

## Diagram Validation — Phase 3
- [ ] Diagram 7 middleware/auth flow checklist complete
- [ ] Contract acceptance recorded with IP + timestamp
- [ ] Booking cannot reach `confirmed` without `contract.verifyAcceptance` passing
