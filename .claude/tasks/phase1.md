# Phase 1 Tasks — Foundation (Weeks 1–3)

## Week 1 — Scaffold and Infrastructure
- [ ] `package.json` — moleculer@0.14, moleculer-web, moleculer-db, moleculer-db-adapter-mongoose, mongoose@8, bcrypt, jsonwebtoken, bull, ioredis, nodemailer, cloudinary, twilio, handlebars, jest
- [ ] `moleculer.config.js` — Redis transporter, middleware array (dbIdNormalizer → rbacPermissions → rateLimiter → auditLog)
- [ ] `.env.example` — all required keys documented
- [ ] `utils/constants.js` — ERROR_CODES, BOOKING_STATUSES, TOUR_STATUSES enums
- [ ] `utils/db.utils.js` — isValidId, normalizeId
- [ ] `middlewares/dbIdNormalizer.middleware.js`
- [ ] `mixins/db.mixin.js` — Mongoose/MongoAdapter factory + MONGOOSE_COLLECTIONS array
- [ ] `jest.config.js`, `tests/setup.js`
- [ ] `docker-compose.dev.yml` — mongo + redis for local dev

**Parallel agents for Week 1:**
- Agent A: db.mixin.js + dbIdNormalizer + utils
- Agent B: configs (roles, permissions, bookingStates)
- Agent C: jest + docker-compose + .env.example

## Week 2 — Auth, User, RBAC
- [ ] `services/models/rbac/role.model.js`
- [ ] `services/models/rbac/permission.model.js`
- [ ] `services/models/rbac/rolePermission.model.js`
- [ ] `services/models/user/user.model.js` — OTP fields, role field
- [ ] `mixins/auth/authHelpers.mixin.js` — generateJWT, verifyJWT, generateOTP, hashPassword, comparePassword
- [ ] `mixins/auth/otpVerify.mixin.js`
- [ ] `mixins/rbac/role.mixin.js`, `mixins/rbac/permission.mixin.js`
- [ ] `config/roles.config.js` — customer, staff, admin
- [ ] `config/permissions.config.js` — full permission matrix
- [ ] `middlewares/rbacPermissions.middleware.js` — 3-role simplified
- [ ] `services/rbac.service.js` — createRole, assignPermission, checkAccess
- [ ] `services/auth.service.js` — register, login, verifyOTP, refreshToken, forgotPassword, resetPassword
- [ ] `services/user.service.js` — getProfile, updateProfile, listUsers (admin), changePassword
- [ ] `tests/unit/services/auth.service.test.js`
- [ ] `tests/unit/services/rbac.service.test.js`
- [ ] `scripts/seedScripts/seed-roles.js`
- [ ] `scripts/seedScripts/seed-permissions.js`

**Parallel agents for Week 2:**
- Agent A: RBAC models + rbac.service.js
- Agent B: user.model.js + authHelpers.mixin.js + auth.service.js

## Week 3 — API Gateway, Destinations, Partners, Email
- [ ] `services/api.service.js` — route aliases for all 21 services, JWT extraction in authenticate()
- [ ] `services/models/destination/destination.model.js`
- [ ] `services/destination.service.js` — CRUD + listByRegion
- [ ] `services/models/partner/hotelPartner.model.js`
- [ ] `services/models/partner/attraction.model.js`
- [ ] `services/models/partner/diningPartner.model.js`
- [ ] `services/models/partner/transportProvider.model.js`
- [ ] `services/models/partner/vehicle.model.js`
- [ ] `services/hotelPartner.service.js` — registerPartner, listHotels, getByDestination, setCommission
- [ ] `services/attraction.service.js` — CRUD + getByDestination
- [ ] `services/dining.service.js` — CRUD + getByDestination
- [ ] `services/transport.service.js` — registerProvider, listVehicles, estimateBase
- [ ] `services/models/template/template.model.js`
- [ ] `services/template.service.js` — create, render (Handlebars), seedDefaultTemplates
- [ ] `services/email.service.js` — send, sendTemplated, SendGrid fallback
- [ ] `tests/integration/auth.flow.test.js`
- [ ] `scripts/seedScripts/seed-destinations.js`

**Parallel agents for Week 3:**
- Agent A: destination + all partner models + partner services (hotelPartner, attraction, dining, transport)
- Agent B: template.service.js + email.service.js + api.service.js

## Phase 1 Gate
- [ ] `scripts/testScripts/test-phase1.js` — covers: auth register/login/OTP, RBAC check, Destination CRUD, Hotel CRUD, Email send
- [ ] `node scripts/testScripts/test-phase1.js` exits with code 0
