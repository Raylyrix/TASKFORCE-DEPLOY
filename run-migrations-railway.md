# Step-by-Step Guide to Run Migrations on Railway

## Current Status
✅ Build is working successfully
✅ Container is running
❌ Migrations need to be executed

## Why Migrations Aren't Running
Railway is using RAILPACK which runs migrations during build (when DATABASE_URL isn't available). Migrations need to run at runtime when DATABASE_URL is available.

## Solution: Run Migrations via Railway CLI

### Step 1: Verify Railway CLI Setup
Open PowerShell and run:
```powershell
railway status
```

You should see:
```
Project: patient-passion
Environment: production
Service: taskforce-backend
```

### Step 2: Run Migrations

**Option A: Using Railway Shell (Recommended)**

```powershell
# Navigate to backend directory
cd C:\Users\hp\Downloads\TASKFORCE-PRODUCTION-main\TASKFORCE-PRODUCTION-main\backend

# Run migrations in Railway environment
railway run --service taskforce-backend npx prisma migrate deploy
```

**Option B: Direct Command**

```powershell
railway run --service taskforce-backend --directory backend npx prisma migrate deploy
```

**Option C: If the above don't work, try:**

```powershell
railway service taskforce-backend
railway run sh -c "cd backend && npx prisma migrate deploy"
```

### Step 3: Verify Migrations Ran

After running migrations, check logs:
```powershell
railway logs --service taskforce-backend --lines 50
```

You should see:
- Migration messages like "Applying migration..."
- No more errors about missing tables (EmailSnooze, ScheduledEmail, etc.)
- "Backend service listening" message

### Step 4: If Migrations Succeed

Once migrations complete, your backend will be fully functional! The errors about missing tables will stop.

## Alternative: If CLI Doesn't Work

If Railway CLI commands don't work, you'll need to:

1. **Create a temporary migration service in Railway Dashboard:**
   - Go to Railway Dashboard
   - Create new service from same GitHub repo
   - Set root directory to `backend`
   - Set start command to: `npx prisma migrate deploy`
   - Run it once
   - Delete the service after migrations complete

2. **Or modify the Dockerfile to run migrations on every startup** (already done, but may not be executing)

## Troubleshooting

If migrations fail:
- Check DATABASE_URL is set correctly: `railway variables --service taskforce-backend | Select-String DATABASE_URL`
- Verify database service is running: `railway status`
- Check migration files exist: `ls backend/prisma/migrations`


