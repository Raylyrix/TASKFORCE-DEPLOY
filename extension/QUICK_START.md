# Quick Start: Extension Distribution

## ✅ Extension is Ready for Distribution!

The extension has been configured to work out-of-the-box for end users:

### What's Configured

1. **Production Backend URL** - Defaults to `https://taskforce-backend-production.up.railway.app`
2. **Manifest Permissions** - Includes production backend URL
3. **User-Friendly Auth** - Simplified authentication flow
4. **Build Complete** - Extension is built and ready in `dist/` folder

### For End Users

Users just need to:
1. Download the `dist/` folder
2. Open Chrome → `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" → Select `dist/` folder
5. Click extension icon → "Connect Google Account"

**That's it!** No configuration needed.

### For Administrators

**IMPORTANT:** Before distributing, you must:

1. **Get Extension ID:**
   - Load extension in Chrome
   - Note the Extension ID from `chrome://extensions/`

2. **Add Redirect URI to Google Cloud Console:**
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Edit your OAuth 2.0 Client ID
   - Add redirect URI: `https://<extension-id>.chromiumapp.org/oauth2`
   - Replace `<extension-id>` with your actual ID

3. **Package for Distribution:**
   - Zip the `dist/` folder
   - Include `INSTALLATION_GUIDE.md` for users

### Files Created

- ✅ `INSTALLATION_GUIDE.md` - User installation instructions
- ✅ `DISTRIBUTION_SETUP.md` - Administrator setup guide
- ✅ `QUICK_START.md` - This file

### Testing

To test the extension:
1. Load `dist/` folder in Chrome
2. Open Gmail
3. Click extension icon
4. Click "Connect Google Account"
5. Verify it connects successfully

### Need to Change Backend URL?

Users can change the backend URL in:
- Right-click extension icon → **Options**
- Enter new backend URL
- Click **Save**

The extension will use the production backend by default, so most users won't need to change anything.


