# Fix Webapp Service in Railway

## The Problem

Railway is using backend build/start commands instead of webapp commands:
- ❌ Build: `cd backend && npm ci && npx prisma generate && npm run build`
- ❌ Start: `cd backend && npm start`
- ❌ Root Directory: `/` (should be `webapp/`)

## The Fix

I've updated the `webapp/railway.json` file. Now you need to:

### Step 1: Update Root Directory in Railway

1. Go to Railway Dashboard → **webapp service** → **Settings**
2. Find **"Root Directory"** section
3. Change it from `/` to `webapp`
4. **Save**

### Step 2: Verify Build/Start Commands

After setting root directory to `webapp`, Railway should automatically use:
- ✅ Build: `npm ci && npm run build` (from webapp/railway.json)
- ✅ Start: `npm start` (from webapp/railway.json)

### Step 3: Redeploy

1. Go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Or push a commit to trigger auto-deploy

### Step 4: Set Environment Variables

In webapp service **Variables** tab, make sure you have:

- `NODE_ENV` = `production`
- `NEXT_PUBLIC_API_URL` = `https://taskforce-backend-production.up.railway.app`
- `PORT` = `3000` (or leave Railway to auto-assign)

### Step 5: Access Your Site

Once redeployed, access:
- ✅ **Webapp URL**: `https://taskforce-webapp-production.up.railway.app`
- ❌ **NOT Backend URL**: `https://taskforce-backend-production.up.railway.app`

## Why This Happened

Railway was detecting the root directory as `/` and finding a workspace with multiple packages (backend, webapp, extension). It defaulted to building the backend.

By setting Root Directory to `webapp`, Railway will:
1. Only look in the `webapp/` folder
2. Use the `webapp/railway.json` configuration
3. Build and start the Next.js app correctly

## After Fixing

Check the webapp logs - you should see:
- ✅ `next build` messages
- ✅ `next start` messages
- ✅ No `backend@1.0.0` messages
- ✅ No `node dist/server.js` messages

