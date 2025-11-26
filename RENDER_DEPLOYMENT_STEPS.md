# 🚀 Complete Render Deployment Guide

## Step-by-Step Deployment Instructions

---

## 📋 Prerequisites Checklist

- [ ] GitHub account
- [ ] Render.com account (sign up at https://render.com)
- [ ] Google Cloud Console account with OAuth credentials
- [ ] Code ready to push

---

## Step 1: Push Code to GitHub

### 1.1 Initialize Git (if not already done)

```powershell
cd "C:\Users\hp\Downloads\TASKFORCE-PRODUCTION-main\TASKFORCE-PRODUCTION-main"
git init
```

### 1.2 Add Remote Repository

```powershell
git remote add origin https://github.com/Raylyrix/TASKFORCE-PRODUCTION.git
```

Or if remote already exists, update it:
```powershell
git remote set-url origin https://github.com/Raylyrix/TASKFORCE-PRODUCTION.git
```

### 1.3 Stage All Files

```powershell
git add .
```

### 1.4 Commit Changes

```powershell
git commit -m "Production ready - ready for Render deployment"
```

### 1.5 Push to GitHub

```powershell
git branch -M main
git push -u origin main
```

**Note:** If you get authentication errors, you may need to:
- Use a Personal Access Token instead of password
- Or use SSH: `git remote set-url origin git@github.com:Raylyrix/TASKFORCE-PRODUCTION.git`

---

## Step 2: Set Up Render Account

1. Go to https://render.com
2. Sign up or log in
3. Connect your GitHub account (Settings → GitHub)

---

## Step 3: Deploy Using Blueprint (Easiest Method)

### 3.1 Create New Blueprint

1. Render Dashboard → **New** → **Blueprint**
2. Connect repository: `Raylyrix/TASKFORCE-PRODUCTION`
3. Render will detect `render.yaml` automatically
4. Click **Apply**

### 3.2 Configure Environment Variables

After Blueprint creates services, you need to add environment variables manually:

#### Backend Service Environment Variables

Go to **taskforce-backend** service → **Environment** tab:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Already set by Blueprint |
| `PORT` | `4000` | Already set by Blueprint |
| `DATABASE_URL` | Auto-set | From database connection |
| `REDIS_URL` | Auto-set | From Redis connection |
| `BACKEND_PUBLIC_URL` | `https://taskforce-backend.onrender.com` | **You need to set this** |
| `GOOGLE_CLIENT_ID` | `1007595181381-t7kic92pdmi3cvgiomc8vobngh2t1goj.apps.googleusercontent.com` | **You need to set this** |
| `GOOGLE_CLIENT_SECRET` | `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` | **You need to set this** |
| `GOOGLE_REDIRECT_URI` | `https://taskforce-backend.onrender.com/api/auth/google/callback` | **You need to set this** |
| `SESSION_SECRET` | Auto-generated | Already set by Blueprint |
| `GOOGLE_EXTENSION_IDS` | `abbommimhkkkeiomeiegadjkdhhdieac` | **You need to set this** |

#### Frontend Service Environment Variables

Go to **taskforce-webapp** service → **Environment** tab:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Already set by Blueprint |
| `NEXT_PUBLIC_API_URL` | `https://taskforce-backend.onrender.com` | **Auto-set from backend, but verify** |

**Important:** Wait for backend to deploy first, then the frontend will get the correct URL.

---

## Step 4: Manual Deployment (Alternative Method)

If Blueprint doesn't work, deploy manually:

### 4.1 Create PostgreSQL Database

1. Render Dashboard → **New** → **PostgreSQL**
2. Name: `taskforce-db`
3. Database: `taskforce`
4. User: `taskforce`
5. Plan: **Starter** ($7/month)
6. **Copy the Internal Database URL** (you'll need this)

### 4.2 Create Redis

1. Render Dashboard → **New** → **Redis**
2. Name: `taskforce-redis`
3. Plan: **Starter** ($7/month)
4. **Copy the Internal Redis URL**

### 4.3 Deploy Backend

1. Render Dashboard → **New** → **Web Service**
2. Connect repository: `Raylyrix/TASKFORCE-PRODUCTION`
3. **Settings:**
   - **Name:** `taskforce-backend`
   - **Root Directory:** `backend` (or leave blank if repo root)
   - **Environment:** `Node`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Starter ($7/month)

4. **Environment Variables:**
   ```
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=<Internal Database URL from Step 4.1>
   REDIS_URL=<Internal Redis URL from Step 4.2>
   BACKEND_PUBLIC_URL=https://taskforce-backend.onrender.com
   GOOGLE_CLIENT_ID=1007595181381-t7kic92pdmi3cvgiomc8vobngh2t1goj.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=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
   GOOGLE_REDIRECT_URI=https://taskforce-backend.onrender.com/api/auth/google/callback
   SESSION_SECRET=<Generate: openssl rand -base64 32>
   GOOGLE_EXTENSION_IDS=abbommimhkkkeiomeiegadjkdhhdieac
   ```

5. **Health Check Path:** `/health`

6. Click **Create Web Service**

### 4.4 Run Database Migrations

1. Wait for backend to deploy
2. Go to backend service → **Shell** tab
3. Run:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
4. Wait for migrations to complete

### 4.5 Deploy Frontend

1. Render Dashboard → **New** → **Web Service**
2. Connect same repository: `Raylyrix/TASKFORCE-PRODUCTION`
3. **Settings:**
   - **Name:** `taskforce-webapp`
   - **Root Directory:** `webapp` (or leave blank if repo root)
   - **Environment:** `Node`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Starter ($7/month)

4. **Environment Variables:**
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://taskforce-backend.onrender.com
   ```

5. **Health Check Path:** `/api/health`

6. Click **Create Web Service**

---

## Step 5: Configure Google OAuth

### 5.1 Update Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. **Authorized Redirect URIs** → **Add URI:**
   - `https://taskforce-backend.onrender.com/api/auth/google/callback`
   - `https://abbommimhkkkeiomeiegadjkdhhdieac.chromiumapp.org/oauth2`
5. **Save**

### 5.2 Verify APIs Are Enabled

Make sure these APIs are enabled:
- ✅ Gmail API
- ✅ Google Calendar API
- ✅ Google OAuth2 API

---

## Step 6: Verify Deployment

### 6.1 Check Backend Health

```bash
curl https://taskforce-backend.onrender.com/health
```

Should return:
```json
{"status":"ok","services":{"database":"ok","redis":"ok"},"timestamp":"...","uptime":...}
```

### 6.2 Check Frontend

1. Open: `https://taskforce-webapp.onrender.com`
2. Should load without errors

### 6.3 Test Authentication

1. Click "Sign in with Google"
2. Complete OAuth flow
3. Should redirect to dashboard

---

## Step 7: Update Environment Variables After Deployment

Once services are deployed, you'll get actual URLs. Update:

### Backend:
- `BACKEND_PUBLIC_URL`: Use the actual backend URL from Render
- `GOOGLE_REDIRECT_URI`: Update to match backend URL

### Frontend:
- `NEXT_PUBLIC_API_URL`: Should auto-update, but verify it matches backend URL

---

## 📝 Complete Environment Variables Reference

### Backend (`taskforce-backend`)

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=<Internal Database URL from Render>
REDIS_URL=<Internal Redis URL from Render>
BACKEND_PUBLIC_URL=https://taskforce-backend.onrender.com
GOOGLE_CLIENT_ID=1007595181381-t7kic92pdmi3cvgiomc8vobngh2t1goj.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://taskforce-backend.onrender.com/api/auth/google/callback
SESSION_SECRET=<Generate with: openssl rand -base64 32>
GOOGLE_EXTENSION_IDS=abbommimhkkkeiomeiegadjkdhhdieac
```

### Frontend (`taskforce-webapp`)

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://taskforce-backend.onrender.com
```

---

## 🔧 Generating SESSION_SECRET

If you need to generate a secure `SESSION_SECRET`:

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**On Mac/Linux:**
```bash
openssl rand -base64 32
```

**Or use online generator:**
- https://generate-secret.vercel.app/32

---

## 🐛 Troubleshooting

### Backend Won't Start

**Check:**
1. All environment variables are set
2. Database URL is correct (use internal URL, not public)
3. Redis URL is correct
4. Check logs: Backend Service → **Logs** tab

**Common Issues:**
- `DATABASE_URL` wrong → Use internal database URL
- Migrations not run → Run `npx prisma migrate deploy` in Shell
- Port conflict → Ensure `PORT=4000` is set

### Frontend Can't Connect

**Check:**
1. `NEXT_PUBLIC_API_URL` matches backend URL exactly
2. Backend is running (check health endpoint)
3. CORS is configured (should be automatic)

**Fix:**
- Update `NEXT_PUBLIC_API_URL` to backend URL
- Restart frontend service

### Database Connection Errors

**Check:**
1. Using internal database URL (not public)
2. Database service is running
3. Connection string format is correct

**Fix:**
- Use Render's internal database URL
- Format: `postgresql://user:password@host:5432/database`

### Google OAuth Not Working

**Check:**
1. Client ID and Secret are correct
2. Redirect URI matches exactly (including https://)
3. APIs are enabled in Google Cloud Console

**Fix:**
- Verify redirect URI in Google Console matches exactly
- Check OAuth credentials are correct
- Ensure Gmail and Calendar APIs are enabled

---

## 📊 Service URLs

After deployment, your services will be at:

- **Backend:** `https://taskforce-backend.onrender.com`
- **Frontend:** `https://taskforce-webapp.onrender.com`
- **Health Check:** `https://taskforce-backend.onrender.com/health`

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] GitHub connected to Render
- [ ] PostgreSQL database created
- [ ] Redis created
- [ ] Backend service deployed
- [ ] Database migrations run
- [ ] Frontend service deployed
- [ ] All environment variables set
- [ ] Google OAuth redirect URIs updated
- [ ] Backend health check passing
- [ ] Frontend loads correctly
- [ ] Authentication tested
- [ ] Core features tested

---

## 🎉 You're Live!

Your application is now deployed on Render.com!

**Next Steps:**
1. Test all features
2. Set up custom domains (optional)
3. Configure monitoring and alerts
4. Set up backups

---

## 💰 Cost Estimate

**Starter Plan:**
- Backend: $7/month
- Frontend: $7/month
- PostgreSQL: $7/month
- Redis: $7/month
- **Total: ~$28/month**

**Free Tier Available:**
- Services spin down after 15 minutes of inactivity
- Good for testing, not recommended for production

---

## 📞 Support

- **Render Docs:** https://render.com/docs
- **Render Status:** https://status.render.com
- **Application Logs:** Render Dashboard → Service → Logs

---

**Ready to deploy? Follow the steps above!** 🚀

