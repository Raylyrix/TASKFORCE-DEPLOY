/**
 * Anti-Spam Service
 * 
 * Comprehensive email deliverability and spam prevention measures:
 * - Content filtering for spam trigger words
 * - Subject line validation and cleaning
 * - HTML/text ratio checking
 * - Link validation
 * - Email format validation
 * - Spam score calculation
 */

import { logger } from "../lib/logger";

// Common spam trigger words and phrases (case-insensitive)
const SPAM_TRIGGER_WORDS = [
  // Urgency/Scarcity
  "act now", "limited time", "urgent", "expires", "expiring", "last chance", "don't delete", "don't miss",
  "while supplies last", "order now", "buy now", "click here", "click below",
  
  // Money/Financial
  "free money", "cash bonus", "earn $", "make $", "$$$", "income from home", "work from home",
  "get paid", "guaranteed income", "risk-free", "no risk", "no investment",
  
  // Suspicious phrases
  "congratulations", "you've won", "you won", "winner", "prize", "claim your", "claim now",
  "selected", "chosen", "exclusive offer", "special promotion",
  
  // Suspicious punctuation
  "!!!", "???", "!!!", "$$$", "***",
  
  // Suspicious domains/links
  "bit.ly", "tinyurl", "short.link",
  
  // Viagra/spam keywords
  "viagra", "cialis", "pharmacy", "pills", "medication",
  
  // Weight loss
  "lose weight", "weight loss", "diet pill", "burn fat",
  
  // Adult content
  "adult", "xxx", "porn",
];

// Suspicious subject patterns
const SPAM_SUBJECT_PATTERNS = [
  /^[A-Z\s!]{20,}$/, // All caps
  /[!]{2,}/, // Multiple exclamation marks
  /[?]{2,}/, // Multiple question marks
  /[\$]{2,}/, // Multiple dollar signs
  /free.*money/i,
  /click.*here/i,
  /act.*now/i,
  /urgent.*reply/i,
];

// Maximum spam score before flagging
const MAX_SPAM_SCORE = 5;

export type SpamCheckResult = {
  isSpam: boolean;
  score: number;
  reasons: string[];
  suggestions: string[];
};

export type EmailContent = {
  subject: string;
  html: string;
  text?: string;
  from?: string;
  to?: string;
};

/**
 * Check subject line for spam indicators
 */
const checkSubject = (subject: string): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];
  const lowerSubject = subject.toLowerCase();

  // Check for spam trigger words
  for (const trigger of SPAM_TRIGGER_WORDS) {
    if (lowerSubject.includes(trigger.toLowerCase())) {
      score += 1;
      reasons.push(`Subject contains spam trigger: "${trigger}"`);
    }
  }

  // Check for suspicious patterns
  for (const pattern of SPAM_SUBJECT_PATTERNS) {
    if (pattern.test(subject)) {
      score += 2;
      reasons.push(`Subject matches spam pattern`);
      break;
    }
  }

  // Check length (too short or too long can be suspicious)
  if (subject.length < 5) {
    score += 1;
    reasons.push("Subject is too short");
  } else if (subject.length > 100) {
    score += 1;
    reasons.push("Subject is too long");
  }

  // Check for excessive punctuation
  const exclamationCount = (subject.match(/!/g) || []).length;
  const questionCount = (subject.match(/\?/g) || []).length;
  if (exclamationCount > 2 || questionCount > 2) {
    score += 1;
    reasons.push("Excessive punctuation in subject");
  }

  // Check for all caps
  if (subject === subject.toUpperCase() && subject.length > 10) {
    score += 2;
    reasons.push("Subject is in all caps");
  }

  return { score, reasons };
};

/**
 * Check HTML content for spam indicators
 */
const checkHtmlContent = (html: string): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];
  const lowerHtml = html.toLowerCase();

  // Check for spam trigger words in content
  let triggerCount = 0;
  for (const trigger of SPAM_TRIGGER_WORDS) {
    const regex = new RegExp(trigger.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = html.match(regex);
    if (matches) {
      triggerCount += matches.length;
    }
  }
  if (triggerCount > 3) {
    score += Math.min(triggerCount, 5);
    reasons.push(`Content contains ${triggerCount} spam trigger words`);
  }

  // Check HTML/text ratio (too much HTML can be suspicious)
  const textContent = html.replace(/<[^>]+>/g, "").trim();
  const htmlLength = html.length;
  const textLength = textContent.length;
  const htmlRatio = htmlLength > 0 ? (htmlLength - textLength) / htmlLength : 0;

  if (htmlRatio > 0.8) {
    score += 1;
    reasons.push("Email has too much HTML markup compared to text");
  }

  // Check for suspicious links
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const links: string[] = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    links.push(match[1]);
  }

  const suspiciousDomains = ["bit.ly", "tinyurl.com", "short.link", "t.co"];
  const suspiciousLinkCount = links.filter((link) =>
    suspiciousDomains.some((domain) => link.includes(domain)),
  ).length;

  if (suspiciousLinkCount > 0) {
    score += suspiciousLinkCount;
    reasons.push(`Contains ${suspiciousLinkCount} suspicious shortened links`);
  }

  // Check for image-only emails (no text content)
  const imageRegex = /<img[^>]+>/gi;
  const imageCount = (html.match(imageRegex) || []).length;
  if (textLength < 50 && imageCount > 0) {
    score += 2;
    reasons.push("Email appears to be image-only with minimal text");
  }

  // Check for excessive links
  if (links.length > 10) {
    score += 1;
    reasons.push("Email contains too many links");
  }

  return { score, reasons };
};

/**
 * Check email format and structure
 */
const checkEmailFormat = (content: EmailContent): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];

  // Check for missing plain text version
  if (!content.text || content.text.trim().length < 10) {
    score += 1;
    reasons.push("Missing or insufficient plain text version");
  }

  // Check HTML/text ratio
  if (content.text && content.html) {
    const textLength = content.text.length;
    const htmlTextLength = content.html.replace(/<[^>]+>/g, "").trim().length;
    const ratio = textLength / htmlTextLength;

    if (ratio < 0.3) {
      score += 1;
      reasons.push("Plain text version is significantly shorter than HTML version");
    }
  }

  // Check for proper email structure
  if (!content.html.includes("<body") && !content.html.includes("<div")) {
    score += 1;
    reasons.push("HTML structure may be incomplete");
  }

  return { score, reasons };
};

/**
 * Generate suggestions to improve deliverability
 */
const generateSuggestions = (result: SpamCheckResult, content: EmailContent): string[] => {
  const suggestions: string[] = [];

  if (result.score > 0) {
    suggestions.push("Review and reduce spam trigger words in your content");
  }

  // Subject suggestions
  const subjectCheck = checkSubject(content.subject);
  if (subjectCheck.score > 0) {
    suggestions.push("Improve subject line: avoid all caps, excessive punctuation, and spam trigger words");
  }

  // Content suggestions
  const htmlCheck = checkHtmlContent(content.html);
  if (htmlCheck.score > 0) {
    suggestions.push("Ensure email has substantial text content, not just images");
    suggestions.push("Use full URLs instead of shortened links when possible");
  }

  // Format suggestions
  const formatCheck = checkEmailFormat(content);
  if (formatCheck.score > 0) {
    suggestions.push("Ensure plain text version is properly formatted");
  }

  // General suggestions
  suggestions.push("Personalize emails with recipient names and relevant content");
  suggestions.push("Avoid sending too many emails in a short time period");
  suggestions.push("Maintain a good sender reputation by getting replies and engagement");

  return suggestions;
};

/**
 * Comprehensive spam check for email content
 */
export const checkForSpam = (content: EmailContent): SpamCheckResult => {
  const reasons: string[] = [];
  let totalScore = 0;

  // Check subject
  const subjectResult = checkSubject(content.subject);
  totalScore += subjectResult.score;
  reasons.push(...subjectResult.reasons);

  // Check HTML content
  const htmlResult = checkHtmlContent(content.html);
  totalScore += htmlResult.score;
  reasons.push(...htmlResult.reasons);

  // Check email format
  const formatResult = checkEmailFormat(content);
  totalScore += formatResult.score;
  reasons.push(...formatResult.reasons);

  const isSpam = totalScore >= MAX_SPAM_SCORE;

  const result: SpamCheckResult = {
    isSpam,
    score: totalScore,
    reasons: reasons.slice(0, 10), // Limit to 10 reasons
    suggestions: [],
  };

  result.suggestions = generateSuggestions(result, content);

  if (isSpam) {
    logger.warn(
      {
        score: totalScore,
        reasons: result.reasons,
        subject: content.subject.substring(0, 50),
      },
      "Email flagged as potential spam",
    );
  }

  return result;
};

/**
 * Clean and sanitize subject line to reduce spam score
 */
export const cleanSubjectLine = (subject: string): string => {
  let cleaned = subject.trim();

  // Remove excessive punctuation
  cleaned = cleaned.replace(/[!]{2,}/g, "!");
  cleaned = cleaned.replace(/[?]{2,}/g, "?");
  cleaned = cleaned.replace(/[.]{3,}/g, "...");

  // Remove excessive spaces
  cleaned = cleaned.replace(/\s+/g, " ");

  // Limit length
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 97) + "...";
  }

  // Avoid all caps (convert to title case if all caps)
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 10) {
    cleaned = cleaned
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return cleaned.trim();
};

/**
 * Validate email address format
 */
export const validateEmailAddress = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Check if email content is likely to be flagged as spam
 */
export const isLikelySpam = (content: EmailContent): boolean => {
  const result = checkForSpam(content);
  return result.isSpam;
};

export const antiSpamService = {
  checkForSpam,
  cleanSubjectLine,
  validateEmailAddress,
  isLikelySpam,
};

