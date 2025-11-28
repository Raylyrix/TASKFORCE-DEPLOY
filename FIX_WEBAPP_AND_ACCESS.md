# Fix Webapp Deployment and Access Your Site

## Issues Found

1. **Webapp is running backend code** - The webapp service logs show it's running `backend@1.0.0 start` instead of the Next.js app
2. **Missing `threadId` column** - The ScheduledEmail table is missing the threadId column
3. **Wrong URL** - You're accessing the backend URL instead of the webapp URL

## Fix 1: Add Missing threadId Column

A migration has been created. After redeploying the backend, this will be automatically applied.

## Fix 2: Check Webapp Service Configuration

The webapp service needs to be configured correctly. Here's what to check:

### In Railway Dashboard:

1. **Go to your project** → **webapp service** (or taskforce-webapp)
2. **Check Settings**:
   - **Root Directory**: Should be `webapp` (not `backend`)
   - **Build Command**: Should be `npm ci && npm run build`
   - **Start Command**: Should be `npm start` (or `next start -p ${PORT:-3000}`)

3. **Check Variables**:
   - `NODE_ENV` = `production`
   - `NEXT_PUBLIC_API_URL` = Your backend URL (e.g., `https://taskforce-backend-production.up.railway.app`)

## Fix 3: Find Your Webapp URL

1. **In Railway Dashboard**:
   - Go to your project
   - Click on the **webapp service** (not backend)
   - Go to **Settings** tab
   - Look for **"Generate Domain"** button
   - Click it to generate a public URL
   - The URL will be something like: `taskforce-webapp-production.up.railway.app`

2. **Or check the Deployments tab**:
   - Click on the latest deployment
   - The URL should be shown there

## Quick Fix Steps

### Step 1: Fix Webapp Service Root Directory

1. Go to Railway Dashboard
2. Click on **webapp service** (or create it if it doesn't exist)
3. Go to **Settings**
4. Set **Root Directory** to: `webapp`
5. Save

### Step 2: Set Webapp Environment Variables

In the webapp service Variables tab, add:

- `NODE_ENV` = `production`
- `NEXT_PUBLIC_API_URL` = `https://taskforce-backend-production.up.railway.app` (your backend URL)
- `PORT` = `3000` (or leave Railway to auto-assign)

### Step 3: Redeploy Backend (to apply threadId migration)

The backend will automatically apply the new migration on next deploy.

### Step 4: Access Your Site

Use the **webapp URL**, not the backend URL:
- ✅ Correct: `https://taskforce-webapp-production.up.railway.app`
- ❌ Wrong: `https://taskforce-backend-production.up.railway.app` (this is the API)

## Verify Webapp is Running Correctly

After fixing, check the webapp logs. You should see:
- ✅ `next start` or `Next.js` messages
- ✅ No `backend@1.0.0` messages
- ✅ No `node dist/server.js` messages

## Summary

- **Backend URL**: `https://taskforce-backend-production.up.railway.app` (API only)
- **Webapp URL**: `https://taskforce-webapp-production.up.railway.app` (Your actual website)
- **Webapp Root**: Must be `webapp` directory
- **Webapp Start**: Should run `npm start` (Next.js)


