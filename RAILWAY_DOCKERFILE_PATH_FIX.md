# Fix Dockerfile Path When Root is `/`

## The Problem

When Root Directory is set to `/` (repo root), Railway looks for `Dockerfile` at the root, but our Dockerfile is at `webapp/Dockerfile`.

## The Solution

Since Railway Dashboard is forcing root to `/`, we need to tell Railway where to find the Dockerfile.

### Option 1: Update railway.json (Already Done)

I've updated `webapp/railway.json` to specify:
```json
"dockerfilePath": "webapp/Dockerfile"
```

This tells Railway to look for the Dockerfile at `webapp/Dockerfile` relative to the repo root.

### Option 2: Set in Railway Dashboard

1. **Go to Railway Dashboard** → **webapp service** → **Settings** → **Build** section
2. **Builder**: Should be "Dockerfile" (not Railpack)
3. **Dockerfile Path**: Set to `webapp/Dockerfile` (not just `Dockerfile`)
4. **Save**

### Option 3: Use RAILPACK with Custom Commands

If Dockerfile still doesn't work, we can use RAILPACK but override the commands:

1. **Builder**: Keep as "Railpack"
2. **Custom Build Command**: `cd webapp && npm ci && npm run build`
3. **Custom Start Command**: `cd webapp && npm start`
4. **Root Directory**: `/` (repo root)

## Current Configuration

- ✅ `webapp/railway.json` updated with `dockerfilePath: "webapp/Dockerfile"`
- ✅ Environment variable `RAILWAY_DOCKERFILE_PATH=webapp/Dockerfile` set
- ⚠️ Root Directory in Dashboard: `/` (repo root)

## Next Steps

1. **Commit and push** the updated `webapp/railway.json`:
   ```bash
   git add webapp/railway.json
   git commit -m "Fix Dockerfile path for Railway"
   git push
   ```

2. **In Railway Dashboard**:
   - **Builder**: "Dockerfile"
   - **Dockerfile Path**: `webapp/Dockerfile`
   - **Root Directory**: `/` (keep as is)

3. **Redeploy** - Railway should now find the Dockerfile at `webapp/Dockerfile`

## Alternative: Use RAILPACK

If Dockerfile still doesn't work, we can switch back to RAILPACK but with correct commands:

**Build Command**: `cd webapp && npm ci && npm run build`
**Start Command**: `cd webapp && npm start`

This will build and run the Next.js app from the webapp directory.

