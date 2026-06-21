# CardMeet Deployment Guide — Railway

This guide walks you through deploying CardMeet to Railway with a managed PostgreSQL database.

## Prerequisites

- [GitHub account](https://github.com) with CardMeet repo access
- [Railway account](https://railway.app) (free, no credit card needed)
- Terminal access to run `openssl` commands locally

---

## Step 1: Commit Code Changes

First, commit all the code changes (mvp.html, package.json, knexfile.ts, init-database.ts):

```bash
cd /Users/roee.ashkenazi/Desktop/CardMeet

# Configure git author
git config user.email "roee1160@gmail.com"
git config user.name "roeeash"

# Commit all changes
git add .
git commit -m "fix: prepare for production deployment (Railway)"

# Push to GitHub
git push origin main
```

Verify the push succeeded by checking https://github.com/roeeash/CardMeet (replace with your username).

---

## Step 2: Create Railway Account & Project

### 2.1 — Sign up for Railway
1. Go to **https://railway.app**
2. Click **Sign up with GitHub**
3. Authorize Railway to access your GitHub account
4. Accept the terms

### 2.2 — Create a new project
1. In the Railway dashboard, click **New Project**
2. Select **Deploy from GitHub repo**
3. Find and select the `CardMeet` repository
4. Select the `main` branch
5. Click **Deploy**

Railway auto-detects Node.js and starts building. The build will fail at this stage (missing database), which is expected. You'll see it crash during `npm run db:migrate` because Postgres isn't connected yet.

---

## Step 3: Add PostgreSQL Service

### 3.1 — Create Postgres service
1. Back in your Railway project dashboard, click **+ New**
2. Select **Database → PostgreSQL**
3. Wait for Postgres to initialize (~1 minute)

Railway automatically:
- Creates a PostgreSQL instance
- Injects `DATABASE_URL` into your Node.js service environment
- Wires up networking between services

### 3.2 — Verify connection
Click the **Postgres** service tile → **Variables** tab. You should see `DATABASE_URL` present (masked). This is automatically shared with your Node.js service.

---

## Step 4: Generate & Set JWT Secrets

### 4.1 — Generate secrets locally
In your terminal, run:

```bash
# Generate JWT_SECRET
openssl rand -base64 43

# Generate JWT_REFRESH_SECRET
openssl rand -base64 43
```

Copy both outputs. Each will be ~56 characters, like: `xB7k+Q2wL9m...`

### 4.2 — Add secrets to Railway
1. In Railway dashboard, click the **Node.js** service (not Postgres)
2. Go to the **Variables** tab
3. Add three variables:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(paste first openssl output)* |
| `JWT_REFRESH_SECRET` | *(paste second openssl output)* |

4. Click **Deploy** to apply changes

Railway automatically redeploys your app.

---

## Step 5: Verify Deployment

### 5.1 — Check build status
1. Click the **Node.js** service
2. Go to **Deployments** tab
3. Wait for the latest deploy to show ✅ **Success**

Logs should show:
```
[Database Bootstrap] Database bootstrap completed successfully
[Database] Seeding demo data...
CardMeet server listening on http://localhost:PORT
```

### 5.2 — Get your live URL
1. Click the **Node.js** service
2. In the top bar, you'll see a URL like: `https://cardmeet-production-abc123.up.railway.app`
3. Copy this URL

### 5.3 — Test the app
1. Open your URL in a browser
2. You should see the CardMeet login screen
3. Try logging in with:
   - **Email:** `roee@example.com`
   - **Password:** `password123`

If the login works and you see listings, deployment succeeded! 🎉

---

## Step 6: Set Frontend URL (Post-Deploy)

Once your app is live, you need to tell the backend its own URL for CORS and Socket.io:

### 6.1 — Update FRONTEND_URL variable
1. Click the **Node.js** service
2. Go to **Variables** tab
3. Add:

| Key | Value |
|---|---|
| `FRONTEND_URL` | *(your Railway URL from Step 5.2)* |

Example: `https://cardmeet-production-abc123.up.railway.app`

4. Click **Deploy**

Railway redeploys and now CORS/Socket.io will accept requests from your live domain.

---

## Step 7: Seed Demo Data (One-time)

If demo data isn't auto-seeded during migration, manually seed it:

### 7.1 — Open Railway shell
1. Click the **Node.js** service
2. Go to **Shell** tab
3. Run:
   ```bash
   cd backend && npm run db:seed
   ```

You should see:
```
Seeding complete: 1 demo user + 12 listings
```

---

## Verification Checklist

Before calling deployment done:

- [ ] App URL responds with login page (no white screen)
- [ ] Login with `roee@example.com` / `password123` succeeds
- [ ] Browse Listings page loads data
- [ ] Create Offer flow submits without 400 errors
- [ ] Browser DevTools → Network tab shows no `localhost` requests (all relative URLs)
- [ ] `https://<your-url>/health` returns `{"status":"OK"}`

---

## Automatic Deployments

From now on, **every push to `main`** automatically triggers a new deployment:

1. Railway detects the push
2. Pulls latest code
3. Runs `npm ci && npm run build`
4. Runs `npm run db:migrate` (release command)
5. Restarts the server with `npm start`

If you need to roll back, go to **Deployments** tab and click **Redeploy** on a previous green checkmark.

---

## Troubleshooting

### Build fails with "Cannot find module @scripts/init-database"
This means TypeScript compilation failed. Check the build logs in **Deployments** → click the failed deploy → scroll to errors. Usually means a path alias is misconfigured or file doesn't exist.

### App crashes after deploy with "Too many login/register attempts"
This means the rate limiter is returning raw text instead of JSON. Ensure `backend/src/app.ts` line 50-52 has the `handler` that returns `res.json()`.

### Login page loads but login fails with 500 error
Check the server logs: click **Node.js** service → **Logs** tab. Common causes:
- `JWT_SECRET` or `JWT_REFRESH_SECRET` not set
- Database migration didn't run (check Postgres is connected)

### No listings appear after login
Database migrations may not have run. In Railway shell:
```bash
cd backend && npm run db:migrate
cd backend && npm run db:seed
```

Then refresh the browser.

---

## Cost

Railway's free tier includes:
- **$5/month credit** (always)
- Pay-as-you-go after credit is used
- Node.js: ~$0.001 per container-hour
- PostgreSQL: ~$0.000042 per MB-hour

For an MVP with light traffic, you'll stay well under the $5 free credit.

---

## Next Steps (Future Phases)

- **Phase 2:** Add user ratings/reviews
- **Phase 3:** Event discovery with PostGIS geospatial matching
- **Phase 4:** Push notifications with Socket.io
- **Phase 5:** Image uploads to S3

For now, the core coordination loop is live. 🚀
