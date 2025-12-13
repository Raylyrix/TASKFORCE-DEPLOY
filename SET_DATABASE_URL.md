# ⚠️ CRITICAL: Set DATABASE_URL for wallet-backend

## Problem
The wallet-backend service is failing to start because `DATABASE_URL` is not set.

## Solution

### Option 1: Set via Railway Dashboard (Recommended)
1. Go to Railway dashboard
2. Select **wallet-backend** service
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Name: `DATABASE_URL`
6. Value: Get from **wallet-db** service:
   - Go to **wallet-db** service
   - Go to **Variables** tab
   - Look for `POSTGRES_URL` or `DATABASE_URL`
   - Copy the value
   - Format: `postgresql://user:password@host:port/database`
7. Save

### Option 2: Railway Auto-Injection
Railway should automatically inject `DATABASE_URL` when services are linked. If it's not showing up:
- Check if wallet-db and wallet-backend are in the same project
- Try redeploying wallet-backend after setting up wallet-db

### Option 3: Manual Connection String
If you know the database credentials:
```
postgresql://postgres:password@wallet-db.railway.internal:5432/railway
```

## After Setting DATABASE_URL
1. Railway will automatically redeploy wallet-backend
2. Check logs: `railway logs --service wallet-backend`
3. Verify health: `https://wallet-backend-production-5ded.up.railway.app/health`

## Current Status
- ❌ DATABASE_URL: **NOT SET** (empty)
- ✅ Other variables: Set correctly

