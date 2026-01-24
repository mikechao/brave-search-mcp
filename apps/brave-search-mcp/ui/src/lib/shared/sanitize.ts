/**
 * Utility functions for sanitizing HTML content
 * Uses DOMPurify to safely sanitize and render HTML from Brave API responses
 */
import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML to remove XSS vectors while preserving safe formatting tags
 * Use with dangerouslySetInnerHTML to render the result
 */
export function sanitizeHtml(html: string | undefined | null): string {
  if (!html)
    return '';

  // Allow only safe formatting tags, remove everything else (scripts, iframes, etc.)
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'u', 'mark', 'span', 'p', 'br'],
    ALLOWED_ATTR: [], // No attributes allowed for extra security
  });
}

/**
 * Strips all HTML tags and decodes HTML entities, returning plain text
 * Use when you don't want any HTML rendering
 */
export function stripHtml(html: string | undefined | null): string {
  if (!html)
    return '';

  // Return plain text with all tags stripped
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [], // Strip all tags
    KEEP_CONTENT: true, // Keep text content
  });
}
