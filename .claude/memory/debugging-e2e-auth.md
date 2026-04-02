# E2E Debugging — Auth & Middleware Issues (2026-04-01)

## Issues Found During Real API Endpoint Testing

### Issue 1: Destination create without auth succeeds
- **Symptom:** `POST /api/v1/destinations` with no JWT token creates a destination instead of returning 401
- **Root cause:** The `rbacPermissions.middleware.js` uses `localAction` wrapper to check `action.auth`. This runs correctly when `broker.call()` is used directly. But moleculer-web may call actions differently.
- **Diagnosis path:** Check if moleculer-web's gateway bypasses `localAction` middleware. The `authentication: true` flag on the route should make the gateway call `authenticate()` which returns null for no token. Then `ctx.meta.user` is null. The middleware SHOULD catch this. But if the middleware isn't wrapping the action for some reason...
- **Fix needed:** May need to add auth check in the gateway's `onBeforeCall` hook or in `authorize()` method instead of relying solely on the middleware.

### Issue 2: Profile returns 500 instead of 401
- **Symptom:** `GET /api/v1/users/profile` without token returns `{"code":"INTERNAL_ERROR","message":"Cannot read properties of null (reading 'id')"}`
- **Root cause:** `user.getProfile` handler does `ctx.meta.user.id` without checking if user is null first. The middleware's 401 check isn't firing.
- **Related to:** Issue 1 — same root cause (middleware not blocking unauthenticated requests)

### Issue 3: Login returns "Not found" instead of proper error
- **Symptom:** `POST /api/v1/auth/login` for existing unverified user returns generic "Not found"
- **Root cause:** `auth.service.getUserWithSensitiveFields()` was updated to call `user.model.findWithSensitive` which uses `this.adapter.model.findOne()` — but `visibility: "protected"` on the action may prevent it from being called via `broker.call()` from another service.
- **Fix:** Change visibility to `"public"` or use `"published"` visibility, or call it internally.

### Issue 4: createdAt serialization as character-by-character object
- **Symptom:** Response returns `"createdAt":{"0":"2","1":"0",...}` instead of ISO string
- **Root cause:** The `dbIdNormalizer.middleware.js` outbound processing may be converting Date objects incorrectly, or moleculer-db's serialization is breaking dates.
- **Fix needed:** Check dbIdNormalizer's response transformation logic.

## Resolutions Applied

### Fix 1: Auth enforcement — added `authorize()` in api.service.js
The `rbacPermissions.middleware.js` localAction wrapper wasn't sufficient alone because moleculer-web's gateway routes actions through its own call chain. The `authorize()` method in the gateway runs AFTER `authenticate()` and BEFORE the action — this is the right place to check `action.auth` and `ctx.meta.user`. Now unauthenticated requests get 401 at the gateway level.

### Fix 2: Login sensitive fields — changed `findWithSensitive` visibility to "public"
`visibility: "protected"` in Moleculer prevents `broker.call()` from other services. Auth service needs to call `user.model.findWithSensitive` to get password/otp fields that are excluded from the default `settings.fields`. Changed to `visibility: "public"`.

### Fix 3: Date serialization — added Date check in dbIdNormalizer
`normalizeResponse()` recursively walks objects converting ObjectIds to strings. But Date objects are also `typeof "object"`, and when iterated, their keys are character indexes (0, 1, 2...) producing `{"0":"2","1":"0",...}`. Fix: added `if (data instanceof Date) return data.toISOString()` at the top of the object handler.

### Fix 4: Mongoose 8 + moleculer-db-adapter-mongoose@0.11 compatibility
The adapter's `connect()` has race conditions with Mongoose 8 and Atlas. Multiple model services calling `mongoose.connect()` simultaneously causes `connection.db` to be null. Fix: shared `ensureConnected()` promise + patched `adapter.connect()` that uses `mongoose.model()` registration with try/catch for already-registered models.

### Fix 5: dbIdNormalizer — removed inbound string→ObjectId conversion entirely
The normalizer was converting `*Id` fields (destinationId, hotelPartnerId, etc.) from strings to ObjectIds on inbound requests. This caused cascading failures: moleculer-db's `get` action expects `id` as string/number (param validation rejects ObjectId), and cross-service calls pass ObjectIds that get rejected by the next service's model.get.
- **Root cause:** Mongoose already handles string→ObjectId conversion natively in queries. The inbound conversion was unnecessary and harmful.
- **Fix:** Removed ALL inbound conversion. The normalizer now only converts ObjectIds and Dates to strings on the outbound (response) path.
- **Impact:** Fixed all 16 partner/package/booking creation failures in E2E.

### Fix 6: onError handler — MongoDB error code 11000 as HTTP status
MongoDB duplicate key errors have `err.code = 11000`. The onError handler used `err.code` directly as the HTTP status code, causing `ERR_HTTP_INVALID_STATUS_CODE` crash.
- **Fix:** Only use `err.code` as HTTP status if it's a valid 3-digit code (100-599). Map 11000 to 409 Conflict.

### Fix 7: Missing API routes discovered during E2E
- `POST /api/v1/tours/dynamic/build` — `dynamicTour.buildTourRequest` had no route (diagram 4 flow requires build then submit as two steps)
- `POST /api/v1/contracts/:contractId/send` — `contract.sendToCustomer` had no route (diagram 9 contract flow requires draft → sent → accepted)

## Heuristics Learned
1. **Unit tests with mocked models don't catch real adapter issues** — always do E2E tests against real DB early
2. **moleculer-web `authenticate()` returning null** — doesn't auto-reject. Use `authorize()` to enforce auth at the gateway level.
3. **`visibility: "protected"` in moleculer** — prevents `broker.call()` from other services. Use `"public"` for cross-service actions.
4. **Mongoose 8 + moleculer-db-adapter-mongoose@0.11** — adapter's `connect()` has race conditions with Atlas. Patch with shared `ensureConnected()`.
5. **Don't convert strings to ObjectIds in middleware** — Mongoose handles this natively. Converting causes moleculer-db param validation failures (expects string/number, not ObjectId object).
6. **MongoDB error codes aren't HTTP codes** — Always validate `err.code` is 100-599 before using as HTTP status. Map known codes: 11000 → 409.
7. **Event handlers fire async** — after creating a record that triggers events (booking.created → contract, payment plan), add a delay before asserting on the event's side effects.
8. **Every service action should have an API route** — if a service action exists but has no route, the E2E flow can't exercise it. Map all actions to routes during service creation, not after.
