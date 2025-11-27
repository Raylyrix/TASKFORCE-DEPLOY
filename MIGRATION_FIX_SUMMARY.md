# Migration Fix Summary

## Issues Fixed

### 1. Failed Database Migration
**Problem:** The migration `20251112153000_meeting_reminders` failed and was blocking new migrations from running.

**Solution:** Updated `backend/src/server.ts` to automatically resolve failed migrations before running new ones:
- On server startup, the migration script now attempts to resolve the failed migration as "rolled-back"
- This is safe to run multiple times - it only affects migrations that are actually in a failed state
- After resolution, normal migrations proceed

**Code Changes:**
- `backend/src/server.ts`: Added migration resolution logic in `runMigrations()` function
- The resolution happens before `prisma migrate deploy` is called

### 2. Webapp Service Configuration
**Problem:** The webapp service might not have proper Railway configuration.

**Solution:** Created `webapp/railway.json` to ensure correct build and start commands:
- Build command: `npm ci && npm run build`
- Start command: `npm start -p ${PORT:-3000}`
- Health check path: `/api/health`

## Next Steps

1. **Verify Migration Resolution:**
   - After the backend redeploys, check the logs to see if the migration was resolved
   - The migration should complete successfully and create the missing tables

2. **Verify Webapp Configuration:**
   - Ensure Railway is using the `webapp/railway.json` configuration
   - If not, manually set the root directory to `webapp` in Railway Dashboard

3. **Monitor Deployment:**
   - Check both services are deploying successfully
   - Verify health checks are passing
   - Confirm database tables are created

## Expected Behavior

After these fixes:
- ✅ Backend should resolve the failed migration on startup
- ✅ All database tables should be created (ScheduledEmail, EmailSnooze, CalendarConnection, MeetingReminder)
- ✅ Background tasks should work without "table does not exist" errors
- ✅ Webapp should use correct Next.js build/start commands

