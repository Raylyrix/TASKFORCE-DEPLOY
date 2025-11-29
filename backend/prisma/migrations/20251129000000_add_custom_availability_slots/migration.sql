-- CreateTable
CREATE TABLE "CustomAvailabilitySlot" (
    "id" TEXT NOT NULL,
    "meetingTypeId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "timeZone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomAvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomAvailabilitySlot_meetingTypeId_idx" ON "CustomAvailabilitySlot"("meetingTypeId");

-- CreateIndex
CREATE INDEX "CustomAvailabilitySlot_meetingTypeId_startTime_endTime_idx" ON "CustomAvailabilitySlot"("meetingTypeId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "CustomAvailabilitySlot_isActive_idx" ON "CustomAvailabilitySlot"("isActive");

-- CreateIndex
CREATE INDEX "CustomAvailabilitySlot_startTime_endTime_idx" ON "CustomAvailabilitySlot"("startTime", "endTime");

-- AddForeignKey
ALTER TABLE "CustomAvailabilitySlot" ADD CONSTRAINT "CustomAvailabilitySlot_meetingTypeId_fkey" FOREIGN KEY ("meetingTypeId") REFERENCES "MeetingType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

