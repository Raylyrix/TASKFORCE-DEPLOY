"use client";

type NotificationPermission = "default" | "granted" | "denied";

interface ExtendedNotificationOptions extends NotificationOptions {
  onClick?: () => void;
}

export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = "default";

  private constructor() {
    if (typeof window !== "undefined") {
      this.permission = Notification.permission;
    }
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }

    if (this.permission === "granted") {
      return true;
    }

    if (this.permission === "denied") {
      return false;
    }

    const permission = await Notification.requestPermission();
    this.permission = permission;
    return permission === "granted";
  }

  async showNotification(
    title: string,
    options?: ExtendedNotificationOptions,
  ): Promise<void> {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (this.permission !== "granted") {
      const granted = await this.requestPermission();
      if (!granted) {
        return;
      }
    }

    const notification = new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: options?.tag,
      body: options?.body,
      data: options?.data,
      requireInteraction: options?.requireInteraction,
      silent: options?.silent,
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      if (options?.onClick) {
        options.onClick();
      }
      notification.close();
    };

    // Auto-close after 5 seconds unless requireInteraction is true
    if (!options?.requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }

  async notifyNewEmail(from: string, subject: string, onClick?: () => void): Promise<void> {
    await this.showNotification("New Email", {
      body: `From: ${from}\nSubject: ${subject}`,
      tag: "new-email",
      onClick,
      requireInteraction: false,
    });
  }

  async notifyBookingConfirmation(meetingType: string, time: string, onClick?: () => void): Promise<void> {
    await this.showNotification("Booking Confirmed", {
      body: `${meetingType} at ${time}`,
      tag: "booking-confirmed",
      onClick,
      requireInteraction: false,
    });
  }

  async notifyCampaignComplete(campaignName: string, sent: number, onClick?: () => void): Promise<void> {
    await this.showNotification("Campaign Complete", {
      body: `${campaignName}: ${sent} emails sent`,
      tag: "campaign-complete",
      onClick,
      requireInteraction: false,
    });
  }

  async notifyScheduledEmailSent(subject: string, onClick?: () => void): Promise<void> {
    await this.showNotification("Scheduled Email Sent", {
      body: subject,
      tag: "scheduled-email",
      onClick,
      requireInteraction: false,
    });
  }

  async notifySnoozeRestored(subject: string, onClick?: () => void): Promise<void> {
    await this.showNotification("Email Restored", {
      body: `Snoozed email: ${subject}`,
      tag: "snooze-restored",
      onClick,
      requireInteraction: false,
    });
  }
}

export const notificationService = NotificationService.getInstance();


