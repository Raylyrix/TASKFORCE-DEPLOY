# Fix Dockerfile Not Found Error

## The Problem

Railway is looking for the Dockerfile but can't find it. The error shows:
```
Dockerfile `Dockerfile` does not exist
```

## The Solution

Based on the Railway Dashboard screenshot, you need to make these changes:

### Step 1: Change Builder from Railpack to Dockerfile

1. **In Railway Dashboard** → **webapp service** → **Settings** → **Build** section
2. **Find "Builder"** dropdown
3. **Change from "Railpack" to "Dockerfile"**
4. **Dockerfile Path**: Should be `Dockerfile` (since root is `/webapp`, it will look for `webapp/Dockerfile`)

### Step 2: Remove Custom Build Command

1. **In the same Build section**
2. **Find "Custom Build Command"**
3. **Delete/clear the command**: `cd backend && npm ci && npx prisma generate && npm run build`
4. **Leave it empty** (Dockerfile will handle the build)

### Step 3: Remove Custom Start Command

1. **Go to "Deploy" section**
2. **Find "Custom Start Command"**
3. **Delete/clear the command**: `cd backend && npm start`
4. **Leave it empty** (Dockerfile CMD will handle the start)

### Step 4: Verify Root Directory

1. **In "Source" section**
2. **Root Directory** should be: `webapp` (not `/webapp`)
   - If it shows `/webapp`, change it to `webapp`
   - Railway will then look for `webapp/Dockerfile` relative to repo root

### Step 5: Save and Redeploy

1. **Save all changes**
2. **Railway will auto-redeploy**
3. **Or go to Deployments tab and click "Redeploy"**

## Why This Happens

When Root Directory is set to `/webapp`:
- Railway looks for files relative to that path
- Dockerfile should be at `webapp/Dockerfile` (which exists)
- But if Builder is still "Railpack", it ignores the Dockerfile
- Custom build/start commands override the Dockerfile

## After Fixing

The build should:
1. ✅ Use Dockerfile (not Railpack)
2. ✅ Find Dockerfile at `webapp/Dockerfile`
3. ✅ Build Next.js app (not backend)
4. ✅ Start Next.js server (not backend)

Check logs - you should see:
- ✅ `next build` messages
- ✅ `next start` messages
- ❌ NO `backend@1.0.0` messages

