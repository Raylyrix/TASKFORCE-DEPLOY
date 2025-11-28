# Step-by-Step Fix Guide

## Current Problem

The `DATABASE_URL` and `REDIS_URL` environment variables are showing as template variables (`${{...}}`) which means they're not properly connected/referenced from the database and Redis services.

## What You Need to Do

### Step 1: Check Railway Dashboard - Service Connections

1. **Go to Railway Dashboard**: https://railway.app
2. **Open your project** (patient-passion)
3. **Click on `taskforce-backend` service**
4. **Go to "Variables" tab**
5. **Look for `DATABASE_URL` and `REDIS_URL`**

### Step 2: Connect Database Service

**If DATABASE_URL shows template variables or is missing:**

1. **In the Variables tab**, click **"+ New Variable"** or **"Add Reference"**
2. **Click "Add Reference"**
3. **Select `taskforce-db` service** (or your PostgreSQL service name)
4. **Select `DATABASE_URL`** from the dropdown
5. **Save**

### Step 3: Connect Redis Service

**If REDIS_URL is missing:**

1. **Click "+ New Variable"** or **"Add Reference"**
2. **Click "Add Reference"**  
3. **Select `taskforce-redis` service** (or your Redis service name)
4. **Select `REDIS_URL`** from the dropdown
5. **Save**

### Step 4: Verify Variables

After connecting, the variables should look like:
- `DATABASE_URL` = `${{taskforce-db.DATABASE_URL}}` (or similar)
- `REDIS_URL` = `${{taskforce-redis.REDIS_URL}}` (or similar)

Railway will automatically resolve these to the actual connection strings.

### Step 5: Redeploy

After setting variables:
1. **Go to "Deployments" tab**
2. **Click "Redeploy"** on the latest deployment
3. **Or Railway will auto-redeploy** when you save variables

### Step 6: Run Migrations

After the service restarts with proper DATABASE_URL:

**Option A: Via Railway CLI (from your computer)**
```powershell
cd C:\Users\hp\Downloads\TASKFORCE-PRODUCTION-main\TASKFORCE-PRODUCTION-main\backend
railway run --service taskforce-backend npx prisma migrate deploy
```

**Option B: They should run automatically** - The Dockerfile CMD includes migrations, so they should run when the container starts.

## After You Do This

Once you've connected the DATABASE_URL and REDIS_URL, let me know and I'll:
1. Check if migrations run automatically
2. Verify the backend is working
3. Help deploy the webapp service

## Quick Check Commands

Run these to verify:

```powershell
# Check if variables are set
railway variables --service taskforce-backend | Select-String -Pattern "DATABASE_URL|REDIS_URL"

# Check service status  
railway status

# Check logs after redeploy
railway logs --service taskforce-backend --lines 50
```

