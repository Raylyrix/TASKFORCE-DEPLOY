# Render Database Setup Instructions

## ⚠️ Important: Database Plan Configuration

Render no longer supports specifying database plans in `render.yaml` for new databases. Legacy plan names (`starter`, `professional`, `pro`) are not accepted.

## Solution: Manual Database Creation

You have two options:

### Option 1: Create Database Manually (Recommended)

1. **Go to Render Dashboard**
   - Navigate to your Render account
   - Click "New +" → "PostgreSQL"

2. **Configure Database:**
   - Name: `taskforce-db`
   - Database: `taskforce`
   - User: `taskforce`
   - Plan: Select your desired plan (Professional, Business, etc.)
   - PostgreSQL Version: 16
   - Region: Choose your preferred region

3. **Create the Database**

4. **Update render.yaml:**
   - The `render.yaml` file now references the database by name
   - No `plan` field is needed - it's already set in the dashboard

5. **Sync Blueprint:**
   - Render will automatically connect your services to the existing database

### Option 2: Remove Database from render.yaml

If you want to manage everything manually:

1. **Remove the `databases` section from `render.yaml`**
2. **Create database manually in dashboard**
3. **Set `DATABASE_URL` environment variable manually** in your backend service

## Current render.yaml Configuration

The `render.yaml` file now has the database section without the `plan` field:

```yaml
databases:
  - name: taskforce-db
    databaseName: taskforce
    user: taskforce
    postgresMajorVersion: 16
```

This will work if:
- The database `taskforce-db` already exists in your Render account
- OR Render will create it with default settings (you can upgrade the plan later in dashboard)

## Steps to Deploy

1. **Create Database First** (if not exists):
   - Go to Render Dashboard
   - Create PostgreSQL database with name `taskforce-db`
   - Set plan to Professional (or your preferred plan)

2. **Deploy Services:**
   - Connect your GitHub repo to Render
   - Render will detect `render.yaml`
   - Services will connect to the existing database

3. **Verify Connection:**
   - Check backend logs for database connection
   - Verify migrations ran successfully

## Troubleshooting

**Error: "Legacy Postgres plans are no longer supported"**
- ✅ **Fixed**: Removed `plan` field from `render.yaml`
- Create database manually in dashboard with your desired plan

**Error: "Database not found"**
- Make sure database name in dashboard matches `taskforce-db`
- Or update `render.yaml` to match your actual database name

**Database Connection Issues:**
- Verify `DATABASE_URL` is correctly set (auto-set from database service)
- Check database is running in Render dashboard
- Review backend logs for connection errors

---

**Status**: ✅ `render.yaml` updated - database plan must be set manually in Render Dashboard



