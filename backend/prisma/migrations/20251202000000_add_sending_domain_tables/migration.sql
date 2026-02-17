-- Email Deliverability: Enums
CREATE TYPE "BounceType" AS ENUM ('HARD', 'SOFT');

CREATE TYPE "BounceCategory" AS ENUM (
  'INVALID_EMAIL',
  'MAILBOX_FULL',
  'MESSAGE_TOO_LARGE',
  'CONTENT_REJECTED',
  'BLOCKED',
  'OTHER'
);

-- Email Deliverability: Tables
CREATE TABLE "SendingDomain" (
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

CREATE TABLE "DomainReputation" (
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

CREATE TABLE "EmailBounce" (
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

CREATE TABLE "EmailComplaint" (
    "id" TEXT NOT NULL,
    "sendingDomainId" TEXT,
    "messageLogId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "feedbackType" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailComplaint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnsubscribeRecord" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "campaignId" TEXT,
    "sendingDomainId" TEXT,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnsubscribeRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailWarmup" (
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

-- Indexes / Uniques
CREATE UNIQUE INDEX "SendingDomain_userId_domain_key" ON "SendingDomain"("userId", "domain");
CREATE INDEX "SendingDomain_userId_idx" ON "SendingDomain"("userId");
CREATE INDEX "SendingDomain_domain_idx" ON "SendingDomain"("domain");
CREATE INDEX "SendingDomain_isVerified_idx" ON "SendingDomain"("isVerified");

CREATE UNIQUE INDEX "DomainReputation_sendingDomainId_key" ON "DomainReputation"("sendingDomainId");
CREATE INDEX "DomainReputation_reputationScore_idx" ON "DomainReputation"("reputationScore");
CREATE INDEX "DomainReputation_isInWarmup_idx" ON "DomainReputation"("isInWarmup");

CREATE INDEX "EmailBounce_sendingDomainId_idx" ON "EmailBounce"("sendingDomainId");
CREATE INDEX "EmailBounce_recipientEmail_idx" ON "EmailBounce"("recipientEmail");
CREATE INDEX "EmailBounce_bounceType_idx" ON "EmailBounce"("bounceType");
CREATE INDEX "EmailBounce_createdAt_idx" ON "EmailBounce"("createdAt");

CREATE INDEX "EmailComplaint_sendingDomainId_idx" ON "EmailComplaint"("sendingDomainId");
CREATE INDEX "EmailComplaint_recipientEmail_idx" ON "EmailComplaint"("recipientEmail");
CREATE INDEX "EmailComplaint_createdAt_idx" ON "EmailComplaint"("createdAt");

CREATE UNIQUE INDEX "UnsubscribeRecord_email_campaignId_key" ON "UnsubscribeRecord"("email", "campaignId");
CREATE INDEX "UnsubscribeRecord_email_idx" ON "UnsubscribeRecord"("email");
CREATE INDEX "UnsubscribeRecord_campaignId_idx" ON "UnsubscribeRecord"("campaignId");
CREATE INDEX "UnsubscribeRecord_sendingDomainId_idx" ON "UnsubscribeRecord"("sendingDomainId");
CREATE INDEX "UnsubscribeRecord_createdAt_idx" ON "UnsubscribeRecord"("createdAt");

CREATE UNIQUE INDEX "EmailWarmup_sendingDomainId_day_key" ON "EmailWarmup"("sendingDomainId", "day");
CREATE INDEX "EmailWarmup_sendingDomainId_idx" ON "EmailWarmup"("sendingDomainId");
CREATE INDEX "EmailWarmup_completedAt_idx" ON "EmailWarmup"("completedAt");

-- Foreign keys
ALTER TABLE "SendingDomain" ADD CONSTRAINT "SendingDomain_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DomainReputation" ADD CONSTRAINT "DomainReputation_sendingDomainId_fkey"
  FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_sendingDomainId_fkey"
  FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_messageLogId_fkey"
  FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_sendingDomainId_fkey"
  FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_messageLogId_fkey"
  FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UnsubscribeRecord" ADD CONSTRAINT "UnsubscribeRecord_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UnsubscribeRecord" ADD CONSTRAINT "UnsubscribeRecord_sendingDomainId_fkey"
  FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailWarmup" ADD CONSTRAINT "EmailWarmup_sendingDomainId_fkey"
  FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

