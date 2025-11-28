# Complete Render Deployment Setup Guide

## 📋 Prerequisites

- Render account (sign up at https://render.com)
- GitHub repository with your code pushed
- Google Cloud Console account (for OAuth)

---

## Step 1: Create PostgreSQL Database

1. **Go to Render Dashboard**
   - Log in to https://dashboard.render.com
   - Click the **"New +"** button (top right)
   - Select **"PostgreSQL"**

2. **Configure Database:**
   ```
   Name: taskforce-db
   Database: taskforce
   User: taskforce
   Region: Choose closest to your users (e.g., US East, US West, EU)
   PostgreSQL Version: 16
   Plan: Professional (or your selected plan)
   ```

3. **Create Database**
   - Click **"Create Database"**
   - Wait for it to be created (takes 1-2 minutes)
   - **IMPORTANT**: Copy the **Internal Database URL** - you'll need it later
   - The connection string looks like: `postgresql://taskforce:password@dpg-xxxxx/taskforce`

---

## Step 2: Create Redis Instance

1. **Go to Render Dashboard**
   - Click **"New +"** button
   - Select **"Redis"**

2. **Configure Redis:**
   ```
   Name: taskforce-redis
   Region: Same as database (for lower latency)
   Plan: Starter (or your preferred plan)
   Max Memory Policy: allkeys-lru
   ```

3. **Create Redis**
   - Click **"Create Redis"**
   - Wait for it to be created
   - **IMPORTANT**: Copy the **Internal Redis URL** - you'll need it later
   - The connection string looks like: `redis://red-xxxxx:6379`

---

## Step 3: Set Up Google OAuth (If Not Done)

1. **Go to Google Cloud Console**
   - Visit https://console.cloud.google.com
   - Select or create a project

2. **Enable APIs:**
   - Go to "APIs & Services" → "Library"
   - Enable:
     - **Gmail API**
     - **Google Calendar API**
     - **Google Sheets API**

3. **Create OAuth 2.0 Credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click **"Create Credentials"** → **"OAuth client ID"**
   - Application type: **Web application**
   - Name: `TaskForce Production`
   - **Authorized redirect URIs:**
     ```
     https://taskforce-backend.onrender.com/api/auth/google/callback
     ```
     (Replace with your actual backend URL after deployment)
   - Click **"Create"**
   - **Copy the Client ID and Client Secret** - you'll need these!

---

## Step 4: Connect GitHub Repository

1. **In Render Dashboard:**
   - Click **"New +"** → **"Blueprint"**
   - Connect your GitHub account if not already connected
   - Select your repository: `TASKFORCE-DEPLOY` (or your repo name)
   - Render will detect `render.yaml` automatically

2. **Review Services:**
   - Render will show you all services from `render.yaml`
   - You should see:
     - `taskforce-backend` (Web Service)
     - `taskforce-webapp` (Web Service)
     - `taskforce-redis` (Redis - already created, will link)
     - `taskforce-db` (Database - already created, will link)

---

## Step 5: Configure Backend Service

1. **Backend Service Settings:**
   - Service will be created automatically from `render.yaml`
   - Go to the `taskforce-backend` service page
   - Click **"Environment"** tab

2. **Set Environment Variables:**
   ```
   NODE_ENV = production
   PORT = (Leave empty - Render sets automatically)
   
   DATABASE_URL = (Auto-set from database, verify it's correct)
   REDIS_URL = (Auto-set from Redis, verify it's correct)
   
   BACKEND_PUBLIC_URL = https://taskforce-backend.onrender.com
   (Replace with your actual backend URL)
   
   GOOGLE_CLIENT_ID = <paste-your-google-client-id>
   GOOGLE_CLIENT_SECRET = <paste-your-google-client-secret>
   
   GOOGLE_REDIRECT_URI = https://taskforce-backend.onrender.com/api/auth/google/callback
   (Replace with your actual backend URL)
   
   SESSION_SECRET = <generate-random-string-min-16-chars>
   (You can use: openssl rand -hex 32)
   
   GOOGLE_EXTENSION_IDS = (Leave empty if not using Chrome extension)
   ```

3. **Verify Build Settings:**
   - Root Directory: `backend`
   - Build Command: `npm ci && npx prisma generate && npm run build && npx prisma migrate deploy`
   - Start Command: `npm start`
   - Health Check Path: `/health`

4. **Save and Deploy:**
   - Click **"Save Changes"**
   - Render will start building and deploying

---

## Step 6: Configure Frontend Service

1. **Frontend Service Settings:**
   - Service will be created automatically from `render.yaml`
   - Go to the `taskforce-webapp` service page
   - Click **"Environment"** tab

2. **Set Environment Variables:**
   ```
   NODE_ENV = production
   PORT = 3000
   
   NEXT_PUBLIC_API_URL = https://taskforce-backend.onrender.com
   (Replace with your actual backend URL from Step 5)
   
   NEXT_PUBLIC_GOOGLE_CLIENT_ID = <same-as-backend-GOOGLE_CLIENT_ID>
   (Must match the backend's GOOGLE_CLIENT_ID exactly)
   ```

3. **Verify Build Settings:**
   - Root Directory: `webapp`
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`

4. **Save and Deploy:**
   - Click **"Save Changes"**
   - Render will start building and deploying

---

## Step 7: Update Google OAuth Redirect URI

1. **Get Your Backend URL:**
   - After backend deploys, copy the URL (e.g., `https://taskforce-backend-xxxx.onrender.com`)

2. **Update Google Cloud Console:**
   - Go back to Google Cloud Console → Credentials
   - Edit your OAuth 2.0 Client ID
   - Update **Authorized redirect URIs:**
     ```
     https://taskforce-backend-xxxx.onrender.com/api/auth/google/callback
     ```
   - Click **"Save"**

3. **Update Backend Environment Variable:**
   - In Render Dashboard → `taskforce-backend` → Environment
   - Update `GOOGLE_REDIRECT_URI` to match:
     ```
     https://taskforce-backend-xxxx.onrender.com/api/auth/google/callback
     ```
   - Update `BACKEND_PUBLIC_URL` to match:
     ```
     https://taskforce-backend-xxxx.onrender.com
     ```
   - Save and redeploy

---

## Step 8: Verify Deployment

### Check Backend:
1. Visit: `https://your-backend-url.onrender.com/health`
2. Should return: `{"status":"ok"}`

### Check Frontend:
1. Visit: `https://your-frontend-url.onrender.com/api/health`
2. Should return: `{"status":"ok"}`

### Test Login:
1. Visit your frontend URL
2. Should see login page with email auto-detection
3. Click "Continue with Google" or "Continue" (if email detected)
4. Complete OAuth flow
5. Should redirect to dashboard

---

## Step 9: Monitor and Troubleshoot

### Check Logs:
- **Backend**: Go to `taskforce-backend` → "Logs" tab
- **Frontend**: Go to `taskforce-webapp` → "Logs" tab

### Common Issues:

**1. Database Connection Failed:**
- Verify `DATABASE_URL` is set correctly
- Check database is running (green status)
- Review backend logs for connection errors

**2. OAuth Not Working:**
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` match
- Check `GOOGLE_REDIRECT_URI` matches Google Cloud Console
- Ensure `BACKEND_PUBLIC_URL` is correct

**3. Frontend Can't Connect to Backend:**
- Verify `NEXT_PUBLIC_API_URL` is set to backend URL
- Check CORS settings (should be handled automatically)
- Review browser console for errors

**4. Build Failures:**
- Check build logs for specific errors
- Verify Node.js version (should be 18+)
- Ensure all dependencies are in `package.json`

---

## Step 10: Generate Session Secret (Optional)

If you need to generate a secure `SESSION_SECRET`:

**On Mac/Linux:**
```bash
openssl rand -hex 32
```

**On Windows (PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

Or use an online generator: https://randomkeygen.com/

---

## Quick Reference: Environment Variables Checklist

### Backend (`taskforce-backend`):
- [ ] `NODE_ENV` = `production`
- [ ] `DATABASE_URL` = (auto-set, verify)
- [ ] `REDIS_URL` = (auto-set, verify)
- [ ] `BACKEND_PUBLIC_URL` = `https://your-backend.onrender.com`
- [ ] `GOOGLE_CLIENT_ID` = (from Google Cloud Console)
- [ ] `GOOGLE_CLIENT_SECRET` = (from Google Cloud Console)
- [ ] `GOOGLE_REDIRECT_URI` = `https://your-backend.onrender.com/api/auth/google/callback`
- [ ] `SESSION_SECRET` = (random 32-char string)

### Frontend (`taskforce-webapp`):
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `3000`
- [ ] `NEXT_PUBLIC_API_URL` = `https://your-backend.onrender.com`
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = (same as backend)

---

## Deployment Order Summary

1. ✅ Create PostgreSQL database (`taskforce-db`)
2. ✅ Create Redis instance (`taskforce-redis`)
3. ✅ Set up Google OAuth credentials
4. ✅ Connect GitHub repository to Render
5. ✅ Configure backend service environment variables
6. ✅ Configure frontend service environment variables
7. ✅ Update Google OAuth redirect URI with actual backend URL
8. ✅ Verify all services are running
9. ✅ Test login and basic functionality

---

## After Deployment

- **Monitor**: Check logs regularly for errors
- **Scale**: Upgrade plans if needed (in service settings)
- **Backup**: Set up database backups in Render dashboard
- **Custom Domain**: Add custom domain in service settings (optional)
- **SSL**: Automatically handled by Render

---

## Support

If you encounter issues:
1. Check service logs in Render Dashboard
2. Review `RENDER_DEPLOYMENT_READY.md` for troubleshooting
3. Check Render status page: https://status.render.com
4. Contact Render support if needed

---

**Status**: ✅ Ready to deploy following these steps!


