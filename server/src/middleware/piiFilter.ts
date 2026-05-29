import { PiiFilterResult } from '../types';

/**
 * PII Masking Engine — Privacy Shield
 * 
 * Detects and redacts personally identifiable information from user-generated content.
 * Applied to messages and bio/profile updates to enforce date-within-the-platform behavior.
 * 
 * Detected PII types:
 * - Phone numbers (international + domestic formats)
 * - Email addresses
 * - Social media handles (@username)
 * - URLs / links
 */

const PII_PATTERNS: { name: string; regex: RegExp }[] = [
  {
    name: 'phone',
    regex: /(\+?\d[\d\s\-()]{6,}\d)/g,
  },
  {
    name: 'email',
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  },
  {
    name: 'social_handle',
    regex: /@[a-zA-Z0-9_.]{2,}/g,
  },
  {
    name: 'url',
    regex: /https?:\/\/[^\s]+/gi,
  },
];

const REDACTION_PLACEHOLDER = '[REDACTED]';

/**
 * Scans text for PII and returns the sanitized version.
 */
export function filterPii(text: string): PiiFilterResult {
  let sanitized = text;
  const detectedTypes: Set<string> = new Set();

  for (const pattern of PII_PATTERNS) {
    if (pattern.regex.test(sanitized)) {
      detectedTypes.add(pattern.name);
      // Reset lastIndex since we used .test() which advances it on global regexes
      pattern.regex.lastIndex = 0;
      sanitized = sanitized.replace(pattern.regex, REDACTION_PLACEHOLDER);
    }
  }

  return {
    sanitized,
    detected: detectedTypes.size > 0,
    types: Array.from(detectedTypes),
  };
}

/**
 * Quick check — does this text contain PII? (no replacement)
 */
export function containsPii(text: string): boolean {
  return PII_PATTERNS.some((pattern) => {
    const result = pattern.regex.test(text);
    pattern.regex.lastIndex = 0; // Reset global regex state
    return result;
  });
}
