-- CreateTable
CREATE TABLE IF NOT EXISTS "CampaignFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "gmailLabelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignFolder_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add folderId column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Campaign' AND column_name='folderId') THEN
        ALTER TABLE "Campaign" ADD COLUMN "folderId" TEXT;
    END IF;
END $$;

-- AlterTable: Add gmailLabelId column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Campaign' AND column_name='gmailLabelId') THEN
        ALTER TABLE "Campaign" ADD COLUMN "gmailLabelId" TEXT;
    END IF;
END $$;

-- CreateIndex: Only create if they don't exist
CREATE INDEX IF NOT EXISTS "CampaignFolder_userId_idx" ON "CampaignFolder"("userId");
CREATE INDEX IF NOT EXISTS "CampaignFolder_userId_name_idx" ON "CampaignFolder"("userId", "name");
CREATE INDEX IF NOT EXISTS "Campaign_folderId_idx" ON "Campaign"("folderId");

-- AddForeignKey: Only add if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CampaignFolder_userId_fkey'
    ) THEN
        ALTER TABLE "CampaignFolder" ADD CONSTRAINT "CampaignFolder_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Campaign_folderId_fkey'
    ) THEN
        ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_folderId_fkey" 
        FOREIGN KEY ("folderId") REFERENCES "CampaignFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

