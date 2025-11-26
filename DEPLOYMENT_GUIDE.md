# 🚀 Deployment Guide - Taskforce Production

Complete guide for deploying Taskforce to production on Render.com or any cloud platform.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Render.com)](#quick-start-rendercom)
3. [Manual Deployment Steps](#manual-deployment-steps)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Google OAuth Configuration](#google-oauth-configuration)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)
9. [Scaling & Performance](#scaling--performance)

---

## Prerequisites

- GitHub repository with your code
- Render.com account (or similar cloud platform)
- Google Cloud Console account
- Domain name (optional, but recommended)

---

## Quick Start (Render.com)

### Option 1: Using render.yaml (Recommended)

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Production ready"
   git push origin main
   ```

2. **Connect to Render**
   - Go to https://render.com
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml`

3. **Configure Environment Variables**
   - Go to each service (backend, webapp)
   - Add environment variables (see [Environment Variables](#environment-variables))

4. **Deploy**
   - Render will automatically deploy all services
   - Wait for build to complete (~5-10 minutes)

### Option 2: Manual Setup

Follow the [Manual Deployment Steps](#manual-deployment-steps) below.

---

## Manual Deployment Steps

### Step 1: Create Databases (5 minutes)

#### PostgreSQL Database
1. Render Dashboard → **New** → **PostgreSQL**
2. Name: `taskforce-db`
3. Database: `taskforce`
4. User: `taskforce`
5. Plan: **Starter** (upgrade later)
6. **Save the Internal Database URL** (you'll need this)

#### Redis Cache
1. Render Dashboard → **New** → **Redis**
2. Name: `taskforce-redis`
3. Plan: **Starter**
4. **Save the Internal Redis URL**

---

### Step 2: Deploy Backend (10 minutes)

1. **Create Web Service**
   - Render Dashboard → **New** → **Web Service**
   - Connect your GitHub repository
   - **Root Directory**: `backend` (or leave blank if repo root)
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Starter

2. **Set Environment Variables**
   ```
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=<Internal Database URL from Step 1>
   REDIS_URL=<Internal Redis URL from Step 1>
   BACKEND_PUBLIC_URL=https://taskforce-backend.onrender.com
   GOOGLE_CLIENT_ID=<Your Google OAuth Client ID>
   GOOGLE_CLIENT_SECRET=<Your Google OAuth Client Secret>
   GOOGLE_REDIRECT_URI=https://taskforce-backend.onrender.com/api/auth/google/callback
   SESSION_SECRET=<Generate: openssl rand -base64 32>
   GOOGLE_EXTENSION_IDS=abbommimhkkkeiomeiegadjkdhhdieac
   ```

3. **Health Check**: `/health`

4. **Deploy** and wait for build to complete

---

### Step 3: Run Database Migrations (2 minutes)

1. Go to backend service → **Shell** (or use Render CLI)
2. Run:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
3. Wait for migrations to complete

---

### Step 4: Deploy Frontend (10 minutes)

1. **Create Web Service**
   - Render Dashboard → **New** → **Web Service**
   - Connect same GitHub repository
   - **Root Directory**: `webapp` (or leave blank if repo root)
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Starter

2. **Set Environment Variables**
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://taskforce-backend.onrender.com
   ```

3. **Health Check**: `/api/health`

4. **Deploy**

---

### Step 5: Configure Google OAuth (3 minutes)

1. **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Edit your OAuth 2.0 Client
3. **Add Authorized Redirect URIs**:
   - `https://taskforce-backend.onrender.com/api/auth/google/callback`
   - `https://abbommimhkkkeiomeiegadjkdhhdieac.chromiumapp.org/oauth2`
   - (Add your custom domain if you have one)

4. **Save**

---

## Environment Variables

### Backend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |
| `BACKEND_PUBLIC_URL` | Public backend URL | `https://api.yourdomain.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-xxx` |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | `https://api.yourdomain.com/api/auth/google/callback` |
| `SESSION_SECRET` | Session encryption key (32+ chars) | Generate with `openssl rand -base64 32` |
| `GOOGLE_EXTENSION_IDS` | Chrome extension IDs | `abbommimhkkkeiomeiegadjkdhhdieac` |

### Frontend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.yourdomain.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BETTER_AUTH_URL` | Auth service URL | Same as `BACKEND_PUBLIC_URL` |
| `BETTER_AUTH_SECRET` | Auth encryption secret | Auto-generated |
| `ENCRYPTION_KEY` | Data encryption key | Auto-generated |

---

## Database Setup

### Running Migrations

After deploying backend, run migrations:

```bash
# Via Render Shell
cd backend
npx prisma migrate deploy

# Or via Render CLI
render run --service taskforce-backend -- npx prisma migrate deploy
```

### Verifying Database

Check that all tables exist:

```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Should see: User, Campaign, MeetingBooking, etc.
```

---

## Google OAuth Configuration

### 1. Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Credentials**
3. **Create Credentials** → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. **Save Client ID and Secret**

### 2. Configure Redirect URIs

Add these **Authorized Redirect URIs**:

- Production: `https://your-backend-url.com/api/auth/google/callback`
- Extension: `https://abbommimhkkkeiomeiegadjkdhhdieac.chromiumapp.org/oauth2`
- Local (dev): `http://localhost:15004/api/auth/google/callback`

### 3. Enable APIs

Enable these APIs in Google Cloud Console:

- ✅ Gmail API
- ✅ Google Calendar API
- ✅ Google OAuth2 API

---

## Post-Deployment

### 1. Verify Services

**Backend Health Check:**
```bash
curl https://your-backend-url.com/health
# Should return: {"status":"ok","services":{"database":"ok","redis":"ok"}}
```

**Frontend:**
- Open your frontend URL
- Should load without errors

### 2. Test Authentication

1. Go to frontend URL
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Should redirect to dashboard

### 3. Test Core Features

- ✅ Send an email
- ✅ Create a campaign
- ✅ Connect calendar
- ✅ Create a meeting type
- ✅ Book a meeting

### 4. Monitor Logs

**Backend Logs:**
- Render Dashboard → Backend Service → **Logs**
- Watch for errors or warnings

**Frontend Logs:**
- Render Dashboard → Frontend Service → **Logs**
- Check for build/runtime errors

---

## Troubleshooting

### Backend Won't Start

**Check:**
1. Environment variables are set correctly
2. Database URL is correct (use internal URL, not public)
3. Redis URL is correct
4. Check logs for specific errors

**Common Issues:**
- `DATABASE_URL` wrong → Use internal database URL from Render
- `REDIS_URL` wrong → Use internal Redis URL from Render
- Migrations not run → Run `npx prisma migrate deploy`

### Frontend Can't Connect to Backend

**Check:**
1. `NEXT_PUBLIC_API_URL` is set correctly
2. Backend is running (check health endpoint)
3. CORS is configured (should be automatic)

**Fix:**
- Update `NEXT_PUBLIC_API_URL` to backend URL
- Restart frontend service

### Database Connection Errors

**Check:**
1. Database is running
2. Using internal database URL (not public)
3. Connection pool limits

**Fix:**
- Use Render's internal database URL
- Check database service status
- Verify connection string format

### Google OAuth Not Working

**Check:**
1. Client ID and Secret are correct
2. Redirect URI matches exactly
3. APIs are enabled in Google Cloud Console

**Fix:**
- Verify redirect URI in Google Console matches exactly
- Check OAuth credentials are correct
- Ensure Gmail and Calendar APIs are enabled

### Email Sending Fails

**Check:**
1. User has connected Google account
2. Gmail API quotas not exceeded
3. OAuth tokens are valid

**Fix:**
- Re-authenticate user
- Check Gmail API quotas
- Verify OAuth scopes include Gmail

---

## Scaling & Performance

### For High Traffic (1000+ Users)

#### Upgrade Plans
- **Backend**: Professional ($25/month) or higher
- **Database**: Professional ($20/month) or higher
- **Redis**: Professional ($15/month) or higher

#### Enable Auto-Scaling
- Backend: Min 2, Max 10 instances
- Monitor CPU/Memory and adjust

#### Database Optimization
- Use Render's connection pooler
- Update `DATABASE_URL` to pooler URL
- Monitor connection count

### Email Volume Considerations

**Gmail API Limits:**
- Daily Quota: 1 billion quota units
- Per Email: ~100 quota units
- Capacity: ~10 million emails/day per account

**For Millions of Emails:**
1. Use multiple Gmail accounts (distribute load)
2. Queue processing handles rate limiting automatically
3. Monitor quotas and set up alerts
4. Batch processing is already implemented

### Monitoring

**Set Up Alerts:**
- CPU > 80%
- Memory > 80%
- Error rate > 1%
- Database connections > 80% of limit
- Queue backlog > 1000 jobs

**Recommended Tools:**
- Render built-in metrics
- External monitoring (UptimeRobot, etc.)
- Log aggregation (optional)

---

## Custom Domains

### Backend Domain (e.g., `api.yourdomain.com`)

1. **Add Domain in Render**
   - Backend Service → **Settings** → **Custom Domains**
   - Add domain: `api.yourdomain.com`
   - Follow DNS instructions

2. **Update Environment Variables**
   - `BACKEND_PUBLIC_URL`: `https://api.yourdomain.com`
   - `GOOGLE_REDIRECT_URI`: `https://api.yourdomain.com/api/auth/google/callback`

3. **Update Google OAuth**
   - Add `https://api.yourdomain.com/api/auth/google/callback` to redirect URIs

### Frontend Domain (e.g., `app.yourdomain.com`)

1. **Add Domain in Render**
   - Frontend Service → **Settings** → **Custom Domains**
   - Add domain: `app.yourdomain.com`
   - Follow DNS instructions

2. **Update Environment Variables**
   - `NEXT_PUBLIC_API_URL`: `https://api.yourdomain.com`

---

## Security Checklist

- [x] All environment variables set
- [x] `SESSION_SECRET` is 32+ characters (strong)
- [x] Database uses internal URL (not publicly accessible)
- [x] Redis uses internal URL (not publicly accessible)
- [x] HTTPS enabled (automatic on Render)
- [x] Health checks configured
- [x] Rate limiting enabled
- [x] Security headers enabled
- [x] CORS properly configured
- [x] Google OAuth secrets are secure

---

## Backup Strategy

### Database Backups
- Render auto-backups (configure retention)
- Test restores periodically

### Code Backups
- Git repository (automatic)
- Keep secrets documented securely (use password manager)

---

## Quick Reference

### Service URLs
- **Backend**: `https://taskforce-backend.onrender.com`
- **Frontend**: `https://taskforce-webapp.onrender.com`
- **Health Check**: `https://taskforce-backend.onrender.com/health`

### Important Commands

```bash
# Run migrations
npx prisma migrate deploy

# Check backend health
curl https://your-backend-url.com/health

# View logs (Render CLI)
render logs --service taskforce-backend

# Restart service
render service:restart --service taskforce-backend
```

---

## Support

- **Render Docs**: https://render.com/docs
- **Application Logs**: Render Dashboard → Logs
- **Health Checks**: `/health`, `/ready`, `/live`

---

## ✅ Deployment Checklist

- [ ] Databases created (PostgreSQL + Redis)
- [ ] Backend deployed with all environment variables
- [ ] Database migrations run successfully
- [ ] Frontend deployed with API URL configured
- [ ] Google OAuth configured with correct redirect URIs
- [ ] Health checks passing
- [ ] Authentication tested
- [ ] Core features tested (email, campaigns, calendar, bookings)
- [ ] Custom domains configured (if applicable)
- [ ] Monitoring and alerts set up
- [ ] Backups configured

---

**Your application is now live! 🎉**

For issues or questions, check the [Troubleshooting](#troubleshooting) section above.



