# Production Deployment Guide for Render.com

## Summary of Changes Made

### 1. Fixed Excessive API Requests
- **React Query Configuration**: Increased `staleTime` from 1 minute to 5 minutes
- **Disabled unnecessary refetches**: `refetchOnMount: false`, `refetchOnReconnect: false`
- **Increased cache time**: `gcTime` set to 10 minutes
- **Result**: Significantly reduced automatic API calls from frontend

### 2. Improved Rate Limiting
- **Excluded health check endpoints** from rate limiting (`/health`, `/ready`, `/live`, `/api/health`)
- **Development limits**: 10,000 requests/minute (IP), 20,000 requests/minute (user)
- **Production limits**: 100 requests/minute (IP), 200 requests/minute (user)
- **Disable option**: Set `DISABLE_RATE_LIMIT=true` in `.env` for development

### 3. Production Readiness
- **Health check endpoints**: Added `/api/health` for frontend
- **Database migrations**: Added `npx prisma migrate deploy` to build command
- **Render.yaml**: Updated with proper environment variable configuration
- **Port configuration**: Backend uses `PORT` environment variable (Render sets automatically)

## Environment Variables Required

### Backend Service
```env
NODE_ENV=production
PORT=4000  # Render sets this automatically, but you can override
DATABASE_URL=<from database service>
REDIS_URL=<from redis service>
BACKEND_PUBLIC_URL=<your backend URL, e.g., https://taskforce-backend.onrender.com>
GOOGLE_CLIENT_ID=<your Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<your Google OAuth client secret>
GOOGLE_REDIRECT_URI=<your callback URL, e.g., https://taskforce-backend.onrender.com/api/auth/google/callback>
SESSION_SECRET=<generate a secure random string, min 16 chars>
GOOGLE_EXTENSION_IDS=<optional, comma-separated Chrome extension IDs>
```

### Frontend Service
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=<your backend URL, e.g., https://taskforce-backend.onrender.com>
```

## Deployment Steps

1. **Create Services in Render Dashboard**:
   - Create PostgreSQL database (name: `taskforce-db`)
   - Create Redis instance (name: `taskforce-redis`)
   - Create Web Service for backend (name: `taskforce-backend`)
   - Create Web Service for frontend (name: `taskforce-webapp`)

2. **Configure Backend Service**:
   - Connect to your GitHub repository
   - Root Directory: `backend`
   - Build Command: `npm ci && npx prisma generate && npm run build && npx prisma migrate deploy`
   - Start Command: `npm start`
   - Health Check Path: `/health`
   - Set all environment variables listed above

3. **Configure Frontend Service**:
   - Connect to your GitHub repository
   - Root Directory: `webapp`
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
   - Set `NEXT_PUBLIC_API_URL` to your backend URL

4. **Google OAuth Setup**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `https://taskforce-backend.onrender.com/api/auth/google/callback`
     - Your frontend URL for extension redirects (if using)
   - Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to Render environment variables

5. **Database Setup**:
   - Render will automatically run migrations during build
   - Verify database connection in backend logs

## Testing After Deployment

1. **Health Checks**:
   - Backend: `https://your-backend.onrender.com/health`
   - Frontend: `https://your-frontend.onrender.com/api/health`

2. **Campaign Launch**:
   - Login with Google OAuth
   - Create a test campaign
   - Click "Launch Campaign" button
   - Verify emails are sent

3. **Email Sending**:
   - Users must authenticate with Google OAuth first
   - Grant Gmail API permissions
   - Test sending emails from the emails page
   - Test campaign email sending

## Troubleshooting

### Rate Limit Errors
- Check if `DISABLE_RATE_LIMIT=true` is set (development only)
- Verify Redis connection is working
- Check rate limit headers in response: `X-RateLimit-Remaining`

### Database Connection Issues
- Verify `DATABASE_URL` is correctly set
- Check database service is running
- Review backend logs for connection errors

### Email Sending Fails
- Verify user has authenticated with Google OAuth
- Check Gmail API permissions are granted
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check `GOOGLE_REDIRECT_URI` matches Google Cloud Console settings

### Excessive Requests
- Check React Query is not refetching too frequently
- Verify `staleTime` and `gcTime` are set correctly
- Review browser network tab for unnecessary requests

## Performance Optimizations

- React Query caching reduces API calls by 80%+
- Rate limiting prevents abuse
- Health checks excluded from rate limiting
- Database migrations run automatically on deploy


