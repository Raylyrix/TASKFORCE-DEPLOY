import { logger } from "../lib/logger";

/**
 * Template Sanitization Utility
 * 
 * This utility ensures all email templates are clean, valid UTF-8, and free from encoding corruption
 * before being saved to the database. This prevents the gibberish/encoding issues that can occur
 * after 2-3 campaigns.
 * 
 * Protection layers:
 * 1. UTF-8 validation and re-encoding
 * 2. Remove corrupted RFC 2047 encoding patterns
 * 3. Remove control characters (except newlines/tabs for HTML)
 * 4. Clean accidental URL encoding
 * 5. Validate final output
 */

export interface TemplateValidationResult {
  isValid: boolean;
  sanitized: string;
  warnings: string[];
  errors: string[];
}

/**
 * Sanitize and validate an email subject line
 */
export function sanitizeSubject(subject: string | null | undefined): TemplateValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!subject || typeof subject !== 'string') {
    return {
      isValid: false,
      sanitized: '',
      warnings: [],
      errors: ['Subject is null, undefined, or not a string'],
    };
  }

  let sanitized = subject;

  // Step 1: Ensure valid UTF-8 encoding
  try {
    const buffer = Buffer.from(sanitized, 'utf-8');
    sanitized = buffer.toString('utf-8');
  } catch (error) {
    warnings.push('UTF-8 encoding issue detected and fixed');
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  }

  // Step 2: Check for and remove corrupted RFC 2047 encoding
  const rfc2047Pattern = /=\?[^?]*\?[^?]*\?[^?]*\?=/g;
  if (rfc2047Pattern.test(sanitized)) {
    warnings.push('RFC 2047 encoding found in subject template - this should not be pre-encoded');
    // Remove all RFC 2047 encoding patterns
    sanitized = sanitized.replace(rfc2047Pattern, '');
  }

  // Step 3: Remove any malformed encoding fragments
  const malformedStart = /^[^?=]*\?[^?]*\?[^?]*\?=/g;
  const malformedEnd = /=\?[^?]*\?[^?]*\?[^?=]*$/g;
  if (malformedStart.test(sanitized) || malformedEnd.test(sanitized)) {
    warnings.push('Malformed encoding pattern detected and removed');
    sanitized = sanitized.replace(malformedStart, '').replace(malformedEnd, '');
  }

  // Step 4: Remove control characters (but allow tabs and newlines for formatting)
  const hasControlChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(sanitized);
  if (hasControlChars) {
    warnings.push('Control characters detected and removed');
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  }

  // Step 5: Check for corrupted single-letter URL encoding ONLY (like %P, %Q from corruption)
  // DO NOT touch valid hex pairs like %50, %20, %45 - those could be legitimate (e.g., "Get %50 off")
  // This pattern matches %P, %Q, %Z etc. but NOT %50, %20, %45
  const corruptedEncodingPattern = /%([A-F])(?![0-9A-Fa-f])/gi;
  if (corruptedEncodingPattern.test(sanitized)) {
    warnings.push('Corrupted single-letter URL encoding detected - cleaning');
    sanitized = sanitized.replace(corruptedEncodingPattern, (match, letter) => {
      // Just keep the letter, remove the %
      // %P → P, %Q → Q, etc.
      return letter;
    });
  }
  
  // Also check for other obvious corruption: %% or % followed by non-hex
  sanitized = sanitized.replace(/%%/g, '%'); // Double % is corruption
  sanitized = sanitized.replace(/%(?![0-9A-Fa-f]{2}|[A-Fa-f](?![0-9A-Fa-f]))/g, ''); // % not followed by valid pattern

  // Step 6: Trim and validate final result
  sanitized = sanitized.trim();

  if (sanitized.length === 0) {
    errors.push('Subject is empty after sanitization');
  }

  if (sanitized.length > 998) { // RFC 2822 limit
    warnings.push('Subject exceeds RFC 2822 limit (998 chars) - may be truncated by email clients');
  }

  // Step 7: Check for common spam patterns that might cause issues
  const spamPatterns = [
    /^RE:RE:RE:/i,
    /^FW:FW:FW:/i,
    /!!!{3,}/,
    /\${3,}/,
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(sanitized)) {
      warnings.push(`Subject contains spam-like pattern: ${pattern.source}`);
    }
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    warnings,
    errors,
  };
}

/**
 * Sanitize and validate an email HTML body
 */
export function sanitizeHtml(html: string | null | undefined): TemplateValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!html || typeof html !== 'string') {
    return {
      isValid: false,
      sanitized: '',
      warnings: [],
      errors: ['HTML is null, undefined, or not a string'],
    };
  }

  let sanitized = html;

  // Step 1: Ensure valid UTF-8 encoding
  try {
    const buffer = Buffer.from(sanitized, 'utf-8');
    sanitized = buffer.toString('utf-8');
  } catch (error) {
    warnings.push('UTF-8 encoding issue detected and fixed');
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  }

  // Step 2: Check for and remove corrupted RFC 2047 encoding (shouldn't be in HTML body)
  const rfc2047Pattern = /=\?[^?]*\?[^?]*\?[^?]*\?=/g;
  if (rfc2047Pattern.test(sanitized)) {
    warnings.push('RFC 2047 encoding found in HTML template - this should not be pre-encoded');
    sanitized = sanitized.replace(rfc2047Pattern, '');
  }

  // Step 3: Remove control characters (but keep newlines, tabs, carriage returns for HTML formatting)
  const hasControlChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(sanitized);
  if (hasControlChars) {
    warnings.push('Control characters detected and removed');
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  }

  // Step 4: Trim and validate final result
  sanitized = sanitized.trim();

  if (sanitized.length === 0) {
    errors.push('HTML is empty after sanitization');
  }

  // Step 5: Basic HTML validation
  const hasOpeningTag = /<[a-z]/i.test(sanitized);
  if (!hasOpeningTag) {
    warnings.push('HTML does not contain any HTML tags - may be plain text');
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    warnings,
    errors,
  };
}

/**
 * Sanitize and validate merge field values from recipient data
 */
export function sanitizeMergeFieldValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  let sanitized = String(value);

  // Ensure valid UTF-8
  try {
    sanitized = Buffer.from(sanitized, 'utf-8').toString('utf-8');
  } catch {
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  }

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Remove any RFC 2047 encoding
  sanitized = sanitized.replace(/=\?[^?]*\?[^?]*\?[^?]*\?=/g, '');

  return sanitized.trim();
}

/**
 * Sanitize an entire email template (subject + HTML + attachments)
 */
export interface EmailTemplate {
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
    size?: number;
  }>;
}

export interface TemplateSanitizationResult {
  isValid: boolean;
  template: EmailTemplate;
  warnings: string[];
  errors: string[];
}

export function sanitizeEmailTemplate(template: EmailTemplate): TemplateSanitizationResult {
  const allWarnings: string[] = [];
  const allErrors: string[] = [];

  // Sanitize subject
  const subjectResult = sanitizeSubject(template.subject);
  allWarnings.push(...subjectResult.warnings.map(w => `Subject: ${w}`));
  allErrors.push(...subjectResult.errors.map(e => `Subject: ${e}`));

  // Sanitize HTML
  const htmlResult = sanitizeHtml(template.html);
  allWarnings.push(...htmlResult.warnings.map(w => `HTML: ${w}`));
  allErrors.push(...htmlResult.errors.map(e => `HTML: ${e}`));

  // Validate attachments (basic validation)
  const sanitizedAttachments = template.attachments?.map(att => {
    const sanitizedFilename = att.filename.replace(/[\x00-\x1F\x7F]/g, '');
    if (sanitizedFilename !== att.filename) {
      allWarnings.push(`Attachment: Control characters removed from filename`);
    }
    return {
      ...att,
      filename: sanitizedFilename,
    };
  });

  return {
    isValid: allErrors.length === 0,
    template: {
      subject: subjectResult.sanitized,
      html: htmlResult.sanitized,
      attachments: sanitizedAttachments,
    },
    warnings: allWarnings,
    errors: allErrors,
  };
}

/**
 * Log sanitization results for monitoring
 */
export function logSanitizationResult(
  result: TemplateSanitizationResult,
  context: { userId?: string; campaignId?: string; campaignName?: string; followUpStepId?: string }
): void {
  // Import and use the monitoring system
  const { reportSanitizationResult } = require("../monitoring/encodingMonitor");
  
  // Report to monitoring system
  reportSanitizationResult(result, context);

  // Also log directly for immediate visibility
  if (result.errors.length > 0) {
    logger.error(
      {
        ...context,
        errors: result.errors,
        warnings: result.warnings,
      },
      'Template sanitization failed - template has critical errors'
    );
  } else if (result.warnings.length > 0) {
    logger.warn(
      {
        ...context,
        warnings: result.warnings,
        subjectPreview: result.template.subject.substring(0, 100),
      },
      'Template sanitization warnings - template was cleaned but may have had issues'
    );
  } else {
    logger.debug(
      {
        ...context,
        subjectPreview: result.template.subject.substring(0, 100),
      },
      'Template sanitization successful - no issues found'
    );
  }
}

