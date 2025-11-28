# Fix Webapp Root Directory and Builder

## Root Directory Setting

You have two options:
- `webapp/` (with trailing slash) ✅ **USE THIS ONE**
- `/webapp` (with leading slash)

**Choose: `webapp/`** (with trailing slash)

This tells Railway to use the `webapp/` directory as the root for this service.

## Complete Fix Steps

### Step 1: Set Root Directory
1. **In Railway Dashboard** → **webapp service** → **Settings** → **Source** section
2. **Root Directory**: Select `webapp/` (with trailing slash)
3. **Save**

### Step 2: Change Builder to Dockerfile
1. **Go to "Build" section**
2. **Builder**: Change from "Railpack" to **"Dockerfile"**
3. **Dockerfile Path**: Should be `Dockerfile` (Railway will look for `webapp/Dockerfile`)
4. **Save**

### Step 3: Clear Custom Build Command
1. **In "Build" section**
2. **Custom Build Command**: **Delete/clear** the text: `cd backend && npm ci && npx prisma generate && npm run build`
3. **Leave it empty**
4. **Save**

### Step 4: Clear Custom Start Command
1. **Go to "Deploy" section**
2. **Custom Start Command**: **Delete/clear** the text: `cd backend && npm start`
3. **Leave it empty**
4. **Save**

### Step 5: Redeploy
1. **Go to "Deployments" tab**
2. **Click "Redeploy"** on the latest deployment
3. **Or Railway will auto-redeploy** after saving

## Why `webapp/` Works

When Root Directory is `webapp/`:
- Railway looks for files relative to `webapp/` directory
- `Dockerfile` at `webapp/Dockerfile` will be found
- `package.json` at `webapp/package.json` will be found
- All paths are relative to the `webapp/` folder

## After Fixing

Check the build logs - you should see:
- ✅ Building with Dockerfile (not Railpack)
- ✅ `next build` messages
- ✅ `next start` messages
- ❌ NO `backend@1.0.0` messages
- ❌ NO `cd backend` commands

## Summary

**Settings to change:**
1. Root Directory: `webapp/` ✅
2. Builder: `Dockerfile` ✅
3. Custom Build Command: **Empty** ✅
4. Custom Start Command: **Empty** ✅

After making these 4 changes, the webapp will deploy correctly!


