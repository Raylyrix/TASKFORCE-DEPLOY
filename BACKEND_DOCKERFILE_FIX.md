# Fix Backend to Use Dockerfile Instead of RAILPACK

## The Problem

Railway is using RAILPACK for the backend service, which is failing. The backend needs to use Dockerfile instead.

## The Fix

### In Railway Dashboard:

1. **Go to Railway Dashboard** → **backend service** (`taskforce-backend`) → **Settings**
2. **Go to "Build" section**
3. **Find "Builder" dropdown**
4. **Change from "Railpack" to "Dockerfile"**
5. **Dockerfile Path**: Should be `Dockerfile` (Railway will look for `backend/Dockerfile`)
6. **Save**

### After Changing Builder:

1. Railway will auto-redeploy
2. The backend will build using the Dockerfile
3. CORS fix will be applied
4. Backend will start successfully

## Why This is Needed

- `backend/railway.json` specifies Dockerfile, but Railway Dashboard settings override it
- RAILPACK is trying to run migrations during build, which fails
- Dockerfile approach works correctly (as we saw with webapp)

## After Fixing

The backend will:
- ✅ Build using Dockerfile
- ✅ Run migrations on startup (via start.sh)
- ✅ Apply CORS fix
- ✅ Accept requests from webapp

Then the webapp will be able to:
- ✅ Call backend API without CORS errors
- ✅ Authenticate with Google OAuth


