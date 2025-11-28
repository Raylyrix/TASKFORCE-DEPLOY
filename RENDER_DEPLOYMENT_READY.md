# Render Deployment - Ready for Production

## ✅ Deployment Checklist

### 1. Email Auto-Detection Feature
- ✅ Added Google Identity Services integration
- ✅ Auto-detects logged-in Google account
- ✅ Shows "Continue as [email]" button
- ✅ Falls back to manual login if detection fails
- **Environment Variable Required**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (must match backend `GOOGLE_CLIENT_ID`)

### 2. Render Configuration
- ✅ `render.yaml` configured with all services
- ✅ Build commands optimized
- ✅ Environment variables properly configured
- ✅ Health check paths set
- ✅ Auto-deploy enabled

## Environment Variables Setup

### Backend Service (`taskforce-backend`)

**Required Variables:**
```env
NODE_ENV=production
PORT=4000  # Render sets automatically, but can override
DATABASE_URL=<auto-set from database service>
REDIS_URL=<auto-set from redis service>
BACKEND_PUBLIC_URL=https://taskforce-backend.onrender.com
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
GOOGLE_REDIRECT_URI=https://taskforce-backend.onrender.com/api/auth/google/callback
SESSION_SECRET=<generate-secure-random-string-min-16-chars>
GOOGLE_EXTENSION_IDS=<optional-comma-separated-extension-ids>
```

**Optional but Recommended:**
```env
ENCRYPTION_KEY=<32-char-hex-string>
ENCRYPTION_SALT=<random-salt>
CLEAR_RATE_LIMITS_ON_STARTUP=false  # Set to true only if needed
DISABLE_RATE_LIMIT=false  # Keep false in production
```

### Frontend Service (`taskforce-webapp`)

**Required Variables:**
```env
NODE_ENV=production
PORT=3000  # Render sets automatically
NEXT_PUBLIC_API_URL=https://taskforce-backend.onrender.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same-as-backend-GOOGLE_CLIENT_ID>
```

## Deployment Steps

### Step 1: Create Services in Render Dashboard

1. **PostgreSQL Database**
   - Name: `taskforce-db`
   - Plan: Starter
   - PostgreSQL Version: 16
   - Database Name: `taskforce`
   - User: `taskforce`

2. **Redis Instance**
   - Name: `taskforce-redis`
   - Plan: Starter
   - Max Memory Policy: `allkeys-lru`

3. **Backend Web Service**
   - Name: `taskforce-backend`
   - Environment: Node
   - Plan: Starter
   - Root Directory: `backend`
   - Build Command: `npm ci && npx prisma generate && npm run build && npx prisma migrate deploy`
   - Start Command: `npm start`
   - Health Check Path: `/health`

4. **Frontend Web Service**
   - Name: `taskforce-webapp`
   - Environment: Node
   - Plan: Starter
   - Root Directory: `webapp`
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`

### Step 2: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable Google+ API and Gmail API
4. Create OAuth 2.0 Credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     - `https://taskforce-backend.onrender.com/api/auth/google/callback`
     - Your frontend URL (if using extension redirects)
5. Copy Client ID and Client Secret

### Step 3: Set Environment Variables

**Backend:**
- Set all variables from the "Backend Service" section above
- Use Render's environment variable UI or `render.yaml`

**Frontend:**
- Set `NEXT_PUBLIC_API_URL` to your backend URL
- Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to match backend's `GOOGLE_CLIENT_ID`

### Step 4: Deploy

1. Connect your GitHub repository to Render
2. Render will automatically detect `render.yaml`
3. Services will be created automatically
4. First deployment will:
   - Install dependencies
   - Run database migrations
   - Build and start services

### Step 5: Verify Deployment

1. **Health Checks:**
   - Backend: `https://taskforce-backend.onrender.com/health`
   - Frontend: `https://taskforce-webapp.onrender.com/api/health`

2. **Test Login:**
   - Visit frontend URL
   - Should see email auto-detection (if logged into Google)
   - Click "Continue" to auto-login
   - Or click "Use a different account" for manual login

3. **Test Features:**
   - Create a campaign
   - Send test emails
   - Check analytics
   - Verify bookings

## Features Ready for Production

✅ **Email Auto-Detection**
- Automatically detects Google account
- One-click login with detected email
- Graceful fallback to manual login

✅ **Database Migrations**
- Automatically run on deployment
- Prisma migrations included in build

✅ **Health Checks**
- Backend: `/health`
- Frontend: `/api/health`
- Excluded from rate limiting

✅ **Rate Limiting**
- Production limits: 100 req/min (IP), 200 req/min (user)
- Health checks excluded
- Redis-backed for scalability

✅ **Error Handling**
- Graceful error messages
- Automatic redirects on auth failures
- Proper error logging

✅ **Security**
- OAuth state stored in Redis
- Session secrets auto-generated
- Environment variables properly secured

## Troubleshooting

### Email Auto-Detection Not Working
- Verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set in frontend
- Check browser console for errors
- Ensure Google Identity Services script loads
- Fallback to manual login will still work

### Build Failures
- Check Node.js version (should be 18+)
- Verify all dependencies in `package.json`
- Check build logs for specific errors
- Ensure database is accessible during build

### Database Connection Issues
- Verify `DATABASE_URL` is correctly set
- Check database service is running
- Review backend logs for connection errors
- Ensure migrations completed successfully

### OAuth Errors
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` match
- Check `GOOGLE_REDIRECT_URI` matches Google Cloud Console
- Ensure `BACKEND_PUBLIC_URL` is correct
- Check OAuth state expiration (15 minutes)

## Performance Optimizations

- React Query caching (5 min stale time)
- Rate limiting prevents abuse
- Health checks excluded from rate limits
- Database connection pooling
- Redis caching for labels and campaigns

## Monitoring

- Check Render dashboard for service status
- Monitor health check endpoints
- Review application logs
- Track rate limit headers: `X-RateLimit-Remaining`

## Next Steps After Deployment

1. Set up custom domain (optional)
2. Configure SSL certificates (automatic with Render)
3. Set up monitoring and alerts
4. Configure backup strategy for database
5. Set up CI/CD for automatic deployments

---

**Status**: ✅ Ready for Production Deployment



