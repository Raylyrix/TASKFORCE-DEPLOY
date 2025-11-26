/**
 * Unified Customer View Service
 * Aggregates all interactions with a contact (email) across campaigns, meetings, and emails
 */

import { prisma } from "../lib/prisma";

export interface CustomerActivity {
  type: "email_sent" | "email_received" | "email_opened" | "email_clicked" | "meeting_booked" | "meeting_cancelled" | "campaign_participated";
  timestamp: Date;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerProfile {
  email: string;
  name?: string;
  totalEmailsSent: number;
  totalEmailsReceived: number;
  totalMeetings: number;
  totalCampaigns: number;
  lastContacted?: Date;
  lastMeeting?: Date;
  engagementScore: number;
  activities: CustomerActivity[];
}

/**
 * Get unified customer view for an email address
 */
export const getCustomerView = async (userId: string, email: string): Promise<CustomerProfile> => {
  const activities: CustomerActivity[] = [];

  // Get all emails sent to this contact
  const sentMessages = await prisma.messageLog.findMany({
    where: {
      campaign: {
        userId,
      },
      to: {
        equals: email,
        mode: "insensitive",
      },
    },
    include: {
      campaign: {
        select: {
          name: true,
        },
      },
      trackingEvents: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  // Get all meetings with this contact
  const meetings = await prisma.meetingBooking.findMany({
    where: {
      userId,
      inviteeEmail: {
        equals: email,
        mode: "insensitive",
      },
    },
    include: {
      meetingType: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Get campaign participation
  const campaignRecipients = await prisma.campaignRecipient.findMany({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
      campaign: {
        userId,
      },
    },
    include: {
      campaign: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Build activities from sent messages
  for (const message of sentMessages) {
    activities.push({
      type: "email_sent",
      timestamp: message.sendAt || message.createdAt,
      title: `Email sent: ${message.subject}`,
      description: `Sent via campaign: ${message.campaign.name}`,
      metadata: {
        messageId: message.id,
        campaignId: message.campaignId,
        opens: message.opens,
        clicks: message.clicks,
      },
    });

    // Add open events
    const openEvents = message.trackingEvents.filter((e) => e.type === "OPEN");
    for (const event of openEvents) {
      activities.push({
        type: "email_opened",
        timestamp: event.createdAt,
        title: "Email opened",
        description: `Opened: ${message.subject}`,
        metadata: {
          messageId: message.id,
        },
      });
    }

    // Add click events
    const clickEvents = message.trackingEvents.filter((e) => e.type === "CLICK");
    for (const event of clickEvents) {
      activities.push({
        type: "email_clicked",
        timestamp: event.createdAt,
        title: "Link clicked",
        description: `Clicked link in: ${message.subject}`,
        metadata: {
          messageId: message.id,
          url: (event.meta as { url?: string })?.url,
        },
      });
    }
  }

  // Build activities from meetings
  for (const meeting of meetings) {
    activities.push({
      type: meeting.status === "CANCELLED" ? "meeting_cancelled" : "meeting_booked",
      timestamp: meeting.createdAt,
      title: `${meeting.status === "CANCELLED" ? "Meeting cancelled" : "Meeting booked"}: ${meeting.meetingType.name}`,
      description: `${meeting.startTime.toLocaleString()} - ${meeting.endTime.toLocaleString()}`,
      metadata: {
        bookingId: meeting.id,
        meetingTypeId: meeting.meetingTypeId,
        status: meeting.status,
        conferenceUrl: meeting.conferenceUrl,
      },
    });
  }

  // Build activities from campaign participation
  for (const recipient of campaignRecipients) {
    activities.push({
      type: "campaign_participated",
      timestamp: recipient.createdAt,
      title: `Added to campaign: ${recipient.campaign.name}`,
      description: `Status: ${recipient.status}`,
      metadata: {
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        status: recipient.status,
      },
    });
  }

  // Sort activities by timestamp (newest first)
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Calculate engagement score
  const totalOpens = sentMessages.reduce((sum, m) => sum + m.opens, 0);
  const totalClicks = sentMessages.reduce((sum, m) => sum + m.clicks, 0);
  const totalSent = sentMessages.length;
  const openRate = totalSent > 0 ? totalOpens / totalSent : 0;
  const clickRate = totalOpens > 0 ? totalClicks / totalOpens : 0;
  const engagementScore = Math.min(100, Math.round((openRate * 50) + (clickRate * 50)));

  // Get name from most recent meeting or message
  const name = meetings[0]?.inviteeName || undefined;

  return {
    email,
    name,
    totalEmailsSent: sentMessages.length,
    totalEmailsReceived: 0, // Would need to fetch from Gmail API
    totalMeetings: meetings.length,
    totalCampaigns: new Set(campaignRecipients.map((r) => r.campaignId)).size,
    lastContacted: sentMessages[0]?.sendAt || sentMessages[0]?.createdAt,
    lastMeeting: meetings[0]?.startTime,
    engagementScore,
    activities: activities.slice(0, 50), // Limit to 50 most recent
  };
};

/**
 * Search for contacts by email
 */
export const searchContacts = async (userId: string, query: string, limit: number = 20) => {
  const email = query.toLowerCase().trim();

  // Get unique emails from messages
  const messageEmails = await prisma.messageLog.findMany({
    where: {
      campaign: {
        userId,
      },
      to: {
        contains: email,
        mode: "insensitive",
      },
    },
    select: {
      to: true,
    },
    distinct: ["to"],
    take: limit,
  });

  // Get unique emails from meetings
  const meetingEmails = await prisma.meetingBooking.findMany({
    where: {
      userId,
      inviteeEmail: {
        contains: email,
        mode: "insensitive",
      },
    },
    select: {
      inviteeEmail: true,
      inviteeName: true,
    },
    distinct: ["inviteeEmail"],
    take: limit,
  });

  // Combine and deduplicate
  const emailSet = new Set<string>();
  const contacts: Array<{ email: string; name?: string }> = [];

  for (const msg of messageEmails) {
    if (!emailSet.has(msg.to.toLowerCase())) {
      emailSet.add(msg.to.toLowerCase());
      contacts.push({ email: msg.to });
    }
  }

  for (const meeting of meetingEmails) {
    const emailLower = meeting.inviteeEmail.toLowerCase();
    if (!emailSet.has(emailLower)) {
      emailSet.add(emailLower);
      contacts.push({
        email: meeting.inviteeEmail,
        name: meeting.inviteeName || undefined,
      });
    } else {
      // Update name if we have it
      const existing = contacts.find((c) => c.email.toLowerCase() === emailLower);
      if (existing && meeting.inviteeName) {
        existing.name = meeting.inviteeName;
      }
    }
  }

  return contacts.slice(0, limit);
};

export const customerViewService = {
  getCustomerView,
  searchContacts,
};


