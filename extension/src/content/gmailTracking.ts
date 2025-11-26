/**
 * Gmail Email Tracking Indicators
 * Injects read/unread status indicators directly into Gmail's email list
 */

import { apiClient } from "../shared/apiClient";
import { getBackendUrl } from "../shared/config";

type TrackingStatus = {
  opened: boolean;
  openedAt?: string;
  subject: string;
};

type TrackingMap = Record<string, TrackingStatus>;

let trackingData: TrackingMap = {};
let trackingDataFetched = false;
let observer: MutationObserver | null = null;

/**
 * Fetch tracking data from backend
 */
async function fetchTrackingData(): Promise<TrackingMap> {
  try {
    const backendUrl = await getBackendUrl();
    const data = await apiClient.request<{ tracking: TrackingMap }>(
      "/api/tracking/sent-emails"
    );
    return data.tracking || {};
  } catch (error) {
    console.error("[TaskForce] Error fetching tracking data:", error);
    return {};
  }
}

/**
 * Extract email address from Gmail's "From" header
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<(.+?)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
  return match ? match[1] || match[0] : from.toLowerCase();
}

/**
 * Create a tracking indicator element
 */
function createTrackingIndicator(opened: boolean, openedAt?: string): HTMLElement {
  const indicator = document.createElement("div");
  indicator.className = "taskforce-email-tracking-indicator";
  
  if (opened) {
    // Double check mark for opened
    indicator.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.5 4.5L6 12L2.5 8.5" stroke="#34a853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11 4.5L6 9.5L4.5 8" stroke="#34a853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    indicator.title = openedAt 
      ? `Opened ${new Date(openedAt).toLocaleString()}`
      : "Email has been opened";
    indicator.style.color = "#34a853";
  } else {
    // Single check mark for sent but not opened
    indicator.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.5 4.5L6 12L2.5 8.5" stroke="#5f6368" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    indicator.title = "Email sent but not opened yet";
    indicator.style.color = "#5f6368";
  }

  Object.assign(indicator.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "8px",
    cursor: "help",
    verticalAlign: "middle",
  });

  return indicator;
}

/**
 * Check if an email row already has a tracking indicator
 */
function hasTrackingIndicator(row: HTMLElement): boolean {
  return row.querySelector(".taskforce-email-tracking-indicator") !== null;
}

/**
 * Get tracking status for an email row
 */
function getTrackingStatus(row: HTMLElement): TrackingStatus | null {
  try {
    // Find the subject element - Gmail uses various selectors
    const subjectElement = row.querySelector('span.bog') || 
                          row.querySelector('[data-thread-perm-id]') ||
                          row.querySelector('.bog') ||
                          row.querySelector('span[email]')?.closest('tr')?.querySelector('span.bog');
    
    if (!subjectElement) return null;

    const subject = subjectElement.textContent?.trim() || "";
    if (!subject) return null;

    // For sent emails, find the recipient (To field)
    // Gmail shows recipient in various ways in the sent folder
    const recipientElement = row.querySelector('span[email]') || 
                             row.querySelector('.yW span[email]') ||
                             row.querySelector('[email]') ||
                             Array.from(row.querySelectorAll('span')).find(span => 
                               span.getAttribute('email') && span.getAttribute('email')!.includes('@')
                             ) as HTMLElement | undefined;
    
    if (!recipientElement) {
      // Try to extract from text content
      const toText = row.textContent || "";
      const emailMatch = toText.match(/([^\s<>]+@[^\s<>]+)/);
      if (!emailMatch) return null;
      
      const recipientEmail = emailMatch[1].toLowerCase();
      const key = `${recipientEmail}|${subject}`;
      return trackingData[key] || null;
    }

    const recipientEmail = (recipientElement.getAttribute("email") || 
                          extractEmailAddress(recipientElement.textContent || "")).toLowerCase();

    if (!recipientEmail) return null;

    // Create key: email|subject
    const key = `${recipientEmail}|${subject}`;
    return trackingData[key] || null;
  } catch (error) {
    console.error("[TaskForce] Error getting tracking status:", error);
    return null;
  }
}

/**
 * Inject tracking indicator into an email row
 */
function injectTrackingIndicator(row: HTMLElement) {
  if (hasTrackingIndicator(row)) {
    return; // Already has indicator
  }

  const status = getTrackingStatus(row);
  if (!status) {
    return; // No tracking data for this email
  }

  // Find where to insert the indicator (usually near the subject or timestamp)
  const subjectElement = row.querySelector('[data-thread-perm-id]') || 
                         row.querySelector('span.bog') ||
                         row.querySelector('.bog');
  
  if (!subjectElement) return;

  const indicator = createTrackingIndicator(status.opened, status.openedAt);
  
  // Insert after the subject
  if (subjectElement.parentElement) {
    subjectElement.parentElement.insertBefore(indicator, subjectElement.nextSibling);
  } else {
    subjectElement.appendChild(indicator);
  }
}

/**
 * Process all email rows in the current view
 */
function processEmailRows() {
  // Gmail uses different selectors for email rows
  // Try multiple selectors to catch all email rows
  const emailRows = Array.from(document.querySelectorAll<HTMLElement>(
    'tr[role="row"], ' +
    'div[role="main"] tr[jsmodel], ' +
    'div[role="main"] tbody tr, ' +
    'table tbody tr'
  )).filter(row => {
    // Filter to only actual email rows (not headers, etc)
    return row.querySelector('span.bog') || row.querySelector('[data-thread-perm-id]');
  });

  emailRows.forEach((row) => {
    // Only process sent emails (emails in "Sent" folder or when viewing sent messages)
    const isSentFolder = window.location.href.includes("/sent") || 
                        window.location.href.includes("label:sent") ||
                        window.location.href.includes("#sent") ||
                        document.querySelector('[aria-label*="Sent"]') !== null;
    
    if (isSentFolder) {
      injectTrackingIndicator(row);
    }
  });
}

/**
 * Initialize Gmail tracking indicators
 */
export async function initGmailTracking() {
  if (!window.location.host.includes("mail.google.com")) {
    return;
  }

  console.log("[TaskForce] Initializing Gmail tracking indicators...");

  // Fetch tracking data
  trackingData = await fetchTrackingData();
  trackingDataFetched = true;

  // Process existing rows
  processEmailRows();

  // Observe DOM changes to inject indicators into new emails
  observer = new MutationObserver(() => {
    if (trackingDataFetched) {
      processEmailRows();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Refresh tracking data periodically (every 30 seconds)
  setInterval(async () => {
    trackingData = await fetchTrackingData();
    processEmailRows();
  }, 30000);

  console.log("[TaskForce] Gmail tracking indicators initialized");
}

/**
 * Cleanup tracking indicators
 */
export function cleanupGmailTracking() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  // Remove all indicators
  document.querySelectorAll(".taskforce-email-tracking-indicator").forEach((el) => {
    el.remove();
  });
}

