# Multi-User Extension Setup Guide

## Problem Solved ✅

**Previous Issue:** Each user gets a different Chrome Extension ID, requiring each redirect URI (`https://<extension-id>.chromiumapp.org/oauth2`) to be registered in Google Cloud Console.

**Solution:** The extension now uses the **backend's callback URL** instead of extension-specific redirect URIs. This means:
- ✅ **One redirect URI** works for all users
- ✅ **No need to register** individual extension IDs
- ✅ **Works out of the box** for all users

## How It Works

1. **Extension initiates OAuth:**
   - User clicks "Connect Google Account"
   - Extension calls backend `/api/auth/google/start` with redirect URI: `https://taskforce-backend-production.up.railway.app/api/auth/google/callback?source=extension`

2. **Backend handles OAuth:**
   - Backend generates OAuth URL with the callback URL
   - Extension opens OAuth URL in a new tab

3. **Google redirects to backend:**
   - After user authorizes, Google redirects to backend callback
   - Backend detects `source=extension` parameter
   - Backend serves a callback page with code and state

4. **Extension completes auth:**
   - Extension monitors the callback tab
   - Extracts code and state from URL
   - Exchanges code for tokens via backend API
   - Stores user session

## Google Cloud Console Setup

**You only need ONE redirect URI (works for both extension and webapp):**

```
https://taskforce-backend-production.up.railway.app/api/auth/google/callback
```

**Note:** This is the ONLY redirect URI that Google directly redirects to. The webapp callback URL is an internal redirect from the backend and doesn't need to be registered.

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Edit your OAuth 2.0 Client ID
5. Under **Authorized redirect URIs**, ensure this is present:
   ```
   https://taskforce-backend-production.up.railway.app/api/auth/google/callback
   ```
6. Click **Save**

**That's it!** No need to add extension-specific redirect URIs.

## Distribution

### For Administrators

1. **Build the extension:**
   ```bash
   cd extension
   npm run build
   ```

2. **Package the `dist/` folder:**
   - Zip the entire `dist/` folder
   - Include `INSTALLATION_GUIDE.md` for users

3. **Distribute to users:**
   - Send the zip file
   - Users extract and load in Chrome
   - **No configuration needed!**

### For End Users

1. Extract the extension files
2. Open Chrome → `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" → Select the `dist/` folder
5. Click extension icon → "Connect Google Account"
6. Authorize with Google

**No backend URL configuration needed** - it uses production backend by default.

## Technical Details

### Extension Changes

- **Removed:** `chrome.identity.launchWebAuthFlow()` (required extension-specific redirect URI)
- **Added:** `chrome.tabs.create()` to open OAuth in a tab
- **Added:** Tab monitoring to detect callback URL
- **Added:** Backend callback detection via `source=extension` parameter

### Backend Changes

- **Updated:** `/api/auth/google/callback` route to detect `source=extension`
- **Added:** Special callback page for extensions that includes code/state in URL
- **Maintained:** Webapp callback flow (unchanged)

### Security

- ✅ OAuth state validation (prevents CSRF)
- ✅ Code exchange happens server-side
- ✅ Tokens stored securely in extension storage
- ✅ No sensitive data in URLs (except temporary OAuth code)

## Troubleshooting

**Authentication fails:**
- Verify backend callback URL is in Google Cloud Console
- Check backend is accessible
- Ensure extension has `tabs` permission

**Tab doesn't close after auth:**
- Extension automatically closes callback tab
- If it doesn't close, user can close manually
- Auth still completes successfully

**"Failed to open authentication popup":**
- User needs to allow popups for the extension
- Or extension opens in new tab instead

## Benefits

1. **Scalable:** Works for unlimited users without configuration
2. **Simple:** One redirect URI in Google Cloud Console
3. **Secure:** OAuth flow handled properly with state validation
4. **User-friendly:** No technical setup required for end users

