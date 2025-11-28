# How to Add Google OAuth Credentials in Railway

## Step-by-Step Instructions

### Step 1: Open Railway Dashboard
1. Go to **https://railway.app**
2. Log in to your account
3. Open your project (**patient-passion**)

### Step 2: Navigate to Backend Service
1. Click on the **`taskforce-backend`** service
2. This will open the service dashboard

### Step 3: Go to Variables Tab
1. Click on the **"Variables"** tab at the top of the service page
2. You'll see a list of existing environment variables

### Step 4: Add Google OAuth Variables
Click **"+ New Variable"** for each of the following:

#### Variable 1: GOOGLE_CLIENT_ID
- **Name**: `GOOGLE_CLIENT_ID`
- **Value**: Your Google OAuth Client ID (from Google Cloud Console)
- Click **"Add"**

#### Variable 2: GOOGLE_CLIENT_SECRET
- **Name**: `GOOGLE_CLIENT_SECRET`
- **Value**: Your Google OAuth Client Secret (from Google Cloud Console)
- Click **"Add"**

#### Variable 3: GOOGLE_REDIRECT_URI (Choose ONE option)

**Option A: If you have a redirect URI**
- **Name**: `GOOGLE_REDIRECT_URI`
- **Value**: Your redirect URI (e.g., `https://yourdomain.com/api/auth/callback`)
- Click **"Add"**

**Option B: If you're using Chrome Extension IDs**
- **Name**: `GOOGLE_EXTENSION_IDS`
- **Value**: Comma-separated list of Chrome extension IDs (e.g., `abc123def456,xyz789uvw012`)
- Click **"Add"**

### Step 5: Optional - Add Other Variables
You may also want to add:

#### SESSION_SECRET
- **Name**: `SESSION_SECRET`
- **Value**: A random string (at least 16 characters) for session encryption
- You can generate one using: `openssl rand -base64 32` or any random string generator
- Click **"Add"**

#### ENCRYPTION_KEY (Optional but recommended)
- **Name**: `ENCRYPTION_KEY`
- **Value**: A random encryption key (32+ characters)
- Click **"Add"**

#### ENCRYPTION_SALT (Optional but recommended)
- **Name**: `ENCRYPTION_SALT`
- **Value**: A random salt string (16+ characters)
- Click **"Add"**

### Step 6: Save and Redeploy
1. After adding all variables, Railway will **automatically redeploy** the service
2. Wait for the deployment to complete (you'll see it in the Deployments tab)
3. The backend will restart with the new variables

### Step 7: Verify
After redeploy, check the logs to confirm:
- No more warnings about missing Google OAuth variables
- Backend service starts successfully

## Where to Get Google OAuth Credentials

If you don't have Google OAuth credentials yet:

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. **Create or select a project**
3. **Enable Google+ API** (or Gmail API if needed)
4. **Go to "Credentials"** → **"Create Credentials"** → **"OAuth 2.0 Client ID"**
5. **Configure OAuth consent screen** (if not done)
6. **Create OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: Add your callback URL
7. **Copy the Client ID and Client Secret**

## Quick Reference

**Required Variables:**
- `GOOGLE_CLIENT_ID` ✅
- `GOOGLE_CLIENT_SECRET` ✅
- `GOOGLE_REDIRECT_URI` OR `GOOGLE_EXTENSION_IDS` ✅

**Optional but Recommended:**
- `SESSION_SECRET` (at least 16 characters)
- `ENCRYPTION_KEY` (32+ characters)
- `ENCRYPTION_SALT` (16+ characters)

## Visual Guide

```
Railway Dashboard
  └── Your Project (patient-passion)
      └── taskforce-backend service
          └── Variables tab
              └── + New Variable
                  ├── GOOGLE_CLIENT_ID
                  ├── GOOGLE_CLIENT_SECRET
                  ├── GOOGLE_REDIRECT_URI (or GOOGLE_EXTENSION_IDS)
                  ├── SESSION_SECRET
                  ├── ENCRYPTION_KEY (optional)
                  └── ENCRYPTION_SALT (optional)
```

## After Adding Variables

The service will automatically redeploy. You can check the deployment status in the **"Deployments"** tab. Once complete, your backend will have full OAuth functionality!


