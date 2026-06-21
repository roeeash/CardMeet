# CardMeet — MVP Build Plan

**Goal:** Advance the repo from its current state (a polished static prototype + a stubbed backend skeleton) to a **functional web MVP** that looks like `mvp.html` and is wired to a real, persistent backend.

**Two decisions locked in for this plan:**

1. **Frontend:** Evolve `mvp.html` in place — keep the single-file React-via-CDN app, replace the `SEED_*` mock data with live API calls, and add real auth/token handling.
2. **Backend / DB:** Use the real PostgreSQL + PostGIS database via the provided `docker-compose.yml`, run the existing migrations, and flesh out the stubbed services and routes into a real persistent API. Redis and Socket.io are **deferred** for the MVP (use HTTP polling / manual refresh instead of websockets).

---

## 1. Where the project actually is today

### What exists and is solid
- **`mvp.html`** — a complete, self-contained React prototype covering all 8 screens (Login, Onboarding, Calendar, Browse, Listing, Deals, Deal Detail, Profile). Visually matches the design system. **But:** every screen reads from in-file `SEED_DEALS` / `SEED_LISTINGS` / `SEED_EVENTS` / `CURRENT_USER` constants and mutates local React state. Login and Onboarding just flip booleans. Nothing talks to a server.
- **Database layer** — 5 migrations (`001`–`005`) covering users/profiles, events/RSVPs, listings, deals/offers, meetups/notifications. Well-structured, with PostGIS extension and proper indexes. A seed file (`001_sample_data.ts`) with ~12 inserts.
- **Models** (`backend/src/models/**`) — reasonable Knex-based models for User, Profile, Event, Listing, Deal, Offer, Meetup.
- **App wiring** — `app.ts` mounts all 6 route groups, helmet, CORS, rate limiting, request logging, health check. `docker-compose.yml` defines postgis + redis + backend. `check-syntax.js` validates JSX in HTML (enforced by a PostToolUse hook).

### What is stubbed, broken, or missing
- **Services are thin and contain real bugs:**
  - `AuthService.refreshTokens` calls `UserModel.findByEmail('')` as a placeholder — broken.
  - `ProfileService.getProfile` also calls `UserModel.findByEmail('')` — broken. There is **no `UserModel.findById`**.
  - `DealService.createDeal` fetches the listing via `ListingModel.getSellerListings(listingId)` — wrong method (that queries by `seller_id`). There is **no `ListingModel.findById`**.
  - `ListingService.getListingById` also calls `getSellerListings(id)` — wrong.
  - `DealService.makeOffer` has a `// Flip turn` comment but **never flips the turn**, so turn-based negotiation doesn't actually work.
  - `MeetupService.checkIn` marks the meetup `completed` instead of recording a check-in — wrong semantics.
- **`NotificationService` is missing** — it's referenced throughout instructions 6/7/8 but no file exists.
- **Every route has a `mock` fallback** in its `catch` block that returns fake data on any error. This hides real failures and means the API "works" even when the DB is down. These must be removed so the frontend exercises real behavior.
- **No server entrypoint that listens** — `app.ts` exports `app`/`server` but nothing calls `server.listen(PORT)`. There's no way to actually start the API.
- **`.env` is inconsistent** — it has a Supabase `DB_HOST` line, then overrides it with `127.0.0.1:5433`, while `docker-compose` runs Postgres on `5432` with db `cardmeet_dev` / user `postgres` / password `password`. These must be reconciled.
- **CORS origin** is hardcoded to `http://localhost:3000`; the frontend serving strategy must match.
- **Tests** (`phase1.test.ts`) are structure/type-only and do not touch a database. No integration coverage of the real API.
- **Field-shape mismatch** — backend uses snake_case and `price_cents` (integer cents, currency ILS); `mvp.html` uses camelCase and whole-shekel `price`. A mapping layer is needed at the API boundary.

### Net assessment
We are at roughly **"Phase 1 scaffolding complete, Phase 1 behavior not yet real."** The skeleton (DB schema, models, route surface, UI) is in place; the connective tissue (working services, a runnable server, and a frontend that calls it) is not. The `instruction*.md` files target a React Native app with Redis + Socket.io; this plan intentionally diverges to a **web** MVP and defers realtime infra, per the locked decisions above.

---

## 2. Target architecture for the MVP

```
┌─────────────────────────┐        HTTP/JSON         ┌──────────────────────────┐
│  mvp.html (React/CDN)   │  ───────────────────────▶ │  Express API (port 3001) │
│  - api.js fetch helper  │  ◀───────────────────────  │  routes → services →     │
│  - in-browser token     │      Bearer JWT           │  models → Knex           │
└─────────────────────────┘                            └────────────┬─────────────┘
            ▲                                                        │
            │ served as static file                                 ▼
            │ (same origin or CORS-allowed)              ┌──────────────────────────┐
            └────────────────────────────────────────── │ Postgres + PostGIS (5432) │
                                                          │ (docker-compose)          │
                                                          └──────────────────────────┘
```

- **No build step on the frontend** — keep Babel-in-browser so `mvp.html` stays a single editable file.
- **JWT access token** held in the browser (`localStorage`), sent as `Authorization: Bearer`. (localStorage is fine here — this is a real file served over HTTP, not a sandboxed artifact.)
- **Redis / Socket.io / push notifications: out of scope** for the MVP. "Your turn" updates come from re-fetching deals on screen focus / pull-to-refresh.

---

## 3. Phased step-by-step plan

Each step is small and independently verifiable. Phases are ordered so the app is runnable end-to-end as early as possible, then hardened.

### Phase 0 — Get the stack running (no behavior changes)

- [x] **0.1** Reconcile `backend/.env` to match `docker-compose`: single `DB_HOST=127.0.0.1`, `DB_PORT=5432`, `DB_NAME=cardmeet_dev`, `DB_USER=postgres`, `DB_PASSWORD=password`. Remove the Supabase/5433 lines. Set strong `JWT_SECRET` / `JWT_REFRESH_SECRET`.
   **Outcome:** Removed Supabase orphaned config, reconciled all DB credentials to docker-compose values, generated 43-char base64 JWT secrets.
- [x] **0.2** Add a real server entrypoint: create `backend/src/index.ts` (or add to `app.ts`) that imports `server` and calls `server.listen(process.env.PORT || 3001)`. Point the `dev`/`start` scripts at it.
   **Outcome:** Created index.ts with proper server startup, PORT extraction with fallback, and logging. Updated package.json dev/start scripts to point to new entrypoint.
- [x] **0.3** `docker compose up -d postgres` (skip redis/backend containers for now; run the API on the host for fast iteration).
   **Outcome:** Postgres service started and verified running on port 5432 with correct database, user, and PostGIS extension.
- [x] **0.4** `cd backend && npm install`, then `npm run db:migrate` and `npm run db:seed`. Confirm tables and seed rows exist (`npm run db:health`).
   **Outcome:** All 5 migrations executed successfully, 3 users and 2 events seeded, health check confirms tables exist with correct row counts. Jest tests pass (17/17).
- [x] **0.5** `npm run dev` and verify `GET /health` returns `200`. **Checkpoint:** API boots and connects to Postgres.
   **Outcome:** Server boots successfully, /health endpoint returns 200 OK with valid JSON, database health confirmed with correct seed data (3 users, 2 events).

### Phase 1 — Make the backend real (remove mocks, fix services)

- [x] **1.1** Add `UserModel.findById(id)` and `ListingModel.findById(id)` to the models.
   **Outcome:** Both methods added with parameterized Knex queries returning User | null and Listing | null. Tests pass (17/17).
- [x] **1.2** Fix `AuthService.refreshTokens` to look the user up by `userId` from the verified refresh token (use `findById`), and re-issue a proper token pair.
   **Outcome:** Replaced findByEmail('') with findById(payload.userId), added user validation, re-token issuance works correctly. Tests pass (17/17).
- [x] **1.3** Fix `ProfileService.getProfile` to use `findById` + `findByUserId` (remove the `findByEmail('')` placeholder).
   **Outcome:** Replaced findByEmail('') with findById+findByUserId, added null checks, returns combined { user, profile } with proper typing. Tests pass (17/17).
- [x] **1.4** Fix `DealService.createDeal` to fetch the listing via `ListingModel.findById(listingId)` and derive `sellerId` from it; validate listing is `active` and buyer ≠ seller.
   **Outcome:** Replaced getSellerListings with findById, added validations for listing existence/status/buyer-seller check. Fixed Listing type to use snake_case. Tests pass (17/17).
- [x] **1.5** Fix `ListingService.getListingById` to use `findById`.
   **Outcome:** Replaced getSellerListings call with findById, method now returns single listing correctly. Tests pass (17/17).
- [x] **1.6** Implement turn-flipping in `DealService.makeOffer` (and counter): after an offer, set the deal's "current turn" to the other party; update `current_price_cents`. Add validation (positive amount, deal still negotiating).
   **Outcome:** Added DealModel.getById() and updateDeal(), implemented full validation and turn-flipping logic. Tests pass (19/19).
- [x] **1.7** Fix `MeetupService.checkIn` to record a check-in (per-party flag / timestamp), not mark the meetup completed. Completion happens only when both parties have checked in or an outcome is set.
   **Outcome:** Added per-party check-in columns to migration, updated Meetup type, implemented recordCheckIn+checkAndCompleteMeetup logic. Tests pass (20/20).
- [x] **1.8** Create a minimal `NotificationService` (DB-backed insert into the notifications table; no push). Wire the no-op-safe calls that instructions 6/7/8 expect so services don't crash.
   **Outcome:** Created NotificationModel + NotificationService with DB-backed inserts, no-op safe error handling, try-catch wrappers. Tests pass (26/26).
- [x] **1.9** **Remove the `mock` fallbacks** from all routes (`auth`, `deals`, `events`, `listings`, `meetups`, `profile`). Replace with proper error handling that returns real status codes (400/401/403/404/500) and surfaces validation errors.
   **Outcome:** Created errorHandler.ts utility, removed all mock data from routes, replaced catch blocks with proper status code mapping. Tests pass (26/26).
- [x] **1.10** Add input validation (the `joi` dependency is already present) to the write endpoints: register/login, create listing, create deal, make offer, RSVP, schedule meetup.
   **Outcome:** Created validation.ts middleware with 10 Joi schemas, applied to all write endpoints. Validation errors return 400 with descriptive messages. Tests pass (53/53).
- [x] **1.11** Define the **API response contract** (a small `toDTO` mapper per resource) that converts snake_case + `price_cents` → the camelCase + whole-shekel shape `mvp.html` expects. Document it in a short `backend/API.md`.
   **Outcome:** Created dto.ts with 8 mappers + 9 batch helpers, updated all routes to use DTOs, documented API contract in API.md. Tests pass (53/53).

**PHASE 1 CHECKPOINT:** All 11 cycles complete ✓. Backend services fixed, mock fallbacks removed, validation added, DTO layer in place. Ready for Phase 2 (frontend wiring).
- [x] **1.12** Confirm `findNearbyEvents` / `findNearbyUsers` PostGIS queries run against the postgis image; adjust the radius unit (km) if needed. **Checkpoint:** every endpoint returns real data from Postgres with no mock branch.
   **Outcome:** Created numeric validation helpers for lat/lng/radius parsing; updated ListingService to fetch user profile and merge location/radius filters; hardened EventService error handling; added 31 integration tests confirming PostGIS queries return real data with km→meters conversion working correctly. All geospatial tests pass.

### Phase 2 — Frontend API layer (still showing seed data as fallback)

- [x] **2.1** Add an `API_BASE` constant and a `fetchJSON(path, opts)` helper near the top of the `mvp.html` script block. It attaches the Bearer token, JSON-encodes bodies, and throws on non-2xx.
   **Outcome:** Added API_BASE constant (http://localhost:3001) and fetchJSON helper to mvp.html; helper reads token from localStorage, attaches Bearer auth header, JSON-encodes bodies, throws descriptive errors on non-2xx, returns JSON on success. Syntax check passes, app renders on seed data unchanged.
- [x] **2.2** Add a tiny token store: read/write `cardmeet_token` in `localStorage`; expose `setToken` / `clearToken` / `getToken`.
   **Outcome:** Added setToken, getToken, and clearToken functions to mvp.html (lines 379–402) with proper JSDoc documentation; all use consistent localStorage key 'cardmeet_token' matching fetchJSON. Syntax check passes, no component changes.
- [x] **2.3** Add a small mapping layer (`mapDeal`, `mapListing`, `mapEvent`, `mapProfile`) that converts API DTOs into the exact prop shapes the existing components already consume — so component JSX barely changes.
   **Outcome:** Added 3 helper functions (gameDisplayName, conditionDisplayName, formatTimeAgo) and 4 mapper functions to mvp.html; mappers convert API camelCase/lowercase to component shapes with proper type conversions (game titlecase, condition uppercase, date formatting). All with JSDoc. Syntax check passes, no component changes.
- [x] **2.4** Keep `SEED_*` as a **fallback only** (used if a fetch fails) during this phase so the UI never goes blank while wiring proceeds. Remove fallbacks at the end of Phase 3.
   **Outcome:** Added Phase 3 API Wiring Pattern documentation with two commented examples (try/catch/fetchJSON/mappers/SEED_* fallback); updated SEED_* section header to "Temporary — Fallback Only"; added JSDoc explaining dev-only nature and Phase 3.10 removal. Syntax check passes, no component changes.
- [ ] Run `node check-syntax.js mvp.html` after every edit (the hook does this automatically). **Checkpoint:** helper + mappers compile; app still renders on seed data.

### Phase 3 — Wire each screen to the API

- [x] **3.1 Auth:** `LoginScreen` calls `POST /api/auth/login` and `/register`; store token; on success advance to onboarding/app. Handle bad-credential errors inline.
   **Outcome:** Wired LoginScreen to POST /api/auth/login and /register with email/password/displayName; token extracted and stored via setToken(); error messages display inline (red box) on failures; buttons disabled during loading; mode toggle clears error and displayName state. Navigates to OnboardingScreen on success.
- [x] **3.2 Onboarding:** on finish, `POST/PUT /api/profile` with city → lat/lng (hardcode Tel Aviv coords for the MVP, or a tiny city map), radius, and selected games. Mark onboarding complete based on whether a profile exists.
   **Outcome:** Wired OnboardingScreen to PUT /api/profile with locationLat/locationLng (hardcoded Tel Aviv: 32.0853, 34.7818), travelRadiusKm (5–100 km slider, default 30), and games array (lowercase codes: mtg, pokemon, yugioh, lorcana). Error messages inline (red), buttons disabled during loading, navigates to CalendarScreen on success.
- [x] **3.3 Calendar:** `GET /api/events` (nearby + game-filtered) on mount; RSVP buttons call `PUT /api/events/:id/rsvp`; update local state from the response.
   **Outcome:** Wired CalendarScreen to fetch GET /api/events on mount with loading/error states; RSVP buttons call PUT /api/events/:id/rsvp with status body; local state updates on success; error messages display inline (red); fallback to SEED_EVENTS if fetch fails. All buttons disabled during loading.
- [x] **3.4 Browse:** `GET /api/listings` with filters (game, shared-events-only, search query); render shared-convention badges from the API's `sharedEvents`.
   **Outcome:** BrowseScreen wired to fetch listings from GET /api/listings with game/sharedEventsOnly/search filters; ListingService enriches listings with sharedEvents via EventService; shared-con badges render from API data; error fallback to SEED_LISTINGS.
- [x] **3.5 Listing detail:** load the listing by id; "Make offer" calls `POST /api/deals` (creates deal + initial offer) and routes to Deals.
   **Outcome:** ListingScreen wired to fetch listing by ID via GET /api/listings/:id, render detail with shared-con badge; "Make offer" modal posts to /api/deals with shekels-to-cents conversion; navigates to DealsScreen on success with fallback to SEED_LISTINGS on error.
- [x] **3.6 Deals:** `GET /api/deals` grouped into negotiating/matched/scheduled; compute the "your turn" badge from the API's turn field.
   **Outcome:** DealModel enriches deals via multi-table joins (listings, profiles, offers, events); dealToDTO maps card/counterparty/thread/shared-events; frontend mapDeal() computes turn from currentTurn field via JWT token decode; DealsScreen fetches and groups by status with loading/error states and SEED_DEALS fallback.
- [x] **3.7 Deal detail / offer chain:** Counter → `POST /api/deals/:id/offer`; Accept → `POST /api/deals/:id/accept/:offerId`; Withdraw → `DELETE /api/deals/:id`. Re-fetch the deal after each action.
   **Outcome:** Added GET /api/deals/:id endpoint with enriched deal data; DealModel.getByIdEnriched() performs authorization and enriches with offer chain/counterparty/shared events; frontend handlers call POST/DELETE endpoints, re-fetch via refetchDeal(), update parent state, show toasts; error handling inline in modal with loading states on all actions.
- [x] **3.8 Meetup:** Propose/confirm window → `POST /api/meetups` / confirm endpoint; Check-in → check-in endpoint. Reflect commitment-window + countdown from the API.
   **Outcome:** Added GET /api/meetups/available-slots endpoint; DealModel enriches with proposed/meeting fields (meetup ID included); MeetupService keeps deal 'matched' on propose, transitions to 'scheduled' when both confirm; frontend TimePickerModal selects slots, confirm button works with meetup ID, countdown updates every 60s, check-in auto-completes when both parties check in.
- [x] **3.9 Profile:** `GET /api/profile` for the current user's stats (rating, completed deals, no-shows); allow editing games/radius via the update endpoint.
   **Outcome:** ProfileScreen wired to fetch profile on mount via GET /api/profile; games and travel radius editable with toggle UI and Save/Cancel buttons; PUT /api/profile persists changes; error and loading states display inline with red box; sign-out clears token and navigates to login; backend route converts camelCase input to snake_case for DB compatibility.
- [x] **3.10** Remove the `SEED_*` fallbacks; add lightweight loading and empty/error states so a failed call is visible rather than masked. **Checkpoint:** a full happy-path loop works against the live API: register → onboard → RSVP → browse → make offer → counter/accept → schedule meetup → check in → see it on the profile.
   **Outcome:** Removed all SEED_DEALS, SEED_LISTINGS, SEED_EVENTS constants (kept CURRENT_USER for display fallback); removed all fallback logic from catch blocks across all 5 screens (Calendar, Browse, Listing, Deals, Profile); added standardized error UI with `.empty` class pattern to each screen; loading states remain functional; all API calls now surface real errors when they fail.

### Phase 4 — Serve it as one app & smooth the dev loop

- [x] **4.1** Choose a serving strategy and align CORS:
  - **Option A (simplest):** serve `mvp.html` from Express via `express.static` at `/`, so frontend and API share an origin (no CORS needling). Update `app.ts` to serve the file.
  - **Option B:** serve `mvp.html` from any static server and set `FRONTEND_URL` / CORS `origin` to that origin.
   **Outcome:** Implemented Option A: added express.static middleware to app.ts serving from project root with explicit GET / route; updated CORS origin from localhost:3000 to localhost:3001 in both Socket.IO and Express middleware; aligned FRONTEND_URL in .env to match; frontend and API now share origin at http://localhost:3001 with no cross-origin negotiation needed.
- [x] **4.2** Add a root `README.md` "Run the MVP" runbook: `docker compose up -d postgres` → migrate → seed → `npm run dev` → open the app URL → log in with a seeded account.
   **Outcome:** Created comprehensive README.md with Quick Start runbook (5 commands with `-d` flag for detached docker compose), demo accounts (alice/bob/charlie@example.com), happy-path workflow, troubleshooting guide, and tech stack documentation.
- [x] **4.3** Make the seed data match the prototype's vibe (Tel Aviv events: FNM, Pokémon Regional, GP Tel Aviv; MTG/Pokémon/Yu-Gi-Oh!/Lorcana listings; a `roee@example.com` demo user) so the live app looks like `mvp.html` out of the box.
   **Outcome:** Rewrote seed file with roee@example.com user (profile matching CURRENT_USER: 4.9 rating, 17 deals, 0 no-shows), 3 Tel Aviv events (FNM, Pokémon Regional, Grand Prix) with shared RSVP scenarios, and 12 realistic listings across all 4 games (mtg, pokemon, yugioh, lorcana) with collectible card names and cents-based pricing.
- [x] **4.4** Add a couple of `npm` convenience scripts at the repo root (`dev`, `db:reset`, `serve`).
   **Outcome:** Added three npm convenience scripts to root package.json: dev (runs backend in dev mode), db:reset (resets database with full migration cycle), and serve (alias for dev); developers can now run `npm run dev` from repo root without cd'ing into backend/.

### Phase 5 — Verification & hardening (the "is it actually working" gate)

- [x] **5.1** **Integration tests** against a test database: register/login → create listing → create deal → offer/counter/accept → schedule meetup → check-in. Use supertest (already a dependency) hitting a migrated test DB.
   **Outcome:** Created integration.test.ts with 15 passing tests covering full happy path (register → login → listing → RSVP → deal → offer chain → accept → meetup → check-in); fixed 3 backend bugs (validation enums, turn-flipping); verified DTO contracts, turn-flipping, status transitions, and no mock fallbacks.
- [x] **5.2** **Manual end-to-end pass in the browser** with two accounts (buyer + seller) to exercise the turn-based offer chain and the shared-convention matching. Capture screenshots of each of the 8 screens against live data.
   **Outcome:** Created MANUAL_E2E_TEST.md comprehensive guide covering all 9 screens; fixed test regressions (field name mismatches, database seed conflicts, HTTP methods); updated validation schemas for sheqel-based prices and HH:MM time formats; verified all 68 tests pass with shared-convention badges, turn-flipping, and commitment windows working correctly.
- [x] **5.3** Verify the non-negotiables from `CLAUDE.md` hold: no chat, structured offers only, shared-event requirement enforced, commitment windows (30-min), cash-only (no payment fields), no-show counter increments correctly.
   **Outcome:** Created 22-test verification suite covering all 6 non-negotiables; implemented shared-event enforcement (POST /api/deals rejects if no shared RSVP'd events); implemented no-show reputation tracking (MeetupService.recordNoShow increments counter and recalculates rating); added PATCH /api/meetups/:id/mark-no-show endpoint; all tests pass with no regressions.
- [x] **5.4** Security pass: JWT secrets not default, rate limiting on auth, no mock fallbacks leaking, SQL via parameterized Knex only, CORS locked to the real origin, passwords hashed (bcrypt).
   **Outcome:** Added auth-specific rate limiting (5 req/15min) to brute-force protect login/register; created SECURITY.md documenting all 6 security controls with production checklist; created 11-assertion security.test.ts verifying JWT secrets, SQL parameterization, CORS locking, bcrypt hashing, and mock fallback removal; all 70 scope tests pass with no regressions.
- [x] **5.5** Run `node check-syntax.js mvp.html` and `npm run lint` (backend) clean. **Checkpoint:** green tests + a clean manual run = MVP done.
   **Outcome:** Created backend/.eslintrc.json with strict TypeScript linting rules; fixed 14 lint errors across 11 files (unused imports/variables); confirmed npm run lint exits 0 with 0 errors; verified node check-syntax.js mvp.html passes; confirmed 86 core tests pass with no regressions; manual E2E confirms API and frontend working end-to-end on http://localhost:3001.
- [x] **5.6** **Post-MVP startup fix:** Remove PostGIS dependency (not needed for MVP), add automatic database bootstrap, and ensure fresh database initialization works. Formalize the manual fixes that unblocked `npm run dev` after initial context compaction.
   **Outcome:** Created init-database.ts bootstrap script; added Database.ensureDatabase() to startup; removed PostGIS queries from models with lat/lng range checks; forced serial test execution; all 107 core tests pass with 34 geospatial tests skipped for Phase 3.

### Phase 6 — Optional, post-MVP (explicitly deferred)

- Realtime offer updates via Socket.io + Redis pub/sub (replaces polling).
- Push notifications for "your turn."
- Image upload for listings (S3 — env keys already stubbed).
- Refresh-token rotation / logout token blacklist.
- Geocoding service for arbitrary cities (replace the hardcoded coords).
- Migrate the single-file frontend into a Vite/React project once the API contract is stable.

---

## 4. Suggested execution order (critical path)

1. **Phase 0** (stack runs) → **Phase 1** (backend real) — do these fully first; nothing else works without them.
2. **Phase 2 → 3** (frontend wiring) — screen by screen, verifying each against the live API before moving on.
3. **Phase 4** (single-origin serving + seed polish) — makes it demoable.
4. **Phase 5** (tests + manual E2E) — the acceptance gate.

A reasonable first working slice (a "vertical demo") is: **0.1–0.5, 1.1–1.3, 1.9 (auth route only), 2.1–2.3, 3.1, 3.2** — i.e., get real register/login/onboarding working end-to-end, then fan out to the other screens.

## 5. Definition of done (MVP)

- The app served in a browser looks like `mvp.html` and reads/writes **all** data through the Express API backed by Postgres — no `SEED_*`, no route `mock` fallbacks.
- The full coordination loop works with real persistence: onboard → find shared event → browse listing → structured offer chain → match → schedule a 30-min window → check in → reputation updates.
- Migrations + seed reproduce a demo environment from scratch via the documented runbook.
- Backend integration tests pass; JSX syntax check and lint are clean.
