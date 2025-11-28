# Railway Environment Variable Troubleshooting

## Problem: DATABASE_URL and REDIS_URL showing as empty strings

### Why this happens:
- Service references might not be set up correctly
- Variables were added but not connected to the services
- Railway hasn't resolved the service references yet

### How to Fix:

#### Option 1: Use Service References (Recommended)

1. Go to your **Backend service** in Railway
2. Click on **Variables** tab
3. Find `DATABASE_URL` and `REDIS_URL`
4. **Delete** them if they're empty
5. Click **"New Variable"** or **"Add Reference"**
6. For DATABASE_URL:
   - Click **"Add Reference"**
   - Select your **PostgreSQL service** (might be named "Postgres" or similar)
   - Select **"DATABASE_URL"** from the dropdown
   - Railway will add: `${{Postgres.DATABASE_URL}}`
7. For REDIS_URL:
   - Click **"Add Reference"**
   - Select your **Redis service**
   - Select **"REDIS_URL"** from the dropdown
   - Railway will add: `${{Redis.REDIS_URL}}`

#### Option 2: Copy Connection Strings Manually

1. **Get DATABASE_URL:**
   - Go to your **PostgreSQL service**
   - Click **Variables** tab
   - Find `DATABASE_URL`
   - Click the **copy icon** (or select and copy)
   - It should look like: `postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway`
   - Go back to **Backend service** → **Variables**
   - Add new variable: `DATABASE_URL` = (paste the value)

2. **Get REDIS_URL:**
   - Go to your **Redis service**
   - Click **Variables** tab
   - Find `REDIS_URL`
   - Click the **copy icon** (or select and copy)
   - It should look like: `redis://default:password@containers-us-west-xxx.railway.app:6379`
   - Go back to **Backend service** → **Variables**
   - Add new variable: `REDIS_URL` = (paste the value)

### Verify It's Working:

After adding the variables:

1. **Check the Variables tab:**
   - `DATABASE_URL` should show a long connection string (not empty)
   - `REDIS_URL` should show a connection string (not empty)

2. **Check the logs:**
   - Go to **Backend service** → **Deployments** → **View Logs**
   - Look for:
     - ✅ `DATABASE_URL not set, skipping migrations` (should NOT appear if configured)
     - ✅ `Redis not available` (should NOT appear if configured)
     - ✅ `Database migrations completed` (should appear if DATABASE_URL is set)
     - ✅ `Redis connected` (should appear if REDIS_URL is set)

3. **Check health endpoint:**
   - Visit: `https://your-backend.railway.app/health`
   - Should show:
     ```json
     {
       "status": "ok",
       "services": {
         "database": "ok",  // Should be "ok", not "not_configured"
         "redis": "ok"      // Should be "ok", not "not_configured"
       }
     }
     ```

### Common Issues:

**Issue:** Service reference shows as `${{Postgres.DATABASE_URL}}` but still empty
- **Fix:** Make sure the PostgreSQL service is actually created and running
- **Fix:** Try using the manual copy method instead

**Issue:** Variables show correct values but app still says "not configured"
- **Fix:** Railway needs to redeploy. Wait 1-2 minutes after saving variables
- **Fix:** Check if variables are in the correct service (Backend, not Frontend)

**Issue:** Can't find the PostgreSQL/Redis service
- **Fix:** Make sure you created them first:
  - Click **"New"** → **"Database"** → **"Add PostgreSQL"**
  - Click **"New"** → **"Database"** → **"Add Redis"**

### What Empty Strings Mean:

- ❌ Empty string = Not configured = Database/Redis won't work
- ✅ Connection string = Configured = Database/Redis will work
- ✅ Service reference = Configured = Database/Redis will work (and auto-updates)

### After Fixing:

1. Railway will automatically redeploy your backend
2. Wait 2-3 minutes for deployment
3. Check logs to confirm database migrations ran
4. Check health endpoint to confirm services are connected
5. Your app should now be fully functional!


