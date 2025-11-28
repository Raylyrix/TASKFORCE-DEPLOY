# How to Run Migrations on Railway

## ✅ Build Status: SUCCESS!
The backend service is now building and running successfully!

## Running Migrations

### Option 1: Via Railway Dashboard (Recommended)

1. Go to https://railway.app and open your project
2. Click on the **taskforce-backend** service
3. Go to the **Deployments** tab
4. Click on the latest deployment
5. Click **"View Logs"** or **"Shell"** button
6. In the terminal/console, run:
   ```bash
   npx prisma migrate deploy
   ```

### Option 2: Via Railway CLI (Alternative)

```bash
# Make sure you're linked to the correct service
railway service taskforce-backend

# Run migrations in Railway environment
railway run --service taskforce-backend --detach npx prisma migrate deploy
```

### Option 3: One-time Migration Service

You can also create a temporary migration service in Railway:
1. Create a new service from the same repo
2. Set root directory to `backend`
3. Use start command: `npx prisma migrate deploy`
4. Run it once, then delete the service

## Verify Migrations

After running migrations, check the logs:
```bash
railway logs --service taskforce-backend --lines 50
```

You should no longer see errors about missing tables like:
- `EmailSnooze`
- `ScheduledEmail`
- `CalendarConnection`

## Next Steps

After migrations complete:
1. ✅ Backend will be fully functional
2. Deploy webapp service
3. Configure environment variables
4. Test the application

