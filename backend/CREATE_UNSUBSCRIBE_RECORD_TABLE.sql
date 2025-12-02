-- Create UnsubscribeRecord Table
-- Run this in Railway Database UI (Query/SQL tab)

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

-- Add foreign keys (only if the referenced tables exist)
DO $$ 
BEGIN
    -- Foreign key to Campaign
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
    
    -- Foreign key to SendingDomain (if it exists)
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

