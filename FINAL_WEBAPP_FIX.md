# Final Fix for Webapp Service

## The Problem

Railway is still using RAILPACK and detecting the workspace at root, causing it to build backend instead of webapp, even though:
- ✅ `webapp/railway.json` is set to use Dockerfile
- ✅ Dockerfile exists and is correct
- ✅ Root directory should be `webapp/`

## Solution: Force Railway to Use Dockerfile

The issue is that Railway's RAILPACK auto-detection is overriding the railway.json settings. Here's how to fix it:

### Option 1: Set Root Directory in Railway Dashboard (RECOMMENDED)

1. **Go to Railway Dashboard** → **webapp service** → **Settings**
2. **Find "Root Directory"** section
3. **Change from `/` to `webapp`**
4. **Save**

This will force Railway to:
- Only look in the `webapp/` directory
- Use `webapp/railway.json` (which specifies Dockerfile)
- Build the Next.js app, not the backend

### Option 2: Disable RAILPACK in Railway Dashboard

1. **Go to Railway Dashboard** → **webapp service** → **Settings**
2. **Find "Builder" section**
3. **Change from "Railpack" to "Dockerfile"**
4. **Make sure Dockerfile path is: `Dockerfile`** (relative to webapp root)
5. **Save**

### Option 3: Create .railwayignore or Update Root Directory

If Railway is still detecting the workspace:

1. **In Railway Dashboard** → **webapp service** → **Settings**
2. **Root Directory**: Must be `webapp` (not `/`)
3. **Build Command**: Leave empty (let Dockerfile handle it)
4. **Start Command**: Leave empty (let Dockerfile handle it)

## Verify Configuration

After making changes, the Settings should show:
- ✅ **Root Directory**: `webapp`
- ✅ **Builder**: `Dockerfile` (not Railpack)
- ✅ **Dockerfile Path**: `Dockerfile`

## After Fixing

1. **Redeploy** the service
2. **Check logs** - you should see:
   - ✅ `next build` messages
   - ✅ `next start` messages
   - ❌ NO `backend@1.0.0` messages
   - ❌ NO `cd backend` commands

## Current Status

- ✅ `webapp/railway.json` configured to use Dockerfile
- ✅ `webapp/Dockerfile` is correct
- ✅ `webapp/package.json` uses PORT env var
- ⚠️ **Root Directory in Railway Dashboard needs to be set to `webapp`**

## Next Steps

1. **Go to Railway Dashboard**
2. **Set Root Directory to `webapp`**
3. **Change Builder to Dockerfile** (if still showing Railpack)
4. **Redeploy**
5. **Access your site at**: `https://taskforce-webapp-production.up.railway.app`

