-- Create UnsubscribeRecord Table
-- Run this via: railway connect taskforce-db
-- Then paste this entire file

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

CREATE UNIQUE INDEX IF NOT EXISTS "UnsubscribeRecord_email_campaignId_key" ON "UnsubscribeRecord"("email", "campaignId");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_email_idx" ON "UnsubscribeRecord"("email");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_campaignId_idx" ON "UnsubscribeRecord"("campaignId");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_sendingDomainId_idx" ON "UnsubscribeRecord"("sendingDomainId");
CREATE INDEX IF NOT EXISTS "UnsubscribeRecord_createdAt_idx" ON "UnsubscribeRecord"("createdAt");

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

-- Verify it was created
SELECT 'UnsubscribeRecord table created successfully!' as status;
SELECT COUNT(*) as table_exists FROM information_schema.tables WHERE table_name = 'UnsubscribeRecord';

