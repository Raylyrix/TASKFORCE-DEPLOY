# Redirect URI Mismatch Fix

## Problem
Extension was sending redirect URI with query parameter:
```
https://taskforce-backend-production.up.railway.app/api/auth/google/callback?source=extension
```

But Google OAuth requires **exact match** - query parameters are not allowed in the registered redirect URI.

## Solution
✅ **Fixed:** Extension now sends redirect URI without query parameters:
```
https://taskforce-backend-production.up.railway.app/api/auth/google/callback
```

## What You Need to Do

### 1. Verify Google Cloud Console
Make sure you have added this EXACT redirect URI (no query parameters):
```
https://taskforce-backend-production.up.railway.app/api/auth/google/callback
```

### 2. Rebuild Extension
The extension has been rebuilt with the fix. If you're distributing:
```bash
cd extension
npm run build
```

### 3. Reload Extension in Chrome
1. Go to `chrome://extensions/`
2. Find TaskForce extension
3. Click the reload icon (circular arrow)
4. Try connecting again

## Verification

After fixing:
- ✅ Extension sends: `https://taskforce-backend-production.up.railway.app/api/auth/google/callback`
- ✅ Google Cloud Console has: `https://taskforce-backend-production.up.railway.app/api/auth/google/callback`
- ✅ **Exact match** = No more redirect_uri_mismatch error

## Important Notes

- **No query parameters** in redirect URI registered with Google
- Backend automatically detects if request is from extension (by checking referer)
- Works for both extension and webapp with the same redirect URI


