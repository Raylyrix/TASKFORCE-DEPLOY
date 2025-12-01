# Migration Guide - December 1, 2024

## Issue
The database is missing the `folderId` and `gmailLabelId` columns on the `Campaign` table, and the `CampaignFolder` table doesn't exist. This causes errors when querying campaigns.

## Error
```
Invalid `prisma.campaign.findMany()` invocation:
The column `Campaign.folderId` does not exist in the current database.
```

## Solution

### Step 1: Run the Migration

The migration file has been created at:
```
backend/prisma/migrations/20241201000000_add_campaign_folders/migration.sql
```

To apply the migration:

**Option A: Using Prisma Migrate (Recommended)**
```bash
cd backend
npx prisma migrate deploy
```

**Option B: Manual SQL Execution**
If you have direct database access, you can run the SQL file directly:
```bash
psql -h <host> -U <user> -d <database> -f prisma/migrations/20241201000000_add_campaign_folders/migration.sql
```

### Step 2: Regenerate Prisma Client
After running the migration, regenerate the Prisma client:
```bash
cd backend
npx prisma generate
```

### Step 3: Restart the Backend
Restart your backend server to pick up the new Prisma client.

## What the Migration Does

1. Creates the `CampaignFolder` table if it doesn't exist
2. Adds `folderId` column to `Campaign` table (if missing)
3. Adds `gmailLabelId` column to `Campaign` table (if missing)
4. Creates necessary indexes
5. Adds foreign key constraints

## Code Changes

The code has been updated to handle the missing columns gracefully:
- `listCampaignsForUser` now catches errors and retries without folder relation if columns don't exist
- This provides backward compatibility until the migration is run

## Verification

After running the migration, verify it worked:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Campaign' 
AND column_name IN ('folderId', 'gmailLabelId');
```

You should see both columns listed.

