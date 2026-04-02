# External API Inventory — Elysium Tours Backend

## Paystack (Payment Gateway) — VERIFIED
- **Used in:** `mixins/payment/paystack.mixin.js`, `services/payment.service.js`
- **Key operations:** initializeTransaction, verifyTransaction, createRefund, webhook verification
- **Research status:** TESTED WITH REAL SANDBOX
- **Test results:** Real GHS 900 payment via MTN MoMo. Transaction verified via API. Full cycle: initiate → checkout URL → browser payment → verifyPayment → booking confirmed.
- **Notes:** Amount in pesewas (GHS * 100). Webhook uses HMAC-SHA512. Channels: mobile_money, card, bank.
- **Credentials:** `sk_test_9f544...` (test key in .env)

## Hubtel SMS (Ghana Primary) — VERIFIED
- **Used in:** `utils/whatsapp.utils.js` (`sendViaHubtel`)
- **Key operations:** sendSMS via GET `smsc.hubtel.com/v1/messages/send`
- **Research status:** TESTED — SMS delivered to real phone
- **Test results:** Message ID `05f35d39-...`, rate GHS 0.03/SMS, status 0 (success)
- **Credentials:** `HUBTEL_CLIENT_ID=ihedxeyx`, `HUBTEL_SENDER_ID=233246836242`

## Gmail SMTP — VERIFIED
- **Used in:** `services/email.service.js`
- **Key operations:** sendMail via Nodemailer SMTP transport
- **Research status:** TESTED — email delivered to inbox
- **Notes:** Uses Gmail App Password (not regular password). Port 587, secure: false.
- **Credentials:** `eamokuandoh@gmail.com` with app password

## Cloudinary (Media Storage) — VERIFIED
- **Used in:** `utils/cloudinary.utils.js`, `services/media.service.js`
- **Key operations:** upload (stream + URL), delete, list, signed URL
- **Research status:** TESTED — upload, list, delete all work
- **Test results:** Image uploaded to `elysium-tours/` folder, visible in dashboard
- **Notes:** Use upload_stream (not base64) for large files. ctx.params is ReadStream in moleculer-web.
- **Credentials:** `CLOUDINARY_CLOUD_NAME=dyox4iu57`

## Sanity CMS — VERIFIED
- **Used in:** `utils/sanity.client.js`, `services/cms.service.js`
- **Key operations:** GROQ queries for blog, FAQ, testimonials, gallery, about, settings
- **Research status:** TESTED — all queries return seeded content
- **Notes:** Uses `@sanity/client` with `createClient`. Studio at `studio/` with 9 schemas. Content is editorial only (tours/bookings stay in MongoDB).
- **Credentials:** `SANITY_PROJECT_ID=s3ahmggx`, dataset `production`

## Twilio (WhatsApp + SMS Fallback) — NOT TESTED
- **Used in:** `utils/whatsapp.utils.js` (`sendViaTwilio`, `sendWhatsApp`)
- **Research status:** Stub implemented, falls back gracefully when no creds
- **Notes:** WhatsApp messages require pre-approved templates in production.

## SendGrid (Email Fallback) — NOT TESTED
- **Used in:** `services/email.service.js` (fallback when SMTP fails)
- **Research status:** Code implemented, not tested
- **Notes:** Uses `@sendgrid/mail` package.

## MongoDB Atlas — VERIFIED
- **Used in:** All model services via `mixins/db.mixin.js`
- **Research status:** TESTED — 51 E2E tests + all CRUD operations
- **Notes:** Patched `moleculer-db-adapter-mongoose@0.11` connect() for Mongoose 8 compatibility. Shared connection via `ensureConnected()`.
- **Credentials:** Atlas cluster at `cluster0.hamj7lq.mongodb.net`
