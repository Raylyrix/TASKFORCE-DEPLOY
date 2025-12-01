/**
 * Gmail Email Selector
 * Allows users to select emails from Gmail's email list by adding checkboxes
 * Selected emails can be used to create campaigns or follow-ups
 */

import { apiClient } from "../shared/apiClient";

type SelectedEmail = {
  email: string;
  subject: string;
  threadId: string | null;
  messageId: string | null;
  from: string;
  date: string;
  snippet: string;
  rowElement: HTMLElement;
};

let selectedEmails: Map<string, SelectedEmail> = new Map();
let observer: MutationObserver | null = null;
let selectorInitialized = false;

/**
 * Check if the extension context is still valid
 */
function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== "undefined" && 
           typeof chrome.runtime !== "undefined" && 
           chrome.runtime.id !== undefined;
  } catch {
    return false;
  }
}

/**
 * Extract email address from Gmail's "From" header
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<(.+?)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
  return match ? match[1] || match[0] : from.toLowerCase().trim();
}

/**
 * Extract thread ID from Gmail row element
 */
function extractThreadId(row: HTMLElement): string | null {
  // Gmail uses data-thread-perm-id or data-thread-id attributes
  const threadPermId = row.getAttribute("data-thread-perm-id");
  if (threadPermId) return threadPermId;
  
  const threadId = row.getAttribute("data-thread-id");
  if (threadId) return threadId;
  
  // Try to find in child elements
  const threadLink = row.querySelector('a[href*="/mail/u/"]');
  if (threadLink) {
    const href = threadLink.getAttribute("href");
    if (href) {
      const match = href.match(/\/thread\/([^\/]+)/);
      if (match) return match[1];
    }
  }
  
  return null;
}

/**
 * Extract message ID from Gmail row element
 */
function extractMessageId(row: HTMLElement): string | null {
  const messageIdAttr = row.getAttribute("data-message-id");
  if (messageIdAttr) return messageIdAttr;
  
  // Try to extract from data-legacy-thread-id or other attributes
  const legacyThreadId = row.getAttribute("data-legacy-thread-id");
  if (legacyThreadId) return legacyThreadId;
  
  return null;
}

/**
 * Extract email data from Gmail row
 */
function extractEmailData(row: HTMLElement): SelectedEmail | null {
  try {
    // Extract subject
    const subjectElement = row.querySelector('span[email]') || 
                          row.querySelector('.bog') ||
                          row.querySelector('[data-thread-perm-id] span');
    const subject = subjectElement?.textContent?.trim() || "No subject";

    // Extract from/sender
    const fromElement = row.querySelector('span[email]') || 
                       row.querySelector('.yW span') ||
                       row.querySelector('[name]');
    const from = fromElement?.textContent?.trim() || "";
    const email = extractEmailAddress(from);

    // Extract snippet/preview
    const snippetElement = row.querySelector('.y2') || 
                          row.querySelector('.y6 span') ||
                          row.querySelector('[data-thread-perm-id] + div');
    const snippet = snippetElement?.textContent?.trim() || "";

    // Extract date
    const dateElement = row.querySelector('.xW') || 
                       row.querySelector('.xT') ||
                       row.querySelector('[title]');
    const date = dateElement?.getAttribute("title") || 
                 dateElement?.textContent?.trim() || 
                 new Date().toISOString();

    const threadId = extractThreadId(row);
    const messageId = extractMessageId(row);

    if (!email || !email.includes("@")) {
      return null; // Invalid email
    }

    return {
      email,
      subject,
      threadId,
      messageId,
      from,
      date,
      snippet,
      rowElement: row,
    };
  } catch (error) {
    console.error("[TaskForce] Error extracting email data:", error);
    return null;
  }
}

/**
 * Create a checkbox element for email selection
 */
function createCheckbox(): HTMLElement {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "taskforce-email-selector-checkbox";
  checkbox.setAttribute("aria-label", "Select email for TaskForce");
  
  // Style the checkbox
  Object.assign(checkbox.style, {
    width: "18px",
    height: "18px",
    cursor: "pointer",
    marginRight: "8px",
    marginLeft: "4px",
    flexShrink: "0",
  });

  return checkbox;
}

/**
 * Check if a row already has a selector checkbox
 */
function hasSelectorCheckbox(row: HTMLElement): boolean {
  return row.querySelector(".taskforce-email-selector-checkbox") !== null;
}

/**
 * Inject checkbox into an email row
 */
function injectSelectorCheckbox(row: HTMLElement) {
  if (hasSelectorCheckbox(row)) {
    return; // Already has checkbox
  }

  const emailData = extractEmailData(row);
  if (!emailData) {
    return; // Couldn't extract email data
  }

  // Find the best place to insert the checkbox
  // Gmail rows typically have a structure like: [icon/star] [sender] [subject] [date]
  // We want to insert before the sender/email content
  
  // Try to find the first cell or container
  const firstCell = row.querySelector('td:first-child') || 
                   row.querySelector('div[role="row"] > div:first-child') ||
                   row.firstElementChild;
  
  if (!firstCell) {
    return; // Can't find insertion point
  }

  // Check if there's already a star/important icon we should place after
  const existingCheckbox = row.querySelector('.taskforce-email-selector-checkbox');
  if (existingCheckbox) {
    return; // Already has checkbox
  }

  const checkbox = createCheckbox();
  const uniqueKey = emailData.threadId || emailData.messageId || emailData.email + emailData.subject;
  
  // Set up checkbox change handler
  checkbox.addEventListener("change", (event) => {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      selectedEmails.set(uniqueKey, emailData);
      row.style.backgroundColor = "#e8f0fe"; // Highlight selected
    } else {
      selectedEmails.delete(uniqueKey);
      row.style.backgroundColor = ""; // Remove highlight
    }
    updateSelectionUI();
  });

  // Check if already selected
  if (selectedEmails.has(uniqueKey)) {
    checkbox.checked = true;
    row.style.backgroundColor = "#e8f0fe";
  }

  // Insert checkbox at the beginning of the first cell
  if (firstCell.firstChild) {
    firstCell.insertBefore(checkbox, firstCell.firstChild);
  } else {
    firstCell.appendChild(checkbox);
  }
}

/**
 * Update the selection UI (show count, etc.)
 */
function updateSelectionUI() {
  const count = selectedEmails.size;
  
  // Remove existing selection UI
  const existingUI = document.getElementById("taskforce-email-selection-ui");
  if (existingUI) {
    existingUI.remove();
  }

  if (count === 0) {
    return; // No selection, no UI needed
  }

  // Create selection UI
  const ui = document.createElement("div");
  ui.id = "taskforce-email-selection-ui";
  Object.assign(ui.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    backgroundColor: "#1a73e8",
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: "24px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: "10000",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "14px",
    fontFamily: "Google Sans, Roboto, Arial, sans-serif",
    cursor: "pointer",
  });

  const countText = document.createElement("span");
  countText.textContent = `${count} email${count !== 1 ? "s" : ""} selected`;
  countText.style.fontWeight = "500";

  const actionsContainer = document.createElement("div");
  actionsContainer.style.display = "flex";
  actionsContainer.style.gap = "8px";
  actionsContainer.style.alignItems = "center";

  // Create campaign button
  const createCampaignBtn = document.createElement("button");
  createCampaignBtn.textContent = "Create Campaign";
  createCampaignBtn.style.cssText = `
    background: #ffffff;
    color: #1a73e8;
    border: none;
    padding: 6px 16px;
    border-radius: 16px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  `;
  createCampaignBtn.addEventListener("mouseenter", () => {
    createCampaignBtn.style.backgroundColor = "#f1f3f4";
  });
  createCampaignBtn.addEventListener("mouseleave", () => {
    createCampaignBtn.style.backgroundColor = "#ffffff";
  });
  createCampaignBtn.addEventListener("click", () => {
    openComposerWithSelectedEmails();
  });

  // Clear selection button
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.style.cssText = `
    background: transparent;
    color: #ffffff;
    border: 1px solid rgba(255,255,255,0.3);
    padding: 6px 16px;
    border-radius: 16px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  `;
  clearBtn.addEventListener("mouseenter", () => {
    clearBtn.style.backgroundColor = "rgba(255,255,255,0.1)";
  });
  clearBtn.addEventListener("mouseleave", () => {
    clearBtn.style.backgroundColor = "transparent";
  });
  clearBtn.addEventListener("click", () => {
    clearSelection();
  });

  actionsContainer.appendChild(createCampaignBtn);
  actionsContainer.appendChild(clearBtn);

  ui.appendChild(countText);
  ui.appendChild(actionsContainer);

  document.body.appendChild(ui);
}

/**
 * Clear all selections
 */
function clearSelection() {
  selectedEmails.forEach((emailData) => {
    const checkbox = emailData.rowElement.querySelector(".taskforce-email-selector-checkbox") as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = false;
    }
    emailData.rowElement.style.backgroundColor = "";
  });
  selectedEmails.clear();
  updateSelectionUI();
}

/**
 * Open composer with selected emails
 */
function openComposerWithSelectedEmails() {
  const emails = Array.from(selectedEmails.values());
  if (emails.length === 0) {
    return;
  }

  // Store selected emails in sessionStorage for the composer to pick up
  const emailData = emails.map((e) => ({
    email: e.email,
    name: e.from.split("<")[0].trim() || e.email.split("@")[0],
    subject: e.subject,
  }));

  try {
    window.sessionStorage.setItem("taskforce-selected-emails", JSON.stringify(emailData));
    
    // Trigger opening the composer window
    // Use the existing window opening mechanism
    if (typeof (window as any).__taskforceOpenWindow === "function") {
      (window as any).__taskforceOpenWindow("taskforce-floating-composer");
    } else {
      // Fallback: dispatch a custom event
      window.dispatchEvent(new CustomEvent("taskforce-open-composer"));
    }
  } catch (error) {
    console.error("[TaskForce] Error storing selected emails:", error);
  }
}

/**
 * Process email rows in the current view
 */
function processEmailRows() {
  if (!isExtensionContextValid()) {
    return;
  }

  try {
    // Find all email rows in Gmail
    // Gmail uses various selectors depending on the view
    const selectors = [
      'tr[role="row"]', // Table view
      'div[role="row"]', // Card view
      'div[data-thread-perm-id]', // Thread-based
      'div[data-message-id]', // Message-based
    ];

    let rows: NodeListOf<HTMLElement> | null = null;
    for (const selector of selectors) {
      rows = document.querySelectorAll<HTMLElement>(selector);
      if (rows.length > 0) {
        break;
      }
    }

    if (!rows || rows.length === 0) {
      return; // No rows found
    }

    rows.forEach((row) => {
      // Skip if it's not actually an email row (might be header, etc.)
      if (row.querySelector('span[email]') || 
          row.getAttribute("data-thread-perm-id") || 
          row.getAttribute("data-message-id")) {
        injectSelectorCheckbox(row);
      }
    });
  } catch (error) {
    console.error("[TaskForce] Error processing email rows:", error);
  }
}

/**
 * Initialize Gmail email selector
 */
export async function initGmailEmailSelector() {
  if (selectorInitialized) {
    return; // Already initialized
  }

  if (!isExtensionContextValid()) {
    console.warn("[TaskForce] Extension context invalidated, cannot initialize email selector");
    return;
  }

  console.log("[TaskForce] Initializing Gmail email selector...");

  try {
    // Process existing rows
    processEmailRows();

    // Set up observer for new rows
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      if (!isExtensionContextValid()) {
        cleanupGmailEmailSelector();
        return;
      }

      let shouldProcess = false;
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          shouldProcess = true;
          break;
        }
      }

      if (shouldProcess) {
        // Debounce processing
        setTimeout(() => {
          if (isExtensionContextValid()) {
            processEmailRows();
          }
        }, 300);
      }
    });

    // Observe the main email list container
    const emailListContainer = document.querySelector('div[role="main"]') ||
                               document.querySelector('table[role="grid"]') ||
                               document.body;

    if (emailListContainer) {
      observer.observe(emailListContainer, {
        childList: true,
        subtree: true,
      });
    }

    // Also listen for Gmail's navigation events
    window.addEventListener("hashchange", () => {
      setTimeout(() => {
        if (isExtensionContextValid()) {
          processEmailRows();
        }
      }, 500);
    });

    selectorInitialized = true;
    console.log("[TaskForce] Gmail email selector initialized");
  } catch (error) {
    console.error("[TaskForce] Error initializing Gmail email selector:", error);
    selectorInitialized = false;
  }
}

/**
 * Cleanup email selector
 */
export function cleanupGmailEmailSelector() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  // Remove all checkboxes
  document.querySelectorAll(".taskforce-email-selector-checkbox").forEach((checkbox) => {
    checkbox.remove();
  });

  // Remove selection UI
  const ui = document.getElementById("taskforce-email-selection-ui");
  if (ui) {
    ui.remove();
  }

  // Clear selections
  selectedEmails.clear();
  selectorInitialized = false;
}


