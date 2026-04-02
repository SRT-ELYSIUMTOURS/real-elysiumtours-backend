# Elysium Tours API — Postman Collection Documentation

## Quick Start

### 1. Import into Postman
1. Open Postman → **Import** → drag both files:
   - `ElysiumTours.postman_collection.json`
   - `ElysiumTours.postman_environment.json`
2. Select the **"Elysium Tours - Dev"** environment from the top-right dropdown

### 2. Configure Environment
| Variable | Default | Change when |
|----------|---------|-------------|
| `baseUrl` | `http://localhost:3001` | Testing against Render/deployed instance |
| `adminEmail` | `admin@elysiumtours.com` | Different admin account seeded |
| `adminPassword` | `AdminPass123!` | Different admin password |
| `staffEmail` | `staff@elysiumtours.com` | Different staff account |
| `staffPassword` | `StaffPass123!` | Different staff password |
| `testOtp` | `123456` | Server uses different dev OTP |

All other variables are **auto-populated** by response scripts during the run.

### 3. Run the Collection
**Collection Runner** → select **"Elysium Tours API"** → choose environment → **Run**.

The requests execute in order. Each response script saves IDs and tokens needed by later requests.

---

## Environment Variable Patterns

### URL Variables
```
baseUrl  →  http://localhost:3001          (switch for deployed)
apiUrl   →  {{baseUrl}}/api/v1             (auto-resolved)
apiUrlV2 →  {{baseUrl}}/api/v2             (multi-tenant)
```

To test against a Render deployment:
```
baseUrl = https://elysiumtours-api.onrender.com
```

All requests use `{{apiUrl}}/...` so switching `baseUrl` switches everything.

### Token Variables (auto-populated)
| Variable | Set by | Used by |
|----------|--------|---------|
| `accessToken` | Login / Verify OTP | All customer-auth requests (collection default) |
| `refreshToken` | Login / Verify OTP | Refresh Token request |
| `adminAccessToken` | Admin Login (seed) | All `(Admin)` requests |
| `adminRefreshToken` | Admin Login (seed) | — |
| `staffAccessToken` | Staff Login (seed) | All `(Staff)` requests |
| `staffRefreshToken` | Staff Login (seed) | — |

### Entity ID Variables (auto-populated)
| Variable | Set by | Used by |
|----------|--------|---------|
| `userId` | Register / Login | User management requests |
| `destinationId` | Create Destination | Partners, Tour Packages, Dynamic Tours |
| `hotelPartnerId` | Create Hotel | Tour Packages, Bookings |
| `attractionPartnerId` | Create Attraction | Tour Packages, Dynamic Tours |
| `diningPartnerId` | Create Dining Partner | Dynamic Tours |
| `transportProviderId` | Register Transport | Vehicles, Tour Packages |
| `vehicleId` | Add Vehicle | — |
| `tourPackageId` | Create Tour Package | Bookings, Interests, Reviews |
| `tourRequestId` | Build Tour Request | Submit for Pricing |
| `quoteId` | Submit for Pricing / Queue | Pricing Desk workflow |
| `bookingId` | Create Booking | Payments, Plans, Contracts |
| `bookingRef` | Create Booking | Display reference |
| `paymentId` | Initiate Payment | Verify, Refund |
| `transactionRef` | Initiate Payment | Verify Payment |
| `paymentPlanId` | Get Payment Plan | Milestones |
| `milestoneId` | Get Payment Plan | Pay Milestone |
| `contractId` | Get Contract by Booking | Send, Accept, Reject |
| `interestId` | Submit Interest | Withdraw Interest |
| `reviewId` | Create Review | Update, Delete Review |
| `notificationId` | List Notifications | Mark as Read |
| `mediaPublicId` | Upload File | Get Signed URL, Delete |

---

## Collection Run Order & Chaining

The collection is ordered for sequential execution in Postman's Collection Runner:

```
_Runner Seed
  ├── Generate Run ID          → creates unique testCustomerEmail
  ├── Admin Login (seed)       → saves adminAccessToken
  └── Staff Login (seed)       → saves staffAccessToken

Auth
  ├── Register Customer        → saves userId, registeredEmail
  ├── Verify OTP              → saves accessToken (uses registeredEmail + testOtp)
  ├── Resend OTP
  ├── Login Customer           → refreshes accessToken
  ├── Refresh Token            → refreshes both tokens
  ├── Forgot Password
  └── Reset Password           → expected to fail in auto-run (no real token)

Users
  ├── Get My Profile           → confirms userId
  ├── Update My Profile
  ├── Change Password
  ├── List Users (Admin)
  ├── Get User by ID (Admin)
  └── Update User Status (Admin)

Destinations
  ├── Create Destination (Admin) → saves destinationId
  ├── List Destinations
  ├── Get / Search / Slug / Region / Nearby
  ├── Update Destination (Admin)
  └── Toggle Active (Admin)

Partners
  ├── Hotels
  │   ├── Create Hotel (Admin)  → saves hotelPartnerId
  │   ├── List / Get / By Destination / Nearby
  │   ├── Update / Commission / Close-Out / Toggle
  ├── Attractions
  │   ├── Create Attraction     → saves attractionPartnerId
  │   └── List / Get / By Destination
  ├── Dining
  │   ├── Create Dining         → saves diningPartnerId
  │   └── List / Get
  └── Transport
      ├── Register Provider     → saves transportProviderId
      ├── Add Vehicle           → saves vehicleId
      └── List / Estimate

Tour Packages
  ├── Create Package (Admin)   → saves tourPackageId
  ├── List / Get / Search / Proximity / View Count
  ├── Join Waitlist
  ├── Get Waitlist (Staff)
  ├── Update / Toggle

Dynamic Tours
  ├── Get Options              → uses destinationId
  ├── Build Tour Request       → saves tourRequestId
  ├── Submit for Pricing       → saves quoteId
  ├── Get My Requests
  └── Cancel Request

Pricing Desk
  ├── Get Queue (Staff)        → fallback quoteId
  ├── Get Quote / Assign / Submit (Staff)
  ├── Customer Accept / Reject Quote
  ├── Revise Quote (Staff)
  └── SLA Metrics (Admin)

Bookings
  ├── Create Booking (Packaged) → saves bookingId, bookingRef
  ├── Create Booking (Dynamic)
  ├── List / Get
  ├── Update Status / Confirm Partner / Substitutions
  ├── Cancel Booking
  └── Analytics / Occupancy (Admin)

Payments
  ├── Initiate (Commitment Fee) → saves paymentId, transactionRef
  ├── Initiate (Full)
  ├── Verify Payment
  ├── Get Transactions
  ├── Refund (Admin)
  ├── Webhook (simulate)
  └── Analytics / Revenue (Admin)

Payment Plans
  ├── Get Plan by Booking      → saves paymentPlanId, milestoneId
  ├── Get Plan by ID / Milestones / Next Due
  └── Pay Milestone

Contracts
  ├── Seed Templates (Admin)
  ├── List / Create Templates
  ├── Get Contract by Booking  → saves contractId
  ├── Send / Accept / Reject / Verify
  └── List Contracts

Interests → Reviews → Contact → Notifications → Media → CMS → Admin
```

### Handling the OTP Problem in Collection Runs

The OTP flow is the trickiest part for automated runs. The collection handles it by:

1. **Register** creates a user with a unique email
2. **Verify OTP** uses `{{registeredEmail}}` (auto-set from register) and `{{testOtp}}` (env default: `123456`)
3. **Your server must accept OTP `123456` in dev/test mode** — add this to your auth service:

```javascript
// In auth.service.js → verifyOtp action
if (process.env.NODE_ENV !== 'production' && otp === '123456') {
    // Accept test OTP in dev/test
}
```

If you can't modify the server, manually set `testOtp` after checking your email/console for the real OTP.

### Requests That May Fail in Auto-Runs (Expected)

| Request | Why | Impact |
|---------|-----|--------|
| Reset Password | Needs real `resetToken` from email | None — tests accept 400/422 |
| Verify Payment | Needs real Paystack sandbox transaction | Accepts 400/422 |
| Cancel Tour Request | May conflict with pricing flow | State-dependent |
| Toggle Active requests | May flip state unexpectedly | Cosmetic |

---

## Folder Reference

### _Runner Seed
Bootstraps the collection run by logging in admin/staff and generating a unique customer email.

### Auth (7 requests)
Full authentication lifecycle. Register → OTP → Login → Refresh → Forgot/Reset password.

### Users (6 requests)
Profile management (customer) and user administration (admin).

### Destinations (9 requests)
CRUD + geospatial queries. Public read, admin write.

### Partners (17 requests)
Four sub-folders: Hotels (9), Attractions (4), Dining (3), Transport (5). Covers CRUD, geo queries, commissions, close-out dates, and vehicle management.

### Tour Packages (10 requests)
Pre-packaged tour lifecycle: CRUD, search, view tracking, waitlist.

### Dynamic Tours (5 requests)
Custom tour builder: get options → build draft → submit for pricing → manage requests.

### Pricing Desk (8 requests)
Staff pricing workflow: queue → assign → quote → customer accept/reject → revise.

### Bookings (10 requests)
Both packaged and dynamic bookings. Partner confirmations, substitutions, cancellation, analytics.

### Payments (8 requests)
Paystack integration: initiate → verify → refund. Webhook simulation. Analytics.

### Payment Plans (5 requests)
Milestone-based installment plans: get plan → milestones → pay next due.

### Contracts (9 requests)
Template management and contract lifecycle: seed → create → send → accept/reject → verify.

### Interests (6 requests)
Expression of interest: submit → list → count → withdraw → bulk invite.

### Reviews (6 requests)
Customer reviews: create → list → stats → update → admin response → delete.

### Contact & Newsletter (2 requests)
Public forms — no auth required.

### Notifications (2 requests)
List and mark-as-read for authenticated user.

### Media (5 requests)
Cloudinary file management: upload (file/URL) → list → signed URL → delete.

### CMS (7 requests)
Public Sanity CMS content: blog, FAQs, testimonials, gallery, about, settings.

### Admin (5 requests)
Dashboard KPIs, booking/occupancy/payment analytics, SLA metrics, email templates.

---

## Auth Patterns

### Default Auth (Customer)
Most requests inherit the collection-level Bearer token (`{{accessToken}}`). This is the customer token.

### Admin Auth
Admin requests explicitly override with:
```
Authorization: Bearer {{adminAccessToken}}
```

### Staff Auth
Staff requests use:
```
Authorization: Bearer {{staffAccessToken}}
```

### Public (No Auth)
Public endpoints set `auth: noauth` explicitly.

---

## Tips

### Switching Environments
Duplicate the environment and change `baseUrl`:
- **Dev**: `http://localhost:3001`
- **Staging**: `https://staging-api.elysiumtours.com`
- **Production**: `https://api.elysiumtours.com`

### Running Specific Folders
In Collection Runner, expand the collection and select only the folders you want to test.

### Debugging
- Open Postman Console (`Ctrl+Alt+C`) to see `console.log` output from scripts
- All saved variables are logged with their values
- Check the environment panel to verify variables are being set

### Testing a Single Flow
Run folders in this order for a complete booking flow:
1. `_Runner Seed` (get tokens)
2. `Destinations` → `Create Destination`
3. `Partners > Hotels` → `Create Hotel`
4. `Partners > Attractions` → `Create Attraction`
5. `Tour Packages` → `Create Tour Package`
6. `Auth` → `Register` + `Verify OTP`
7. `Bookings` → `Create Booking (Packaged)`
8. `Payments` → `Initiate Payment`

### Disabled Query Params
Many GET requests include optional query params that are disabled by default. Enable them in the Params tab to filter results:
```
?region=Central          (disabled by default)
?tier=premium            (disabled by default)
?status=pending          (disabled by default)
```

---

## Modern Postman Features Used

This collection takes advantage of features from Postman's 2024-2025 releases:

### Postman Vault (Secrets)
For sensitive values (Paystack keys, JWT secret), use **Postman Vault** instead of environment variables:
1. Open Postman → Settings → Vault
2. Add secrets like `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`
3. Reference in requests as `{{vault:PAYSTACK_WEBHOOK_SECRET}}`

Vault secrets **never leave your machine** and **never sync to Postman cloud**. They take the highest variable precedence.

### Built-in Package Library (require() in scripts)
The collection uses these built-in packages available in Postman's script sandbox:

| Package | Where used | Purpose |
|---------|-----------|---------|
| `ajv` | Register, Create Booking | JSON Schema validation of responses |
| `crypto-js` | Paystack Webhook | HMAC-SHA512 signature generation |
| `uuid` | Available for custom use | Generate idempotency keys |
| `lodash` | Available for custom use | Data transformation |
| `moment` | Available for custom use | Date manipulation |

Example — adding schema validation to any request:
```javascript
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });

pm.test("Response matches schema", () => {
    const schema = {
        type: "object",
        required: ["success", "data"],
        properties: {
            success: { type: "boolean" },
            data: { type: "object", required: ["id", "status"] }
        }
    };
    const valid = ajv.validate(schema, pm.response.json());
    if (!valid) console.warn("Schema errors:", ajv.errorsText());
    pm.expect(valid).to.be.true;
});
```

Example — generating a UUID idempotency key:
```javascript
const uuid = require('uuid');
pm.environment.set('idempotencyKey', uuid.v4());
```

### Global Post-response Script
Every request automatically:
1. Checks response time < 5 seconds
2. Validates JSON content type
3. Logs 4xx/5xx errors to Postman Console for debugging

### Webhook Signature Auto-generation
The Paystack Webhook request auto-generates the `x-paystack-signature` header using `crypto-js`:
```javascript
const CryptoJS = require('crypto-js');
const hash = CryptoJS.HmacSHA512(body, webhookSecret).toString(CryptoJS.enc.Hex);
```
Set `paystackWebhookSecret` in your environment (or use Vault: `{{vault:PAYSTACK_WEBHOOK_SECRET}}`).

---

## CI/CD Integration (Newman)

Run the collection in CI using **Newman** (no Postman account required):

```bash
# Install
npm install -g newman newman-reporter-htmlextra

# Run all tests
npx newman run postman/ElysiumTours.postman_collection.json \
  --environment postman/ElysiumTours.postman_environment.json \
  --env-var "baseUrl=http://localhost:3001" \
  --env-var "adminEmail=admin@elysiumtours.com" \
  --env-var "adminPassword=AdminPass123!" \
  --reporters cli,junit,htmlextra \
  --reporter-junit-export test-results/api-tests.xml \
  --reporter-htmlextra-export test-results/report.html

# Run a specific folder only
npx newman run postman/ElysiumTours.postman_collection.json \
  --environment postman/ElysiumTours.postman_environment.json \
  --folder "Auth" \
  --env-var "baseUrl=http://localhost:3001"
```

### GitHub Actions Example
```yaml
name: API Tests
on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7
        ports: ['27017:27017']
      redis:
        image: redis:7
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm start &
        env:
          MONGO_URI: mongodb://localhost:27017/elysium-test
          REDIS_URL: redis://localhost:6379

      - name: Run Postman Collection
        run: |
          npx newman run postman/ElysiumTours.postman_collection.json \
            --environment postman/ElysiumTours.postman_environment.json \
            --env-var "baseUrl=http://localhost:3001" \
            --reporters cli,junit \
            --reporter-junit-export test-results/api-tests.xml

      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: api-test-results
          path: test-results/
```

### Variable Precedence in Newman
Newman `--env-var` overrides environment file values. Use this for CI secrets:
```bash
--env-var "adminPassword=${{ secrets.ADMIN_PASSWORD }}"
--env-var "paystackWebhookSecret=${{ secrets.PAYSTACK_WEBHOOK_SECRET }}"
```

---

## Variable Resolution Order

From highest to lowest precedence:

1. **Vault** — local only, never exported (`{{vault:NAME}}`)
2. **Local overrides** — UI overrides, never synced
3. **Data file** — CSV/JSON fed into Collection Runner
4. **Newman --env-var** — CLI overrides (CI use)
5. **Environment** — the selected environment file
6. **Collection** — `variable` array in collection JSON
7. **Global** — Postman workspace globals
