import { describe, it, expect } from 'vitest';
import { filterPii, containsPii } from '../middleware/piiFilter';

describe('PII Filter', () => {
  // ─── Phone Numbers ──────────────────────────────────────────
  describe('Phone number detection', () => {
    it('detects standard US phone numbers', () => {
      const result = filterPii('Call me at 555-123-4567');
      expect(result.detected).toBe(true);
      expect(result.types).toContain('phone');
      expect(result.sanitized).toContain('[REDACTED]');
      expect(result.sanitized).not.toContain('555-123-4567');
    });

    it('detects international phone numbers', () => {
      const result = filterPii('My number is +91 98765 43210');
      expect(result.detected).toBe(true);
      expect(result.types).toContain('phone');
    });

    it('detects phone with parentheses', () => {
      const result = filterPii('Call (555) 123-4567');
      expect(result.detected).toBe(true);
      expect(result.types).toContain('phone');
    });
  });

  // ─── Emails ─────────────────────────────────────────────────
  describe('Email detection', () => {
    it('detects standard emails', () => {
      const result = filterPii('Email me at john@example.com');
      expect(result.detected).toBe(true);
      expect(result.types).toContain('email');
      expect(result.sanitized).not.toContain('john@example.com');
    });

    it('detects emails with dots and special chars', () => {
      const result = filterPii('My email: first.last+tag@sub.domain.co');
      expect(result.detected).toBe(true);
      expect(result.types).toContain('email');
    });
  });

  // ─── Social Handles ────────────────────────────────────────
  describe('Social handle detection', () => {
    it('detects Instagram/Twitter handles', () => {
      const result = filterPii('Follow me @my_handle');
      expect(result.detected).toBe(true);
      expect(result.types).toContain('social_handle');
      expect(result.sanitized).not.toContain('@my_handle');
    });

    it('detects handles with dots', () => {
      const result = filterPii('DM me on @cool.user');
      expect(result.detected).toBe(true);
      expect(result.types).toContain('social_handle');
    });
  });

  // ─── URLs ───────────────────────────────────────────────────
  describe('URL detection', () => {
    it('detects http URLs', () => {
      const result = filterPii('Check out http://example.com/page');
      expect(result.detected).toBe(true);
      expect(result.types).toContain('url');
    });

    it('detects https URLs', () => {
      const result = filterPii('Visit https://my-site.io/profile?id=123');
      expect(result.detected).toBe(true);
      expect(result.types).toContain('url');
    });
  });

  // ─── Clean Text ─────────────────────────────────────────────
  describe('Clean text passthrough', () => {
    it('passes clean text through unchanged', () => {
      const text = 'I love hiking and poetry. The mountains are calling.';
      const result = filterPii(text);
      expect(result.detected).toBe(false);
      expect(result.types).toHaveLength(0);
      expect(result.sanitized).toBe(text);
    });

    it('does not flag normal text with numbers', () => {
      const text = 'I have 3 cats and 2 dogs';
      const result = filterPii(text);
      expect(result.detected).toBe(false);
    });
  });

  // ─── Mixed PII ──────────────────────────────────────────────
  describe('Mixed PII content', () => {
    it('detects and redacts multiple PII types', () => {
      const text = 'Hey! Email me at test@email.com or call 555-123-4567. IG: @myprofile';
      const result = filterPii(text);
      expect(result.detected).toBe(true);
      expect(result.types).toContain('email');
      expect(result.types).toContain('phone');
      expect(result.types).toContain('social_handle');
      expect(result.sanitized).not.toContain('test@email.com');
      expect(result.sanitized).not.toContain('555-123-4567');
      expect(result.sanitized).not.toContain('@myprofile');
    });
  });

  // ─── containsPii helper ────────────────────────────────────
  describe('containsPii helper', () => {
    it('returns true for text with PII', () => {
      expect(containsPii('my email is test@example.com')).toBe(true);
    });

    it('returns false for clean text', () => {
      expect(containsPii('Just a regular message about life')).toBe(false);
    });
  });
});
