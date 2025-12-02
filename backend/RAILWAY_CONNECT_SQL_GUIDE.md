# Using Railway Connect to Run SQL Queries

## Step-by-Step Guide

### Step 1: Connect to Database

Open PowerShell and run:

```powershell
railway connect taskforce-db
```

This will open a PostgreSQL shell (psql) connected to your Railway database.

### Step 2: Run SQL Queries

Once connected, you'll see a prompt like:
```
railway=>
```

You can now run SQL commands directly!

### Step 3: Create UnsubscribeRecord Table

Copy and paste this entire SQL block:

```sql
-- Create UnsubscribeRecord Table
CREATE TABLE IF NOT EXISTS "UnsubscribeRecord" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "campaignId" TEXT,
    "sendingDomainId" TEXT,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnsubscribeRecord_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "UnsubscribeRecord_email_campaignId_key" ON "UnsubscribeRecord"("email", "campaignId");

-- Create indexes
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_email_idx" ON "UnsubscribeRecord"("email");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_campaignId_idx" ON "UnsubscribeRecord"("campaignId");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_sendingDomainId_idx" ON "UnsubscribeRecord"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_createdAt_idx" ON "UnsubscribeRecord"("createdAt");

-- Add foreign keys
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='Campaign') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'UnsubscribeRecord_campaignId_fkey'
        ) THEN
            ALTER TABLE "UnsubscribeRecord" 
            ADD CONSTRAINT "UnsubscribeRecord_campaignId_fkey" 
            FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='SendingDomain') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'UnsubscribeRecord_sendingDomainId_fkey'
        ) THEN
            ALTER TABLE "UnsubscribeRecord" 
            ADD CONSTRAINT "UnsubscribeRecord_sendingDomainId_fkey" 
            FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
```

**Note**: In psql, you need to end statements with a semicolon (`;`). The `DO $$` blocks also need semicolons.

### Step 4: Verify Table Was Created

Run this query to check:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'UnsubscribeRecord';
```

You should see `UnsubscribeRecord` in the results.

### Step 5: Check if SendingDomain Tables Exist (Optional)

To verify all the email deliverability tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('SendingDomain', 'DomainReputation', 'EmailBounce', 'EmailComplaint', 'EmailWarmup', 'UnsubscribeRecord')
ORDER BY table_name;
```

### Step 6: Exit psql

When done, type:
```
\q
```

Or press `Ctrl+D`

---

## Quick Reference: psql Commands

- `\dt` - List all tables
- `\d table_name` - Describe a table structure
- `\l` - List all databases
- `\c database_name` - Connect to a database
- `\q` - Quit psql
- `\?` - Show help

---

## Alternative: Run SQL File

If you have a SQL file, you can also run it directly:

```powershell
railway connect taskforce-db < backend/CREATE_UNSUBSCRIBE_RECORD_TABLE.sql
```

Or from within psql:

```sql
\i backend/CREATE_UNSUBSCRIBE_RECORD_TABLE.sql
```

---

## Troubleshooting

**If `railway connect` doesn't work:**
- Make sure Railway CLI is installed: `railway --version`
- Make sure you're logged in: `railway login`
- Make sure you're in the right project: `railway link`

**If SQL gives errors:**
- Make sure you're using double quotes for identifiers: `"UnsubscribeRecord"` not `UnsubscribeRecord`
- Make sure statements end with semicolons
- Check that referenced tables (Campaign, SendingDomain) exist first

---

## What This Fixes

After creating the `UnsubscribeRecord` table:
- ✅ No more `UnsubscribeRecord` errors in logs
- ✅ Unsubscribe functionality will work
- ✅ All email-related features will be complete

