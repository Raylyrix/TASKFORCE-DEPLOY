# Google Cloud Console - Redirect URI Setup

## Required Redirect URIs

You need to add **ONE** redirect URI to your Google Cloud Console:

### Backend Callback (Required for Extension & Webapp)
```
https://taskforce-backend-production.up.railway.app/api/auth/google/callback
```

**Why:** 
- This is where Google redirects users after OAuth authorization
- Used by both the extension and webapp
- The backend then handles the callback and redirects to the appropriate destination
- **This is the ONLY URL that Google directly redirects to**

**Note:** The webapp callback URL (`https://taskforce-webapp-production.up.railway.app/auth/callback`) is an **internal redirect** from the backend, not a direct Google redirect, so it does NOT need to be registered with Google.

## Setup Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your **OAuth 2.0 Client ID** (or create one if needed)
5. Under **Authorized redirect URIs**, click **+ ADD URI**
6. Add this URI:
   ```
   https://taskforce-backend-production.up.railway.app/api/auth/google/callback
   ```
7. Click **SAVE**

**That's it!** Only one redirect URI is needed.

## Important Notes

### Extension Users
- ✅ **No additional redirect URIs needed** for extension users
- ✅ Extension uses the backend callback URL
- ✅ Works for **all users** regardless of their extension ID

### Webapp Users
- ✅ Uses backend callback URL (same one as extension)
- ✅ Backend internally redirects to webapp callback (no Google registration needed)

### Development (Optional)
If you're running locally, you may also want to add:
```
http://localhost:3000/api/auth/google/callback
http://localhost:3001/auth/callback
```

## Verification

After adding the URIs:
1. ✅ Extension authentication should work for all users
2. ✅ Webapp authentication should work
3. ✅ No "redirect_uri_mismatch" errors

## Troubleshooting

**Error: "redirect_uri_mismatch"**
- Verify both URIs are added exactly as shown above
- Check for typos (https vs http, trailing slashes, etc.)
- Ensure you're using the correct OAuth Client ID

**Extension auth fails but webapp works:**
- Verify the backend callback URI is added
- Check backend logs for redirect URI issues

**Webapp auth fails but extension works:**
- Verify the webapp callback URI is added
- Check that backend is redirecting correctly

