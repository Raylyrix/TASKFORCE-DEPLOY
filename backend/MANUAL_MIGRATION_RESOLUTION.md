# Manual Migration Resolution Guide

## Problem
The `20251202000000_add_sending_domain_tables` migration is marked as failed in the database, preventing new migrations from running. This is blocking scheduled emails from being sent.

## Solution Options

### Option 1: Resolve via Railway CLI (Recommended)

1. **Open PowerShell** and navigate to the backend directory:
   ```powershell
   cd C:\Users\hp\Downloads\TASKFORCE-PRODUCTION-main\TASKFORCE-PRODUCTION-main\backend
   ```

2. **Link to Railway service** (if not already linked):
   ```powershell
   railway link
   ```
   Select your project and `taskforce-backend` service.

3. **Resolve the failed migration**:
   ```powershell
   railway run npx prisma migrate resolve --rolled-back 20251202000000_add_sending_domain_tables
   ```

4. **Apply the migration**:
   ```powershell
   railway run npx prisma migrate deploy
   ```

5. **Verify it worked**:
   ```powershell
   railway logs --lines 50
   ```
   Look for "Migration applied successfully" or check that `SendingDomain` table errors are gone.

---

### Option 2: Resolve via Railway Dashboard + Shell

1. **Go to Railway Dashboard**: https://railway.app
2. **Open your project** → **taskforce-backend service**
3. **Click on "Deployments" tab**
4. **Click on the latest deployment**
5. **Click "Shell" or "Console" button** (if available)
6. **In the shell, run**:
   ```bash
   # Resolve the failed migration
   npx prisma migrate resolve --rolled-back 20251202000000_add_sending_domain_tables
   
   # Apply migrations
   npx prisma migrate deploy
   ```

---

### Option 3: Manually Run SQL (If Options 1 & 2 Don't Work)

If you can't access Railway CLI or Shell, you can manually execute the SQL:

1. **Get Database Connection String**:
   - Go to Railway Dashboard
   - Open `taskforce-db` service
   - Go to "Variables" tab
   - Copy the `DATABASE_URL` or `POSTGRES_URL`

2. **Connect to Database** using one of these methods:

   **Method A: Using Railway Dashboard Query Tab**
   - In Railway Dashboard, open `taskforce-db` service
   - Look for "Query" or "Data" tab
   - Use the SQL editor

   **Method B: Using psql (if you have PostgreSQL client)**
   ```powershell
   # Extract connection details from DATABASE_URL
   # Format: postgresql://user:password@host:port/database
   psql "postgresql://user:password@host:port/database"
   ```

3. **Run these SQL commands**:

   ```sql
   -- Step 1: Mark the failed migration as rolled back
   UPDATE "_prisma_migrations" 
   SET "finished_at" = NOW(), 
       "rolled_back_at" = NOW(),
       "migration_name" = '20251202000000_add_sending_domain_tables'
   WHERE "migration_name" = '20251202000000_add_sending_domain_tables' 
     AND "finished_at" IS NULL;

   -- Step 2: Create the enums (if they don't exist)
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

   -- Step 3: Create SendingDomain table
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
       "updatedAt" TIMESTAMP(3) NOT NULL,
       CONSTRAINT "SendingDomain_pkey" PRIMARY KEY ("id")
   );

   -- Step 4: Create DomainReputation table
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
       "updatedAt" TIMESTAMP(3) NOT NULL,
       CONSTRAINT "DomainReputation_pkey" PRIMARY KEY ("id")
   );

   -- Step 5: Create EmailBounce table
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

   -- Step 6: Create EmailComplaint table
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

   -- Step 7: Create EmailWarmup table
   CREATE TABLE IF NOT EXISTS "EmailWarmup" (
       "id" TEXT NOT NULL,
       "sendingDomainId" TEXT NOT NULL,
       "day" INTEGER NOT NULL,
       "targetVolume" INTEGER NOT NULL,
       "actualVolume" INTEGER NOT NULL DEFAULT 0,
       "completedAt" TIMESTAMP(3),
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" TIMESTAMP(3) NOT NULL,
       CONSTRAINT "EmailWarmup_pkey" PRIMARY KEY ("id")
   );

   -- Step 8: Create indexes
   CREATE UNIQUE INDEX IF NOT EXISTS "SendingDomain_userId_domain_key" ON "SendingDomain"("userId", "domain");
   CREATE INDEX IF NOT EXISTS "SendingDomain_userId_idx" ON "SendingDomain"("userId");
   CREATE INDEX IF NOT EXISTS "SendingDomain_domain_idx" ON "SendingDomain"("domain");
   CREATE INDEX IF NOT EXISTS "SendingDomain_isVerified_idx" ON "SendingDomain"("isVerified");
   
   CREATE UNIQUE INDEX IF NOT EXISTS "DomainReputation_sendingDomainId_key" ON "DomainReputation"("sendingDomainId");
   CREATE INDEX IF NOT EXISTS "DomainReputation_reputationScore_idx" ON "DomainReputation"("reputationScore");
   CREATE INDEX IF NOT EXISTS "DomainReputation_isInWarmup_idx" ON "DomainReputation"("isInWarmup");
   
   CREATE INDEX IF NOT EXISTS "EmailBounce_sendingDomainId_idx" ON "EmailBounce"("sendingDomainId");
   CREATE INDEX IF NOT EXISTS "EmailBounce_recipientEmail_idx" ON "EmailBounce"("recipientEmail");
   CREATE INDEX IF NOT EXISTS "EmailBounce_bounceType_idx" ON "EmailBounce"("bounceType");
   CREATE INDEX IF NOT EXISTS "EmailBounce_createdAt_idx" ON "EmailBounce"("createdAt");
   
   CREATE INDEX IF NOT EXISTS "EmailComplaint_sendingDomainId_idx" ON "EmailComplaint"("sendingDomainId");
   CREATE INDEX IF NOT EXISTS "EmailComplaint_recipientEmail_idx" ON "EmailComplaint"("recipientEmail");
   CREATE INDEX IF NOT EXISTS "EmailComplaint_createdAt_idx" ON "EmailComplaint"("createdAt");
   
   CREATE UNIQUE INDEX IF NOT EXISTS "EmailWarmup_sendingDomainId_day_key" ON "EmailWarmup"("sendingDomainId", "day");
   CREATE INDEX IF NOT EXISTS "EmailWarmup_sendingDomainId_idx" ON "EmailWarmup"("sendingDomainId");
   CREATE INDEX IF NOT EXISTS "EmailWarmup_completedAt_idx" ON "EmailWarmup"("completedAt");

   -- Step 9: Add foreign keys
   DO $$ 
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'SendingDomain_userId_fkey'
       ) THEN
           ALTER TABLE "SendingDomain" ADD CONSTRAINT "SendingDomain_userId_fkey" 
           FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
   END $$;

   DO $$ 
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'DomainReputation_sendingDomainId_fkey'
       ) THEN
           ALTER TABLE "DomainReputation" ADD CONSTRAINT "DomainReputation_sendingDomainId_fkey" 
           FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
   END $$;

   DO $$ 
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'EmailBounce_sendingDomainId_fkey'
       ) THEN
           ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_sendingDomainId_fkey" 
           FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
       END IF;
   END $$;

   DO $$ 
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'EmailBounce_messageLogId_fkey'
       ) THEN
           ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_messageLogId_fkey" 
           FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
       END IF;
   END $$;

   DO $$ 
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'EmailComplaint_sendingDomainId_fkey'
       ) THEN
           ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_sendingDomainId_fkey" 
           FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
       END IF;
   END $$;

   DO $$ 
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'EmailComplaint_messageLogId_fkey'
       ) THEN
           ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_messageLogId_fkey" 
           FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
       END IF;
   END $$;

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

   DO $$ 
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'EmailWarmup_sendingDomainId_fkey'
       ) THEN
           ALTER TABLE "EmailWarmup" ADD CONSTRAINT "EmailWarmup_sendingDomainId_fkey" 
           FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
   END $$;

   -- Step 10: Mark migration as applied
   INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
   VALUES (
       gen_random_uuid()::text,
       'manual_fix',
       NOW(),
       '20251202000000_add_sending_domain_tables',
       NULL,
       NULL,
       NOW(),
       1
   )
   ON CONFLICT DO NOTHING;
   ```

4. **Verify tables were created**:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name IN ('SendingDomain', 'DomainReputation', 'EmailBounce', 'EmailComplaint', 'EmailWarmup');
   ```

---

### Option 4: Quick Fix Script (Copy-Paste Ready)

If you have access to Railway CLI, run this single command:

```powershell
cd C:\Users\hp\Downloads\TASKFORCE-PRODUCTION-main\TASKFORCE-PRODUCTION-main\backend
railway run sh -c "npx prisma migrate resolve --rolled-back 20251202000000_add_sending_domain_tables && npx prisma migrate deploy"
```

---

## Verification

After resolving the migration, verify it worked:

1. **Check logs** for `SendingDomain` errors - they should be gone
2. **Check scheduled emails** - they should start sending
3. **Verify table exists**:
   ```sql
   SELECT COUNT(*) FROM "SendingDomain";
   ```

## Expected Result

- ✅ `SendingDomain` table exists
- ✅ No more `relation "public.SendingDomain" does not exist` errors
- ✅ Scheduled emails can be sent
- ✅ Migration status shows as applied

---

## Troubleshooting

**If migration still fails:**
1. Check the exact error message in Railway logs
2. Verify DATABASE_URL is set correctly
3. Ensure you have proper database permissions
4. Try Option 3 (manual SQL) as a last resort

**If tables exist but migration is still marked as failed:**
- Run: `npx prisma migrate resolve --applied 20251202000000_add_sending_domain_tables`

