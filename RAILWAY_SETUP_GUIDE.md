# 🚂 Railway.app Setup Guide for TaskForce

## Complete Step-by-Step Guide to Deploy TaskForce for FREE on Railway

---

## 📋 Prerequisites

- GitHub account with TaskForce repository
- Google Cloud Console account (for OAuth)
- 15-20 minutes

---

## Step 1: Sign Up for Railway

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Sign up with **GitHub** (recommended)
4. Authorize Railway to access your repositories

---

## Step 2: Create New Project

1. Click **"New Project"** (top right)
2. Select **"Deploy from GitHub repo"**
3. Choose your **TaskForce repository**
4. Railway will create a new project

---

## Step 3: Add PostgreSQL Database

1. In your Railway project, click **"New"** button
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will create a PostgreSQL instance
4. **IMPORTANT:** Copy the **Connection URL** (you'll need it)
   - It looks like: `postgresql://postgres:password@hostname:5432/railway`
5. The database is now ready!

---

## Step 4: Add Redis Cache

1. Click **"New"** button again
2. Select **"Database"** → **"Add Redis"**
3. Railway will create a Redis instance
4. **IMPORTANT:** Copy the **Connection URL** (you'll need it)
   - It looks like: `redis://default:password@hostname:6379`
5. Redis is now ready!

---

## Step 5: Deploy Backend Service

1. Click **"New"** button
2. Select **"GitHub Repo"** → Choose your TaskForce repo
3. Railway will detect the `backend/` folder
4. Click on the service to configure it

### Configure Backend:

**Settings Tab:**
- **Root Directory:** `backend` (should auto-detect)
- **Build Command:** `npm ci && npx prisma generate && npm run build`
- **Start Command:** `npm start`

**Variables Tab - Add these environment variables:**

```env
NODE_ENV=production
PORT=3000

# Database (connect from PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}
# Or manually: postgresql://postgres:password@hostname:5432/railway

# Redis (connect from Redis service)
REDIS_URL=${{Redis.REDIS_URL}}
# Or manually: redis://default:password@hostname:6379

# Backend Public URL (Railway provides this)
BACKEND_PUBLIC_URL=${{RAILWAY_PUBLIC_DOMAIN}}
# Or set manually after deployment: https://your-backend.railway.app

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-backend.railway.app/api/auth/google/callback

# Session Secret (generate a random string)
SESSION_SECRET=generate-a-random-secret-key-here

# Optional: Google Extension IDs (if you have Chrome extension)
GOOGLE_EXTENSION_IDS=your-extension-id
```

**How to connect services:**
- In Variables tab, click **"Add Reference"**
- Select **Postgres** → **DATABASE_URL**
- Select **Redis** → **REDIS_URL**

### Deploy Backend:

1. Railway will automatically:
   - Install dependencies
   - Build the project
   - Run Prisma migrations
   - Start the server

2. Wait for deployment to complete (2-3 minutes)

3. **Copy the public URL** (e.g., `https://taskforce-backend.railway.app`)

4. **Run database migrations:**
   - Go to Backend service → **"Deployments"** tab
   - Click on latest deployment → **"View Logs"**
   - Or add to build command: `&& npx prisma migrate deploy`

---

## Step 6: Deploy Frontend Service

1. Click **"New"** button
2. Select **"GitHub Repo"** → Choose your TaskForce repo (same repo)
3. Railway will detect the `webapp/` folder
4. Click on the service to configure it

### Configure Frontend:

**Settings Tab:**
- **Root Directory:** `webapp` (should auto-detect)
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm start -p ${PORT:-3000}`

**Variables Tab - Add these environment variables:**

```env
NODE_ENV=production
PORT=3000

# Backend API URL (use your backend service URL)
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
# Or use service reference: ${{Backend.RAILWAY_PUBLIC_DOMAIN}}

# Google OAuth Client ID (same as backend)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

**How to connect to backend:**
- In Variables tab, click **"Add Reference"**
- Select **Backend** → **RAILWAY_PUBLIC_DOMAIN**
- Or manually set: `NEXT_PUBLIC_API_URL=https://your-backend.railway.app`

### Deploy Frontend:

1. Railway will automatically:
   - Install dependencies
   - Build Next.js app
   - Start the server

2. Wait for deployment to complete (3-5 minutes)

3. **Copy the public URL** (e.g., `https://taskforce-webapp.railway.app`)

---

## Step 7: Update Google OAuth Settings

1. Go to **Google Cloud Console**: https://console.cloud.google.com
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Add **Authorized redirect URIs:**
   ```
   https://your-backend.railway.app/api/auth/google/callback
   ```
5. Add **Authorized JavaScript origins:**
   ```
   https://your-backend.railway.app
   https://your-frontend.railway.app
   ```
6. **Save** changes

---

## Step 8: Verify Everything Works

1. **Check Backend Health:**
   - Visit: `https://your-backend.railway.app/health`
   - Should return: `{"status":"ok",...}`

2. **Check Frontend:**
   - Visit: `https://your-frontend.railway.app`
   - Should load the login page

3. **Test Login:**
   - Try logging in with Google
   - Should redirect and authenticate

4. **Check Logs:**
   - Go to each service → **"Deployments"** → **"View Logs"**
   - Look for any errors

---

## Step 9: Run Database Migrations

If migrations didn't run automatically:

1. Go to **Backend service** → **"Deployments"** tab
2. Click **"Redeploy"** (or add to build command)
3. Or use Railway's **"Shell"** feature:
   - Go to Backend service → **"Settings"** → **"Shell"**
   - Run: `cd backend && npx prisma migrate deploy`

---

## 🎉 You're Done!

Your TaskForce app is now live on Railway for **FREE**!

**Your URLs:**
- Backend: `https://your-backend.railway.app`
- Frontend: `https://your-frontend.railway.app`
- Database: Managed by Railway
- Redis: Managed by Railway

---

## 📊 Cost Breakdown

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Backend | Free (within $5 credit) | $0 ✅ |
| Frontend | Free (within $5 credit) | $0 ✅ |
| PostgreSQL | Free (within $5 credit) | $0 ✅ |
| Redis | Free (within $5 credit) | $0 ✅ |
| **Total** | | **$0/month** ✅ |

**Railway gives you $5 free credit monthly** - enough for small-medium apps!

---

## 🔧 Troubleshooting

### Backend won't start:
- Check logs in **Deployments** tab
- Verify all environment variables are set
- Ensure `DATABASE_URL` and `REDIS_URL` are connected

### Frontend can't reach backend:
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check backend is running (visit `/health` endpoint)
- Ensure CORS is configured in backend

### Database connection errors:
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running
- Run migrations: `npx prisma migrate deploy`

### OAuth not working:
- Verify redirect URI matches Google Console
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Ensure `BACKEND_PUBLIC_URL` is set

---

## 🚀 Next Steps

1. **Custom Domain** (optional):
   - Go to service → **Settings** → **Networking**
   - Add your custom domain
   - Railway provides free SSL

2. **Monitor Usage:**
   - Check **Usage** tab in Railway dashboard
   - Stay within $5 free credit

3. **Upgrade if Needed:**
   - If you exceed $5 credit, upgrade to paid plan
   - Or optimize resource usage

---

## 📚 Resources

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app

---

**Congratulations! Your app is now live for FREE! 🎉**



