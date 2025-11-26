-- CreateEnum
CREATE TYPE "MeetingReminderStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "MeetingReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meetingTypeId" TEXT NOT NULL,
    "bookingLinkId" TEXT,
    "inviteeEmail" TEXT NOT NULL,
    "inviteeName" TEXT,
    "status" "MeetingReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "maxSends" INTEGER NOT NULL DEFAULT 2,
    "schedulePlanMinutes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "lastSentAt" TIMESTAMP(3),
    "nextSendAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingReminder_meetingTypeId_inviteeEmail_key" ON "MeetingReminder"("meetingTypeId", "inviteeEmail");

-- CreateIndex
CREATE INDEX "MeetingReminder_status_nextSendAt_idx" ON "MeetingReminder"("status", "nextSendAt");

-- AddForeignKey
ALTER TABLE "MeetingReminder" ADD CONSTRAINT "MeetingReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingReminder" ADD CONSTRAINT "MeetingReminder_meetingTypeId_fkey" FOREIGN KEY ("meetingTypeId") REFERENCES "MeetingType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingReminder" ADD CONSTRAINT "MeetingReminder_bookingLinkId_fkey" FOREIGN KEY ("bookingLinkId") REFERENCES "BookingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;










