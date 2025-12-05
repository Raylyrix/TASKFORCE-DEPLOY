/**
 * Encoding Issue Monitoring
 * 
 * This module provides monitoring and alerting for encoding issues in email templates.
 * It tracks:
 * - Template sanitization events (warnings and errors)
 * - Encoding corruption patterns
 * - Failed template saves
 * 
 * Alerts are logged to the logger system, which can be configured to send to external
 * monitoring services (Sentry, DataDog, etc.)
 */

import { logger } from "../lib/logger";

export interface EncodingIssue {
  type: 'warning' | 'error';
  category: 'subject' | 'html' | 'merge_field' | 'general';
  message: string;
  context?: {
    userId?: string;
    campaignId?: string;
    campaignName?: string;
    followUpStepId?: string;
    subjectPreview?: string;
    pattern?: string;
  };
}

/**
 * Track encoding issues
 */
const issueCounters = new Map<string, number>();
const issueWindow = 5 * 60 * 1000; // 5 minute window
const issueThreshold = 10; // Alert if >10 issues in window

/**
 * Report an encoding issue
 */
export function reportEncodingIssue(issue: EncodingIssue): void {
  const key = `${issue.type}:${issue.category}`;
  const count = (issueCounters.get(key) || 0) + 1;
  issueCounters.set(key, count);

  // Log the issue
  if (issue.type === 'error') {
    logger.error(
      {
        ...issue.context,
        category: issue.category,
        message: issue.message,
      },
      `Encoding Error: ${issue.message}`
    );
  } else {
    logger.warn(
      {
        ...issue.context,
        category: issue.category,
        message: issue.message,
      },
      `Encoding Warning: ${issue.message}`
    );
  }

  // Check if we've exceeded the threshold
  if (count === issueThreshold) {
    logger.error(
      {
        type: issue.type,
        category: issue.category,
        count,
        windowMinutes: issueWindow / 60000,
      },
      `ALERT: High number of encoding issues detected (${count} in ${issueWindow / 60000} minutes)`
    );
  }

  // Reset counters periodically
  setTimeout(() => {
    const currentCount = issueCounters.get(key) || 0;
    if (currentCount > 0) {
      issueCounters.set(key, currentCount - 1);
    }
  }, issueWindow);
}

/**
 * Report template sanitization result
 */
export function reportSanitizationResult(
  result: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  },
  context: {
    userId?: string;
    campaignId?: string;
    campaignName?: string;
    followUpStepId?: string;
  }
): void {
  // Report all errors
  for (const error of result.errors) {
    reportEncodingIssue({
      type: 'error',
      category: detectCategory(error),
      message: error,
      context,
    });
  }

  // Report all warnings
  for (const warning of result.warnings) {
    reportEncodingIssue({
      type: 'warning',
      category: detectCategory(warning),
      message: warning,
      context,
    });
  }

  // Log summary
  if (!result.isValid) {
    logger.error(
      {
        ...context,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
      },
      'Template sanitization failed'
    );
  } else if (result.warnings.length > 0) {
    logger.warn(
      {
        ...context,
        warningCount: result.warnings.length,
      },
      'Template sanitization warnings'
    );
  }
}

/**
 * Detect issue category from message
 */
function detectCategory(message: string): EncodingIssue['category'] {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('subject')) {
    return 'subject';
  }
  if (lowerMessage.includes('html') || lowerMessage.includes('body')) {
    return 'html';
  }
  if (lowerMessage.includes('merge') || lowerMessage.includes('field')) {
    return 'merge_field';
  }

  return 'general';
}

/**
 * Get encoding issue statistics
 */
export function getEncodingStats(): Record<string, number> {
  return Object.fromEntries(issueCounters);
}

/**
 * Reset encoding issue counters (useful for testing)
 */
export function resetEncodingStats(): void {
  issueCounters.clear();
}

/**
 * Common encoding corruption patterns to watch for
 */
export const ENCODING_CORRUPTION_PATTERNS = {
  // RFC 2047 encoding (shouldn't be in templates)
  rfc2047: /=\?[^?]*\?[^?]*\?[^?]*\?=/,
  
  // URL encoding in wrong context
  urlEncoding: /%[0-9A-F]{2}/i,
  
  // Control characters
  controlChars: /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/,
  
  // Corrupted Unicode (replacement characters)
  corruptedUnicode: /\uFFFD/,
  
  // Double-encoded UTF-8 (common pattern)
  doubleEncodedUtf8: /Ã¢â‚¬|Ã©|Ã¨|Ãª/,
  
  // Malformed encoding fragments
  malformedEncoding: /=\?[^?]*\?[^?]*\?[^?=]*$/,
};

/**
 * Detect encoding corruption patterns in text
 */
export function detectEncodingCorruption(text: string): string[] {
  const detected: string[] = [];

  for (const [name, pattern] of Object.entries(ENCODING_CORRUPTION_PATTERNS)) {
    if (pattern.test(text)) {
      detected.push(name);
    }
  }

  return detected;
}

/**
 * Check if text has any encoding issues
 */
export function hasEncodingIssues(text: string): boolean {
  return detectEncodingCorruption(text).length > 0;
}

