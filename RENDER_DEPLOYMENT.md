# CardMeet Deployment Guide — Render.com

This guide walks you through deploying CardMeet to Render with a free managed PostgreSQL database.

## Key Differences from Railway

- **Free tier:** Web service + PostgreSQL both free (databases hibernate after 90 days inactivity)
- **No credit card needed** for free tier
- **Auto-deploys** on push to `main`
- **Environment variables:** Set via Render dashboard (no .env file needed)

---

## Step 1: Verify Code is Pushed to GitHub

Ensure your latest code is on GitHub's `main` branch:

```bash
git log --oneline -1
# Should show: fix: prepare for production deployment (Railway)

git push origin main
# If already pushed, shows: Everything up-to-date
```

Check: https://github.com/roeeash/CardMeet → should show the latest commit.

---

## Step 2: Create Render Account

### 2.1 — Sign up
1. Go to **https://render.com**
2. Click **Sign up**
3. Choose **Sign up with GitHub** (easiest)
4. Authorize Render to access your GitHub account
5. Confirm your email

### 2.2 — Dashboard
You're now in the Render dashboard. Click **New +** to start.

---

## Step 3: Create PostgreSQL Database (Free)

### 3.1 — Create database service
1. Click **New +** → **PostgreSQL**
2. Fill in:
   - **Name:** `cardmeet-postgres` (or any name)
   - **Database:** `cardmeet_prod` (matches our knexfile)
   - **User:** `postgres` (default)
   - **Region:** Choose nearest to you (e.g., `Ohio` for US)
   - **PostgreSQL Version:** `15` (latest stable)
3. Click **Create Database**

Render creates the Postgres instance (~2 minutes). You'll see a green "Available" status when done.

### 3.2 — Copy connection string
Once available:
1. Click the **cardmeet-postgres** service
2. Go to **Connections** section
3. Copy the **External Database URL** (looks like: `postgresql://user:pass@hostname:5432/cardmeet_prod`)
4. Save it in a notepad — you'll need it in Step 4

---

## Step 4: Create Node.js Web Service

### 4.1 — Connect GitHub repo
1. Back in Render dashboard, click **New +** → **Web Service**
2. Select **Deploy from GitHub repo**
3. Find and select `roeeash/CardMeet`
4. Click **Connect**

### 4.2 — Configure deployment
Fill in the form:

| Field | Value |
|---|---|
| **Name** | `cardmeet` |
| **Environment** | `Node` |
| **Region** | Same as Postgres (e.g., `Ohio`) |
| **Branch** | `main` |
| **Build Command** | `cd backend && npm ci && npm run build` |
| **Start Command** | `cd backend && npm start` |

### 4.3 — Choose plan
- Select **Free** plan (stays free for 750 hours/month)

### 4.4 — Advanced settings (expand)
1. Click **Advanced** to expand
2. Under **Auto-Deploy**, choose **Yes** (auto-redeploy on push to main)

### 4.5 — Create service
Click **Create Web Service**

Render starts building (~3–5 minutes). You'll see build logs streaming in real-time.

---

## Step 5: Add Environment Variables

### 5.1 — Wait for initial build to fail
The first build will fail because we haven't set database connection yet. This is expected. Wait for the build to show a red ✗.

### 5.2 — Add environment variables
1. Click your **cardmeet** web service
2. Go to **Environment** tab
3. Add the following variables:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *(paste from Step 3.2)* |
| `JWT_SECRET` | *(generate below)* |
| `JWT_REFRESH_SECRET` | *(generate below)* |

### 5.3 — Generate JWT secrets
In your terminal, run:
```bash
openssl rand -base64 43
openssl rand -base64 43
```

Copy each output and paste into the corresponding environment variable field in Render.

### 5.4 — Save and redeploy
Click **Save** at the bottom. Render automatically redeploys with new environment variables.

---

## Step 6: Run Database Migrations

### 6.1 — Wait for deploy to succeed
Watch the **Logs** tab until you see:
```
CardMeet server listening on http://localhost:PORT
```

This means the app is running (migrations have succeeded).

### 6.2 — Verify in logs
Check that you see:
```
[Database Bootstrap] Database bootstrap completed successfully
Database migrations completed
[seed] Seeding complete
CardMeet server listening on...
```

If you see these lines, migrations ran successfully! ✅

---

## Step 7: Get Your Live URL

### 7.1 — Find the URL
1. Click your **cardmeet** web service
2. At the top, you'll see a URL like: `https://cardmeet-production-abc123.onrender.com`
3. Copy this URL

### 7.2 — Update FRONTEND_URL
Add one more environment variable:

| Key | Value |
|---|---|
| `FRONTEND_URL` | *(paste your URL from above)* |

Click **Save** — Render redeploys.

### 7.3 — Test the app
1. Open your URL in a browser
2. You should see the CardMeet login screen
3. Login with:
   - **Email:** `roee@example.com`
   - **Password:** `password123`

If you see listings after login, deployment succeeded! 🎉

---

## Step 8: Verify Everything

Open your live URL and check:

- [ ] Login page loads (no white screen)
- [ ] Login with `roee@example.com` / `password123` succeeds
- [ ] Browse Listings shows real data
- [ ] Create Offer flow submits
- [ ] `https://<your-url>/health` returns `{"status":"OK"}`
- [ ] Browser DevTools → Network tab shows no `localhost` requests

---

## Automatic Deployments

From now on, **every push to `main`** triggers an auto-deploy:

1. Render detects the push
2. Pulls latest code
3. Runs `cd backend && npm ci && npm run build`
4. Runs migrations (via release command in `railway.toml`)
5. Restarts server

To manually redeploy: click **cardmeet** service → **Deployments** tab → click **Redeploy** on any green checkmark.

---

## Free Tier Details

**What's included:**
- 750 compute hours/month (plenty for 1 service)
- 10 GB database storage (plenty for MVP)
- Auto-hibernation after 15 min of inactivity (wakes on next request, ~30 sec cold start)
- Databases never sleep

**What happens after 90 days:**
- Web service: stays awake, fully operational
- PostgreSQL database: hibernates if unused for 90+ days
  - Wakes immediately when accessed
  - No data loss, just ~30 sec startup time
  - **Prevention:** Keep the app running (even one request per week prevents hibernation)

---

## Troubleshooting

### Build fails with "Cannot find module @scripts/init-database"
TypeScript compilation error. Check **Logs** tab for detailed error message. Usually means:
- Path alias misconfigured in `tsconfig.json`
- Missing file in backend/src/scripts/

### App crashes after deploy with login error
Check **Logs** tab for the error. Common causes:
- `JWT_SECRET` or `JWT_REFRESH_SECRET` not set in Environment
- Database migrations didn't run (check Postgres connection)
- `DATABASE_URL` is incorrect (copy it again from Postgres service)

### Login page loads but login fails
1. Open **Logs** tab and scroll to errors
2. Check if `DATABASE_URL` is set
3. Try manually running migrations in a shell (see next section)

### Manual Migrations
If migrations didn't auto-run, trigger them manually:

1. Click **cardmeet** service
2. Go to **Shell** tab
3. Run:
   ```bash
   cd backend && npm run db:migrate
   cd backend && npm run db:seed
   ```

### No listings appear
Seed data may not have run. In the Shell:
```bash
cd backend && npm run db:seed
```

Then refresh your browser.

---

## Cost

**Free tier:** $0/month (unless you exceed limits)

**If you upgrade later:**
- Web service: $7/month (for always-awake tier, no hibernation)
- PostgreSQL: $12/month (for non-hibernating tier)

For MVP with light usage, free tier is sufficient indefinitely.

---

## Next Steps (Phases 2+)

- **Phase 2:** Add user ratings/reviews
- **Phase 3:** Event discovery with PostGIS geospatial
- **Phase 4:** Push notifications with Socket.io
- **Phase 5:** Image uploads to S3

For now, core coordination loop is live. 🚀
