/**
 * Utility functions for sanitizing HTML content.
 */

const ALLOWED_TAGS = new Set(['strong', 'em', 'b', 'i', 'u', 'mark', 'span', 'p', 'br']);
const BLOCKED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template']);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '\'',
  nbsp: ' ',
};

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity: string) => {
    const lowered = entity.toLowerCase();

    if (lowered.startsWith('#x')) {
      const codePoint = Number.parseInt(lowered.slice(2), 16);
      if (Number.isNaN(codePoint))
        return full;
      return String.fromCodePoint(codePoint);
    }

    if (lowered.startsWith('#')) {
      const codePoint = Number.parseInt(lowered.slice(1), 10);
      if (Number.isNaN(codePoint))
        return full;
      return String.fromCodePoint(codePoint);
    }

    return NAMED_ENTITIES[lowered] ?? full;
  });
}

function toPlainText(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, ''));
}

function sanitizeNode(node: ChildNode, outputDoc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE)
    return [outputDoc.createTextNode(node.textContent ?? '')];

  if (node.nodeType !== Node.ELEMENT_NODE)
    return [];

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (BLOCKED_TAGS.has(tag))
    return [];

  if (tag === 'br')
    return [outputDoc.createElement('br')];

  const children = Array.from(element.childNodes).flatMap(child => sanitizeNode(child, outputDoc));
  if (!ALLOWED_TAGS.has(tag))
    return children;

  const sanitizedElement = outputDoc.createElement(tag);
  for (const child of children)
    sanitizedElement.appendChild(child);
  return [sanitizedElement];
}

function sanitizeWithParser(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const outputDoc = parsed.implementation.createHTMLDocument('');
  const container = outputDoc.createElement('div');

  for (const child of Array.from(parsed.body.childNodes)) {
    for (const sanitizedChild of sanitizeNode(child, outputDoc))
      container.appendChild(sanitizedChild);
  }

  return container.innerHTML;
}

function stripWithParser(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return parsed.body.textContent ?? '';
}

/**
 * Sanitizes HTML to remove XSS vectors while preserving safe formatting tags
 * Use with dangerouslySetInnerHTML to render the result
 */
export function sanitizeHtml(html: string | undefined | null): string {
  if (!html)
    return '';

  if (typeof DOMParser === 'undefined')
    return toPlainText(html);

  return sanitizeWithParser(html);
}

/**
 * Strips all HTML tags and decodes HTML entities, returning plain text
 * Use when you don't want any HTML rendering
 */
export function stripHtml(html: string | undefined | null): string {
  if (!html)
    return '';

  if (typeof DOMParser === 'undefined')
    return toPlainText(html);

  return stripWithParser(html);
}
