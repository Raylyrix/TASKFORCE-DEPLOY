-- CreateEnum: Only create if they don't exist
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

-- CreateTable: Only create if it doesn't exist
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

-- CreateTable: Only create if it doesn't exist
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

-- CreateTable: Only create if it doesn't exist
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

-- CreateTable: Only create if it doesn't exist
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

-- CreateTable: Only create if it doesn't exist
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

-- CreateIndex
CREATE UNIQUE INDEX "SendingDomain_userId_domain_key" ON "SendingDomain"("userId", "domain");

-- CreateIndex
CREATE INDEX "SendingDomain_userId_idx" ON "SendingDomain"("userId");

-- CreateIndex
CREATE INDEX "SendingDomain_domain_idx" ON "SendingDomain"("domain");

-- CreateIndex
CREATE INDEX "SendingDomain_isVerified_idx" ON "SendingDomain"("isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "DomainReputation_sendingDomainId_key" ON "DomainReputation"("sendingDomainId");

-- CreateIndex
CREATE INDEX "DomainReputation_reputationScore_idx" ON "DomainReputation"("reputationScore");

-- CreateIndex
CREATE INDEX "DomainReputation_isInWarmup_idx" ON "DomainReputation"("isInWarmup");

-- CreateIndex
CREATE INDEX "EmailBounce_sendingDomainId_idx" ON "EmailBounce"("sendingDomainId");

-- CreateIndex
CREATE INDEX "EmailBounce_recipientEmail_idx" ON "EmailBounce"("recipientEmail");

-- CreateIndex
CREATE INDEX "EmailBounce_bounceType_idx" ON "EmailBounce"("bounceType");

-- CreateIndex
CREATE INDEX "EmailBounce_createdAt_idx" ON "EmailBounce"("createdAt");

-- CreateIndex
CREATE INDEX "EmailComplaint_sendingDomainId_idx" ON "EmailComplaint"("sendingDomainId");

-- CreateIndex
CREATE INDEX "EmailComplaint_recipientEmail_idx" ON "EmailComplaint"("recipientEmail");

-- CreateIndex
CREATE INDEX "EmailComplaint_createdAt_idx" ON "EmailComplaint"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailWarmup_sendingDomainId_day_key" ON "EmailWarmup"("sendingDomainId", "day");

-- CreateIndex
CREATE INDEX "EmailWarmup_sendingDomainId_idx" ON "EmailWarmup"("sendingDomainId");

-- CreateIndex
CREATE INDEX "EmailWarmup_completedAt_idx" ON "EmailWarmup"("completedAt");

-- AddForeignKey
ALTER TABLE "SendingDomain" ADD CONSTRAINT "SendingDomain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainReputation" ADD CONSTRAINT "DomainReputation_sendingDomainId_fkey" FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_sendingDomainId_fkey" FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_messageLogId_fkey" FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_sendingDomainId_fkey" FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_messageLogId_fkey" FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add sendingDomainId column to UnsubscribeRecord if it doesn't exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='UnsubscribeRecord') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='UnsubscribeRecord' AND column_name='sendingDomainId') THEN
            ALTER TABLE "UnsubscribeRecord" ADD COLUMN "sendingDomainId" TEXT;
        END IF;
    END IF;
END $$;

-- AddForeignKey: Only add if UnsubscribeRecord table exists and column exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='UnsubscribeRecord'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='UnsubscribeRecord' AND column_name='sendingDomainId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'UnsubscribeRecord_sendingDomainId_fkey'
    ) THEN
        ALTER TABLE "UnsubscribeRecord" ADD CONSTRAINT "UnsubscribeRecord_sendingDomainId_fkey" 
        FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
ALTER TABLE "EmailWarmup" ADD CONSTRAINT "EmailWarmup_sendingDomainId_fkey" FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

