import { addMinutes } from "date-fns";

import type { AvailabilityDay } from "./calendarAvailability";

const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 17;
const MAX_RECOMMENDATIONS = 3;
const MS_PER_MINUTE = 60_000;

export type SmartRecommendation = {
  start: string;
  end: string;
  label: string;
  descriptor: string;
  score?: number; // 0-100, higher is better
};

const alignToQuarterHour = (input: Date) => {
  const aligned = new Date(input);
  const minutes = aligned.getMinutes();
  const remainder = minutes % 15;
  if (remainder !== 0) {
    aligned.setMinutes(minutes + (15 - remainder), 0, 0);
  } else {
    aligned.setSeconds(0, 0);
  }
  return aligned;
};

const getHourInTimeZone = (date: Date, timeZone: string | null | undefined) => {
  if (!timeZone) {
    return date.getHours();
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).formatToParts(date);
    const hourPart = parts.find((part) => part.type === "hour");
    const hourValue = hourPart ? Number.parseInt(hourPart.value, 10) : Number.NaN;
    if (!Number.isNaN(hourValue)) {
      return hourValue;
    }
  } catch {
    // ignore timezone formatting issues and fall back to local hours
  }
  return date.getHours();
};

export const formatSlotRange = (startISO: string, endISO: string, timeZone: string | null | undefined) => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (timeZone) {
    options.timeZone = timeZone;
  }
  const startLabel = new Intl.DateTimeFormat(undefined, options).format(new Date(startISO));
  const endLabel = new Intl.DateTimeFormat(undefined, options).format(new Date(endISO));
  return `${startLabel} – ${endLabel}`;
};

export const generateSuggestedSlot = (
  timeZone: string | null | undefined,
  durationMinutes: number,
) => {
  const base = addMinutes(new Date(), 24 * 60);
  return formatSlotRange(base.toISOString(), addMinutes(base, durationMinutes).toISOString(), timeZone);
};

export const computeSmartRecommendations = (
  days: AvailabilityDay[],
  durationMinutes: number,
  timeZone: string | null | undefined,
): SmartRecommendation[] => {
  const now = new Date();
  const recommendations: SmartRecommendation[] = [];
  const msPerMeeting = durationMinutes * MS_PER_MINUTE;

  for (const day of days) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) {
      break;
    }

    const dayStart = new Date(day.date);
    if (Number.isNaN(dayStart.getTime())) {
      continue;
    }

    const workingStart = new Date(dayStart);
    workingStart.setHours(WORKDAY_START_HOUR, 0, 0, 0);
    const workingEnd = new Date(dayStart);
    workingEnd.setHours(WORKDAY_END_HOUR, 0, 0, 0);

    if (workingEnd <= now) {
      continue;
    }

    const busySlots = (day.slots ?? [])
      .filter((slot) => slot.status === "busy")
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    let cursor = new Date(Math.max(workingStart.getTime(), now.getTime()));
    if (cursor < workingStart) {
      cursor = new Date(workingStart);
    }

    const processGap = (gapEnd: Date) => {
      while (cursor < gapEnd && recommendations.length < MAX_RECOMMENDATIONS) {
        const candidateStart = alignToQuarterHour(cursor);
        if (candidateStart >= gapEnd) {
          break;
        }
        const candidateEnd = new Date(candidateStart.getTime() + msPerMeeting);
        if (candidateEnd > gapEnd) {
          break;
        }

        const bufferAfterMinutes = Math.max(0, Math.round((gapEnd.getTime() - candidateEnd.getTime()) / MS_PER_MINUTE));
        const hoursFromNow = (candidateStart.getTime() - now.getTime()) / (60 * 60 * 1000);
        let label: string;
        if (hoursFromNow <= 24) {
          label = "Soonest opening";
        } else if (hoursFromNow <= 72) {
          label = "This week";
        } else {
          label = "Next available slot";
        }

        const slotHour = getHourInTimeZone(candidateStart, timeZone);
        const descriptorParts: string[] = [];
        if (slotHour < 12) {
          descriptorParts.push("Morning focus slot");
        } else if (slotHour < 17) {
          descriptorParts.push("Afternoon momentum");
        } else {
          descriptorParts.push("Evening flexibility");
        }
        if (bufferAfterMinutes >= 30) {
          descriptorParts.push("Leaves breathing room afterward");
        }
        if (descriptorParts.length === 0) {
          descriptorParts.push("Fits your requested duration");
        }

        // Calculate score based on multiple factors
        let score = 50; // Base score
        
        // Prefer times closer to now (but not too close)
        if (hoursFromNow >= 2 && hoursFromNow <= 48) {
          score += 20; // Sweet spot: 2-48 hours
        } else if (hoursFromNow < 2) {
          score -= 10; // Too soon
        }
        
        // Prefer morning/afternoon slots
        if (slotHour >= 9 && slotHour <= 16) {
          score += 15; // Business hours
        }
        
        // Prefer slots with buffer time
        if (bufferAfterMinutes >= 30) {
          score += 10;
        }
        
        // Prefer weekdays
        const dayOfWeek = candidateStart.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          score += 5;
        }

        recommendations.push({
          start: candidateStart.toISOString(),
          end: candidateEnd.toISOString(),
          label,
          descriptor: descriptorParts.join(" • "),
          score: Math.min(100, Math.max(0, score)),
        });

        cursor = new Date(candidateEnd.getTime() + 15 * MS_PER_MINUTE);
      }
    };

    for (const busy of busySlots) {
      const slotStart = new Date(busy.start);
      const slotEnd = new Date(busy.end);
      if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime())) {
        continue;
      }
      if (slotStart > workingEnd) {
        processGap(workingEnd);
        cursor = new Date(workingEnd);
        break;
      }
      if (slotStart > cursor) {
        const gapEnd = new Date(Math.min(slotStart.getTime(), workingEnd.getTime()));
        processGap(gapEnd);
      }
      if (recommendations.length >= MAX_RECOMMENDATIONS) {
        break;
      }
      if (slotEnd > cursor) {
        cursor = new Date(slotEnd);
      }
      if (cursor >= workingEnd) {
        break;
      }
    }

    if (recommendations.length >= MAX_RECOMMENDATIONS) {
      break;
    }

    if (cursor < workingEnd) {
      processGap(workingEnd);
    }
  }

  // Sort by score (highest first) and return top recommendations
  return recommendations
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_RECOMMENDATIONS);
};










