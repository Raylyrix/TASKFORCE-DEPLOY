# CORS and API URL Fix Summary

## What I Fixed

1. ✅ **Updated CORS in backend** (`backend/src/app.ts`):
   - Added `https://taskforce-webapp-production.up.railway.app` to allowed origins
   - Added proper methods and headers

2. ✅ **Set NEXT_PUBLIC_API_URL** in webapp service:
   - Set to: `https://taskforce-backend-production.up.railway.app`

3. ✅ **Webapp redeployed** - Next.js will pick up the new API URL

## Current Status

- ✅ **Webapp**: Deployed and running with new API URL
- ⚠️ **Backend**: Needs redeploy to apply CORS changes

## Next Steps

The backend needs to be redeployed to apply the CORS fix. Since it's using RAILPACK which is failing, you may need to:

1. **In Railway Dashboard** → **backend service** → **Settings**
2. **Change Builder from "Railpack" to "Dockerfile"**
3. **Redeploy**

Or the backend will auto-redeploy when you push the CORS changes.

## After Backend Redeploys

The webapp should be able to:
- ✅ Call the backend API without CORS errors
- ✅ Use the correct backend URL (not localhost)
- ✅ Authenticate with Google OAuth

## Test

After backend redeploys, try accessing:
- **Webapp**: https://taskforce-webapp-production.up.railway.app
- **Login** should work without CORS errors


