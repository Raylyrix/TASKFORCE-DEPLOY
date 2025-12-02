-- Complete migration for missing tables
-- Copy and paste this entire block into the railway psql connection

-- Create UnsubscribeRecord table
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

-- Create indexes for UnsubscribeRecord
CREATE UNIQUE INDEX IF NOT EXISTS "UnsubscribeRecord_email_campaignId_key" ON "UnsubscribeRecord"("email", "campaignId");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_email_idx" ON "UnsubscribeRecord"("email");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_campaignId_idx" ON "UnsubscribeRecord"("campaignId");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_sendingDomainId_idx" ON "UnsubscribeRecord"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_createdAt_idx" ON "UnsubscribeRecord"("createdAt");

-- Add foreign keys for UnsubscribeRecord
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='Campaign') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'UnsubscribeRecord_campaignId_fkey') THEN
            ALTER TABLE "UnsubscribeRecord" ADD CONSTRAINT "UnsubscribeRecord_campaignId_fkey" 
            FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='SendingDomain') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'UnsubscribeRecord_sendingDomainId_fkey') THEN
            ALTER TABLE "UnsubscribeRecord" ADD CONSTRAINT "UnsubscribeRecord_sendingDomainId_fkey" 
            FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

-- Verify tables were created
SELECT 'Tables created successfully!' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('SendingDomain', 'UnsubscribeRecord', 'EmailBounce', 'EmailComplaint', 'EmailWarmup', 'DomainReputation') ORDER BY table_name;

