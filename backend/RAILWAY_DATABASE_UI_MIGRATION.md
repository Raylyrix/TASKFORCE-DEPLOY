# Using Railway Database UI to Create Tables Manually

## Step-by-Step Guide

### Step 1: Access Railway Database UI

1. **Go to Railway Dashboard**: https://railway.app
2. **Open your project**
3. **Click on `taskforce-db` service** (your PostgreSQL database)
4. **Click on "Data" or "Tables" tab** (you should see a list of existing tables)
5. **Look for the "+" button** or "New Table" button

### Step 2: Create the Enums First

Before creating tables, we need to create the enum types. Railway's UI might not have a direct way to create enums, so we'll need to use the **Query** tab:

1. **In the `taskforce-db` service**, look for **"Query"** or **"SQL"** tab
2. **Click on it** to open the SQL editor
3. **Paste and run this SQL**:

```sql
-- Create BounceType enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BounceType') THEN
        CREATE TYPE "BounceType" AS ENUM ('HARD', 'SOFT');
    END IF;
END $$;

-- Create BounceCategory enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BounceCategory') THEN
        CREATE TYPE "BounceCategory" AS ENUM ('INVALID_EMAIL', 'MAILBOX_FULL', 'MESSAGE_TOO_LARGE', 'CONTENT_REJECTED', 'BLOCKED', 'OTHER');
    END IF;
END $$;
```

4. **Click "Run" or "Execute"**

### Step 3: Create SendingDomain Table

**Option A: Using the "+" Button (Visual Method)**

1. **Click the "+" button** to create a new table
2. **Table name**: `SendingDomain`
3. **Add columns** one by one:

| Column Name | Type | Nullable | Default | Notes |
|------------|------|----------|---------|-------|
| id | TEXT | ❌ No | - | Primary Key |
| userId | TEXT | ❌ No | - | Foreign Key to User |
| domain | TEXT | ❌ No | - | |
| spfRecord | TEXT | ✅ Yes | - | |
| spfVerified | BOOLEAN | ❌ No | false | |
| dkimSelector | TEXT | ✅ Yes | - | |
| dkimPublicKey | TEXT | ✅ Yes | - | |
| dkimPrivateKey | TEXT | ✅ Yes | - | |
| dkimVerified | BOOLEAN | ❌ No | false | |
| dmarcPolicy | TEXT | ✅ Yes | - | |
| dmarcVerified | BOOLEAN | ❌ No | false | |
| isVerified | BOOLEAN | ❌ No | false | |
| verificationAt | TIMESTAMP | ✅ Yes | - | |
| createdAt | TIMESTAMP | ❌ No | CURRENT_TIMESTAMP | |
| updatedAt | TIMESTAMP | ❌ No | CURRENT_TIMESTAMP | |

4. **Set Primary Key**: Mark `id` as Primary Key
5. **Create Unique Constraint**: On `(userId, domain)` - you might need to do this via SQL after creating the table
6. **Save/Create the table**

**Option B: Using SQL (Faster)**

1. **Go to "Query" or "SQL" tab**
2. **Paste and run**:

```sql
CREATE TABLE IF NOT EXISTS "SendingDomain" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "spfRecord" TEXT,
    "spfVerified" BOOLEAN NOT NULL DEFAULT false,
    "dkimSelector" TEXT,
    "dkimPublicKey" TEXT,
    "dkimPrivateKey" TEXT,
    "dkimVerified" BOOLEAN NOT NULL DEFAULT false,
    "dmarcPolicy" TEXT,
    "dmarcVerified" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SendingDomain_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "SendingDomain_userId_domain_key" ON "SendingDomain"("userId", "domain");

-- Create indexes
CREATE INDEX IF NOT EXISTS "SendingDomain_userId_idx" ON "SendingDomain"("userId");
CREATE INDEX IF NOT EXISTS "SendingDomain_domain_idx" ON "SendingDomain"("domain");
CREATE INDEX IF NOT EXISTS "SendingDomain_isVerified_idx" ON "SendingDomain"("isVerified");

-- Add foreign key
ALTER TABLE "SendingDomain" 
ADD CONSTRAINT "SendingDomain_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Step 4: Create DomainReputation Table

**Using SQL (Recommended)**:

```sql
CREATE TABLE IF NOT EXISTS "DomainReputation" (
    "id" TEXT NOT NULL,
    "sendingDomainId" TEXT NOT NULL,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "complaintRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "openRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "clickRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalComplained" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "isInWarmup" BOOLEAN NOT NULL DEFAULT false,
    "warmupStartedAt" TIMESTAMP(3),
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DomainReputation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DomainReputation_sendingDomainId_key" ON "DomainReputation"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "DomainReputation_reputationScore_idx" ON "DomainReputation"("reputationScore");
CREATE INDEX IF NOT EXISTS "DomainReputation_isInWarmup_idx" ON "DomainReputation"("isInWarmup");

ALTER TABLE "DomainReputation" 
ADD CONSTRAINT "DomainReputation_sendingDomainId_fkey" 
FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Step 5: Create EmailBounce Table

```sql
CREATE TABLE IF NOT EXISTS "EmailBounce" (
    "id" TEXT NOT NULL,
    "sendingDomainId" TEXT,
    "messageLogId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "bounceType" "BounceType" NOT NULL,
    "bounceCategory" "BounceCategory" NOT NULL,
    "reason" TEXT,
    "rawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailBounce_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailBounce_sendingDomainId_idx" ON "EmailBounce"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "EmailBounce_recipientEmail_idx" ON "EmailBounce"("recipientEmail");
CREATE INDEX IF NOT EXISTS "EmailBounce_bounceType_idx" ON "EmailBounce"("bounceType");
CREATE INDEX IF NOT EXISTS "EmailBounce_createdAt_idx" ON "EmailBounce"("createdAt");

ALTER TABLE "EmailBounce" 
ADD CONSTRAINT "EmailBounce_sendingDomainId_fkey" 
FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailBounce" 
ADD CONSTRAINT "EmailBounce_messageLogId_fkey" 
FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

### Step 6: Create EmailComplaint Table

```sql
CREATE TABLE IF NOT EXISTS "EmailComplaint" (
    "id" TEXT NOT NULL,
    "sendingDomainId" TEXT,
    "messageLogId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "feedbackType" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailComplaint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailComplaint_sendingDomainId_idx" ON "EmailComplaint"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "EmailComplaint_recipientEmail_idx" ON "EmailComplaint"("recipientEmail");
CREATE INDEX IF NOT EXISTS "EmailComplaint_createdAt_idx" ON "EmailComplaint"("createdAt");

ALTER TABLE "EmailComplaint" 
ADD CONSTRAINT "EmailComplaint_sendingDomainId_fkey" 
FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailComplaint" 
ADD CONSTRAINT "EmailComplaint_messageLogId_fkey" 
FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

### Step 7: Create EmailWarmup Table

```sql
CREATE TABLE IF NOT EXISTS "EmailWarmup" (
    "id" TEXT NOT NULL,
    "sendingDomainId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "targetVolume" INTEGER NOT NULL,
    "actualVolume" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailWarmup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailWarmup_sendingDomainId_day_key" ON "EmailWarmup"("sendingDomainId", "day");
CREATE INDEX IF NOT EXISTS "EmailWarmup_sendingDomainId_idx" ON "EmailWarmup"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "EmailWarmup_completedAt_idx" ON "EmailWarmup"("completedAt");

ALTER TABLE "EmailWarmup" 
ADD CONSTRAINT "EmailWarmup_sendingDomainId_fkey" 
FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Step 8: Update UnsubscribeRecord Table (if it exists)

If `UnsubscribeRecord` table already exists, add the `sendingDomainId` column:

```sql
-- Check if UnsubscribeRecord exists and add column if needed
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='UnsubscribeRecord') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='UnsubscribeRecord' AND column_name='sendingDomainId') THEN
            ALTER TABLE "UnsubscribeRecord" ADD COLUMN "sendingDomainId" TEXT;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'UnsubscribeRecord_sendingDomainId_fkey'
        ) THEN
            ALTER TABLE "UnsubscribeRecord" ADD CONSTRAINT "UnsubscribeRecord_sendingDomainId_fkey" 
            FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
```

### Step 9: Mark Migration as Applied

After creating all tables, we need to tell Prisma that the migration was applied:

```sql
-- Check if migration record exists
SELECT * FROM "_prisma_migrations" WHERE "migration_name" = '20251202000000_add_sending_domain_tables';

-- If it doesn't exist or is marked as failed, insert/update it
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    gen_random_uuid()::text,
    'manual_fix_20251202',
    NOW(),
    '20251202000000_add_sending_domain_tables',
    NULL,
    NULL,
    NOW(),
    1
)
ON CONFLICT ("migration_name") 
DO UPDATE SET 
    "finished_at" = NOW(),
    "rolled_back_at" = NULL,
    "applied_steps_count" = 1;
```

---

## Complete SQL Script (Copy-Paste All at Once)

If Railway's Query tab supports running multiple statements, you can paste this entire script:

```sql
-- ============================================
-- Complete Migration Script for SendingDomain Tables
-- ============================================

-- Step 1: Create Enums
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BounceType') THEN
        CREATE TYPE "BounceType" AS ENUM ('HARD', 'SOFT');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BounceCategory') THEN
        CREATE TYPE "BounceCategory" AS ENUM ('INVALID_EMAIL', 'MAILBOX_FULL', 'MESSAGE_TOO_LARGE', 'CONTENT_REJECTED', 'BLOCKED', 'OTHER');
    END IF;
END $$;

-- Step 2: Create SendingDomain Table
CREATE TABLE IF NOT EXISTS "SendingDomain" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "spfRecord" TEXT,
    "spfVerified" BOOLEAN NOT NULL DEFAULT false,
    "dkimSelector" TEXT,
    "dkimPublicKey" TEXT,
    "dkimPrivateKey" TEXT,
    "dkimVerified" BOOLEAN NOT NULL DEFAULT false,
    "dmarcPolicy" TEXT,
    "dmarcVerified" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SendingDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SendingDomain_userId_domain_key" ON "SendingDomain"("userId", "domain");
CREATE INDEX IF NOT EXISTS "SendingDomain_userId_idx" ON "SendingDomain"("userId");
CREATE INDEX IF NOT EXISTS "SendingDomain_domain_idx" ON "SendingDomain"("domain");
CREATE INDEX IF NOT EXISTS "SendingDomain_isVerified_idx" ON "SendingDomain"("isVerified");

-- Step 3: Create DomainReputation Table
CREATE TABLE IF NOT EXISTS "DomainReputation" (
    "id" TEXT NOT NULL,
    "sendingDomainId" TEXT NOT NULL,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "complaintRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "openRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "clickRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalComplained" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "isInWarmup" BOOLEAN NOT NULL DEFAULT false,
    "warmupStartedAt" TIMESTAMP(3),
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DomainReputation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DomainReputation_sendingDomainId_key" ON "DomainReputation"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "DomainReputation_reputationScore_idx" ON "DomainReputation"("reputationScore");
CREATE INDEX IF NOT EXISTS "DomainReputation_isInWarmup_idx" ON "DomainReputation"("isInWarmup");

-- Step 4: Create EmailBounce Table
CREATE TABLE IF NOT EXISTS "EmailBounce" (
    "id" TEXT NOT NULL,
    "sendingDomainId" TEXT,
    "messageLogId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "bounceType" "BounceType" NOT NULL,
    "bounceCategory" "BounceCategory" NOT NULL,
    "reason" TEXT,
    "rawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailBounce_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailBounce_sendingDomainId_idx" ON "EmailBounce"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "EmailBounce_recipientEmail_idx" ON "EmailBounce"("recipientEmail");
CREATE INDEX IF NOT EXISTS "EmailBounce_bounceType_idx" ON "EmailBounce"("bounceType");
CREATE INDEX IF NOT EXISTS "EmailBounce_createdAt_idx" ON "EmailBounce"("createdAt");

-- Step 5: Create EmailComplaint Table
CREATE TABLE IF NOT EXISTS "EmailComplaint" (
    "id" TEXT NOT NULL,
    "sendingDomainId" TEXT,
    "messageLogId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "feedbackType" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailComplaint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailComplaint_sendingDomainId_idx" ON "EmailComplaint"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "EmailComplaint_recipientEmail_idx" ON "EmailComplaint"("recipientEmail");
CREATE INDEX IF NOT EXISTS "EmailComplaint_createdAt_idx" ON "EmailComplaint"("createdAt");

-- Step 6: Create EmailWarmup Table
CREATE TABLE IF NOT EXISTS "EmailWarmup" (
    "id" TEXT NOT NULL,
    "sendingDomainId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "targetVolume" INTEGER NOT NULL,
    "actualVolume" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailWarmup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailWarmup_sendingDomainId_day_key" ON "EmailWarmup"("sendingDomainId", "day");
CREATE INDEX IF NOT EXISTS "EmailWarmup_sendingDomainId_idx" ON "EmailWarmup"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "EmailWarmup_completedAt_idx" ON "EmailWarmup"("completedAt");

-- Step 7: Add Foreign Keys
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SendingDomain_userId_fkey') THEN
        ALTER TABLE "SendingDomain" ADD CONSTRAINT "SendingDomain_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DomainReputation_sendingDomainId_fkey') THEN
        ALTER TABLE "DomainReputation" ADD CONSTRAINT "DomainReputation_sendingDomainId_fkey" 
        FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'EmailBounce_sendingDomainId_fkey') THEN
        ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_sendingDomainId_fkey" 
        FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'EmailBounce_messageLogId_fkey') THEN
        ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_messageLogId_fkey" 
        FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'EmailComplaint_sendingDomainId_fkey') THEN
        ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_sendingDomainId_fkey" 
        FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'EmailComplaint_messageLogId_fkey') THEN
        ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_messageLogId_fkey" 
        FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'EmailWarmup_sendingDomainId_fkey') THEN
        ALTER TABLE "EmailWarmup" ADD CONSTRAINT "EmailWarmup_sendingDomainId_fkey" 
        FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 8: Update UnsubscribeRecord if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='UnsubscribeRecord') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='UnsubscribeRecord' AND column_name='sendingDomainId') THEN
            ALTER TABLE "UnsubscribeRecord" ADD COLUMN "sendingDomainId" TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'UnsubscribeRecord_sendingDomainId_fkey') THEN
            ALTER TABLE "UnsubscribeRecord" ADD CONSTRAINT "UnsubscribeRecord_sendingDomainId_fkey" 
            FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

-- Step 9: Mark migration as applied
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    gen_random_uuid()::text,
    'manual_fix_20251202',
    NOW(),
    '20251202000000_add_sending_domain_tables',
    NULL,
    NULL,
    NOW(),
    1
)
ON CONFLICT ("migration_name") 
DO UPDATE SET 
    "finished_at" = NOW(),
    "rolled_back_at" = NULL,
    "applied_steps_count" = 1;
```

---

## Verification

After running the SQL, verify the tables were created:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('SendingDomain', 'DomainReputation', 'EmailBounce', 'EmailComplaint', 'EmailWarmup')
ORDER BY table_name;
```

You should see all 5 tables listed.

---

## What to Do Next

1. **Restart your backend service** in Railway (or it will auto-restart)
2. **Check the logs** - you should no longer see `SendingDomain` errors
3. **Test scheduled emails** - they should now be able to send!

The migration is now complete! 🎉

