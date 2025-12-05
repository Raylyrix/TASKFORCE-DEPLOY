/**
 * Frontend Template Validation
 * 
 * Validates email templates on the frontend before sending to backend.
 * This is the first line of defense against encoding corruption.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate email subject line
 */
export function validateSubject(subject: string | null | undefined): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!subject || typeof subject !== 'string') {
    errors.push('Subject is required');
    return { isValid: false, errors, warnings };
  }

  const trimmed = subject.trim();

  if (trimmed.length === 0) {
    errors.push('Subject cannot be empty');
  }

  if (trimmed.length > 998) {
    warnings.push('Subject is very long (>998 chars) and may be truncated by email clients');
  }

  // Check for control characters
  if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
    errors.push('Subject contains invalid control characters');
  }

  // Check for pre-encoded content (shouldn't be encoded yet)
  if (/=\?[^?]*\?[^?]*\?[^?]*\?=/.test(trimmed)) {
    errors.push('Subject appears to be already encoded. Please use plain text.');
  }

  // Check for suspicious URL encoding
  if (/%[0-9A-F]{2}/i.test(trimmed)) {
    warnings.push('Subject contains URL-encoded characters (like %20). This may cause display issues.');
  }

  // Check for excessive spam patterns
  if (/!!!{3,}/.test(trimmed)) {
    warnings.push('Multiple exclamation marks may trigger spam filters');
  }

  if (/^(RE:|FW:){3,}/i.test(trimmed)) {
    warnings.push('Multiple RE:/FW: prefixes may trigger spam filters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate email HTML body
 */
export function validateHtml(html: string | null | undefined): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!html || typeof html !== 'string') {
    errors.push('Email body is required');
    return { isValid: false, errors, warnings };
  }

  const trimmed = html.trim();

  if (trimmed.length === 0) {
    errors.push('Email body cannot be empty');
  }

  // Check for control characters (excluding newlines, tabs, carriage returns)
  if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
    errors.push('Email body contains invalid control characters');
  }

  // Check for pre-encoded content
  if (/=\?[^?]*\?[^?]*\?[^?]*\?=/.test(trimmed)) {
    warnings.push('Email body contains RFC 2047 encoding. This should not be pre-encoded.');
  }

  // Check for basic HTML structure
  if (!/<[a-z]/i.test(trimmed) && trimmed.length > 0) {
    warnings.push('Email body does not contain HTML tags. Consider using HTML formatting for better appearance.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate merge field syntax
 */
export function validateMergeFields(text: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Find all merge fields
  const mergeFieldPattern = /{{([^}]+)}}/g;
  const matches = text.matchAll(mergeFieldPattern);

  for (const match of matches) {
    const fieldName = match[1].trim();

    // Check for empty merge field
    if (fieldName.length === 0) {
      errors.push(`Empty merge field found: ${match[0]}`);
      continue;
    }

    // Check for valid field name (letters, numbers, dots, hyphens, underscores)
    if (!/^[\w.-]+$/.test(fieldName)) {
      errors.push(`Invalid merge field name: "${fieldName}". Use only letters, numbers, dots, hyphens, and underscores.`);
    }

    // Check for suspicious patterns
    if (fieldName.includes('{{') || fieldName.includes('}}')) {
      errors.push(`Nested merge fields are not supported: ${match[0]}`);
    }
  }

  // Check for unmatched braces
  const openBraces = (text.match(/{{/g) || []).length;
  const closeBraces = (text.match(/}}/g) || []).length;

  if (openBraces !== closeBraces) {
    errors.push(`Unmatched merge field braces (${openBraces} opening, ${closeBraces} closing)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate entire email template
 */
export function validateEmailTemplate(subject: string, html: string): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Validate subject
  const subjectResult = validateSubject(subject);
  allErrors.push(...subjectResult.errors.map(e => `Subject: ${e}`));
  allWarnings.push(...subjectResult.warnings.map(w => `Subject: ${w}`));

  // Validate HTML
  const htmlResult = validateHtml(html);
  allErrors.push(...htmlResult.errors.map(e => `Body: ${e}`));
  allWarnings.push(...htmlResult.warnings.map(w => `Body: ${w}`));

  // Validate merge fields in both
  const subjectMergeFieldsResult = validateMergeFields(subject);
  allErrors.push(...subjectMergeFieldsResult.errors.map(e => `Subject ${e}`));
  allWarnings.push(...subjectMergeFieldsResult.warnings.map(w => `Subject ${w}`));

  const htmlMergeFieldsResult = validateMergeFields(html);
  allErrors.push(...htmlMergeFieldsResult.errors.map(e => `Body ${e}`));
  allWarnings.push(...htmlMergeFieldsResult.warnings.map(w => `Body ${w}`));

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Clean and normalize template input (removes common issues)
 */
export function cleanTemplateInput(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text;

  // Remove control characters (except newlines, tabs, carriage returns)
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Remove any pre-encoded RFC 2047 patterns
  cleaned = cleaned.replace(/=\?[^?]*\?[^?]*\?[^?]*\?=/g, '');

  // Fix common smart quotes and dashes (if user copy-pasted from Word/Google Docs)
  cleaned = cleaned
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2013\u2014]/g, '-') // En dash, em dash
    .replace(/\u2026/g, '...'); // Ellipsis

  return cleaned.trim();
}

