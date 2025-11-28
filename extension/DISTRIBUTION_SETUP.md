# Extension Distribution Setup Guide

## For Administrators: Setting Up the Extension for Distribution

### Step 1: Build the Extension

```bash
cd extension
npm install
npm run build
```

This creates a `dist/` folder with all the extension files ready for distribution.

### Step 2: Get Extension ID

1. Load the extension in Chrome (chrome://extensions → Load unpacked → select `dist/` folder)
2. Note the Extension ID shown under the extension name
3. The redirect URI will be: `https://<extension-id>.chromiumapp.org/oauth2`

### Step 3: Configure Google Cloud Console

**IMPORTANT:** The extension now uses the backend's callback URL, so you only need ONE redirect URI:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID (or create one if needed)
5. Under **Authorized redirect URIs**, ensure this is present:
   ```
   https://taskforce-backend-production.up.railway.app/api/auth/google/callback
   ```
   Also ensure the webapp callback is present:
   ```
   https://taskforce-webapp-production.up.railway.app/auth/callback
   ```

6. **You do NOT need to add extension-specific redirect URIs** - the extension uses the backend callback URL which works for all users.

7. Click **Save**

**Note:** This setup works for ALL users - no need to register individual extension IDs!

### Step 4: Package for Distribution

**Option A: Zip the dist folder**
```bash
cd extension
zip -r taskforce-extension.zip dist/
```

**Option B: Create a distribution package**
- Create a folder named `taskforce-extension-v1.0.0`
- Copy the entire `dist/` folder contents into it
- Create a README.txt with installation instructions
- Zip the folder

### Step 5: Distribution Files

Include these files for users:
1. The extension zip file (or `dist/` folder)
2. `INSTALLATION_GUIDE.md` (user instructions)
3. Optional: Screenshots or video tutorial

### Step 6: User Installation Instructions

Share with users:
1. Extract the extension files
2. Open Chrome → `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked"
5. Select the extension folder
6. Click the extension icon → "Connect Google Account"

## Important Notes

### Extension ID Changes

⚠️ **Warning:** If you rebuild or reload the extension, the Extension ID may change. You'll need to:
1. Get the new Extension ID
2. Update Google Cloud Console with the new redirect URI
3. Redistribute the extension

### Production vs Development

- **Production:** Extension connects to `https://taskforce-backend-production.up.railway.app` by default
- **Development:** Users can change backend URL in Options page if needed

### Security Considerations

- The extension uses Chrome Identity API for secure OAuth
- All API calls go through the configured backend
- No sensitive data is stored locally (except auth token)
- Users can disconnect at any time

## Troubleshooting

**Users can't authenticate:**
- Verify redirect URI is in Google Cloud Console
- Check that extension ID matches
- Ensure backend is accessible

**Extension not loading:**
- Verify all files are in the dist folder
- Check Chrome console for errors
- Ensure manifest.json is valid

**Backend connection fails:**
- Verify backend URL is correct
- Check CORS settings on backend
- Ensure backend is running and accessible

