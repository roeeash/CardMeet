# CardMeet

A coordination layer for in-person card-game sales that connects buyers and sellers attending the same conventions and events.

## Quick Start

Follow these 5 commands to get CardMeet running:

```bash
docker compose up -d postgres
cd backend
npm install
npm run db:reset
npm run dev
```

The backend will be running on `http://localhost:3001`.

## Database Setup

CardMeet uses **automatic database bootstrap** on server startup. When you run `npm run dev`:

1. The server checks if PostgreSQL is running
2. If the `cardmeet_dev` database doesn't exist, it creates it
3. If the `postgres` role doesn't exist, it creates it
4. Migrations are applied automatically
5. Seed data is loaded (demo accounts and sample events)

No manual `createdb` commands are needed. The `npm run db:reset` script also runs the bootstrap phase before migrations, ensuring a clean slate.

**Environment variables** for database bootstrap (defaults shown):
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_NAME=cardmeet_dev`
- `DB_USER=postgres`
- `DB_PASSWORD=password`

These match the Docker Compose PostgreSQL configuration by default.

## Browser

Open your browser to:

```
http://localhost:3001
```

The app will load the onboarding screen and guide you through the initial setup.

## Demo Accounts

Three seeded demo accounts are available after running `npm run db:seed`:

| Email | Password |
|-------|----------|
| alice@example.com | password123 |
| bob@example.com | password123 |
| charlie@example.com | password123 |

Log in with any of these accounts to explore CardMeet.

## Happy Path

End-to-end workflow:

1. **Login** — Use a demo account
2. **Onboard** — Set location, travel radius, and game preferences
3. **RSVP** — Browse calendar and commit to events
4. **Browse** — View listings with shared convention badges
5. **Offer** — Create a structured offer on a card listing
6. **Negotiate** — Accept/counter price through the offer chain
7. **Meetup** — Schedule a 30-minute commitment window at the shared event
8. **Check-In** — Confirm attendance at the scheduled time

## Troubleshooting

**PostgreSQL won't start:**
- Verify Docker is running: `docker --version`
- Check existing containers: `docker ps -a`
- Remove stale containers: `docker compose down && docker compose up postgres`

**API connection errors:**
- Ensure backend is running: `npm run dev` in `/backend`
- Check that port 3001 is available: `lsof -i :3001`
- Verify database migrations completed: Check backend logs for "migrations complete"

**Database reset:**
- Drop and reseed: `npm run db:seed` (clears tables and reloads demo data)
- Or reset from scratch: `docker compose down && docker compose up postgres`, then re-run migration and seed commands

## Tech Stack

- **Frontend:** React (single-file, Babel-in-browser)
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (PostGIS support deferred to Phase 3)
- **Authentication:** JWT (JSON Web Tokens) with bcrypt
- **Migrations:** Knex.js
- **Testing:** Jest + Supertest
- **API:** RESTful with structured offer negotiation

---

**Note:** Phase 2–6 features (reputation system, verification, scale features) are currently deferred. See `PLAN.md` for development roadmap.
