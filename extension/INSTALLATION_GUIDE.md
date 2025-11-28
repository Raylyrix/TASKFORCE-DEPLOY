# TaskForce Extension Installation Guide

## For End Users (Non-Developers)

### Step 1: Download the Extension

1. Download the extension files (the `dist` folder after building)
2. Extract the files to a folder on your computer

### Step 2: Install in Chrome

1. Open Google Chrome
2. Go to `chrome://extensions/` (or Chrome Menu → Extensions → Manage Extensions)
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the folder containing the extension files
6. The extension should now appear in your extensions list

### Step 3: Connect Your Google Account

1. Click the TaskForce extension icon in Chrome toolbar
2. Click **"Connect Google Account"**
3. Sign in with your Google account
4. Grant the requested permissions

### Step 4: Start Using

The extension is now ready to use! You can:
- Open Gmail and compose emails
- Use the TaskForce panel to create campaigns
- Import recipients from Google Sheets
- Schedule follow-ups and automations

## Important Notes

### Google Cloud Console Setup (For Administrators)

The extension uses Chrome Identity API which generates a redirect URI like:
```
https://<extension-id>.chromiumapp.org/oauth2
```

**You must add this redirect URI to your Google Cloud Console:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Edit your OAuth 2.0 Client ID
5. Add the redirect URI: `https://<extension-id>.chromiumapp.org/oauth2`
   - Replace `<extension-id>` with your actual extension ID
   - You can find the extension ID in `chrome://extensions/` (it's shown under the extension name)

### Backend Configuration

By default, the extension connects to:
```
https://taskforce-backend-production.up.railway.app
```

If you need to use a different backend:
1. Right-click the extension icon → **Options**
2. Enter your custom backend URL
3. Click **Save**

### Troubleshooting

**Extension not working?**
- Make sure Developer mode is enabled
- Check that the extension is enabled
- Verify the backend URL is correct in Options

**Authentication fails?**
- Check that the redirect URI is added to Google Cloud Console
- Verify the backend is accessible
- Check browser console for errors (F12)

**Can't see the extension in Gmail?**
- Make sure you're on `mail.google.com`
- Refresh the Gmail page
- Check that the extension has permission to access Gmail

## Building the Extension

If you need to build the extension from source:

```bash
cd extension
npm install
npm run build
```

The built files will be in the `dist` folder.


