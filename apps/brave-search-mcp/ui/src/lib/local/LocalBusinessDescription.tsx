import type { ReactNode } from 'react';
import { createElement, useMemo } from 'react';
import snarkdown from 'snarkdown';

const ALLOWED_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'br',
  'a',
]);

const BLOCKED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'link', 'meta']);
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function sanitizeHref(href: string | null): string | null {
  if (!href)
    return null;

  const trimmed = href.trim();
  if (!trimmed)
    return null;

  try {
    const parsed = new URL(trimmed);
    if (!ALLOWED_LINK_PROTOCOLS.has(parsed.protocol))
      return null;
    return parsed.href;
  }
  catch {
    return null;
  }
}

function sanitizeNode(node: ChildNode, outputDoc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [outputDoc.createTextNode(node.textContent ?? '')];
  }

  if (node.nodeType !== Node.ELEMENT_NODE)
    return [];

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (BLOCKED_TAGS.has(tag))
    return [];

  const children = Array.from(element.childNodes).flatMap(child => sanitizeNode(child, outputDoc));

  if (!ALLOWED_TAGS.has(tag))
    return children;

  if (tag === 'br')
    return [outputDoc.createElement('br')];

  const sanitizedElement = outputDoc.createElement(tag);

  if (tag === 'a') {
    const safeHref = sanitizeHref(element.getAttribute('href'));
    if (!safeHref)
      return children;
    sanitizedElement.setAttribute('href', safeHref);
    sanitizedElement.setAttribute('target', '_blank');
    sanitizedElement.setAttribute('rel', 'noopener noreferrer');
  }

  for (const child of children)
    sanitizedElement.appendChild(child);

  return [sanitizedElement];
}

function renderSafeMarkdown(markdown: string): string {
  if (!markdown)
    return '';
  if (typeof DOMParser === 'undefined')
    return '';

  const rawHtml = snarkdown(markdown);
  const parsed = new DOMParser().parseFromString(rawHtml, 'text/html');
  const outputDoc = parsed.implementation.createHTMLDocument('');
  const root = outputDoc.createElement('div');

  for (const child of Array.from(parsed.body.childNodes)) {
    for (const sanitizedChild of sanitizeNode(child, outputDoc))
      root.appendChild(sanitizedChild);
  }

  return root.innerHTML;
}

function toReactNode(node: ChildNode, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE)
    return node.textContent;

  if (node.nodeType !== Node.ELEMENT_NODE)
    return null;

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag))
    return element.textContent;

  if (tag === 'br')
    return createElement('br', { key });

  const children = Array.from(element.childNodes).map((child, index) => (
    toReactNode(child, `${key}-${index}`)
  ));

  if (tag === 'a') {
    const href = element.getAttribute('href');
    if (!href)
      return children;
    return createElement('a', { key, href, target: '_blank', rel: 'noopener noreferrer' }, children);
  }

  return createElement(tag, { key }, children);
}

interface LocalBusinessDescriptionProps {
  description: string;
}

export default function LocalBusinessDescription({ description }: LocalBusinessDescriptionProps) {
  const nodes = useMemo(() => {
    if (!description)
      return null;
    if (typeof DOMParser === 'undefined')
      return description;

    const safeHtml = renderSafeMarkdown(description);
    if (!safeHtml)
      return null;

    const parsed = new DOMParser().parseFromString(safeHtml, 'text/html');
    return Array.from(parsed.body.childNodes).map((node, index) => (
      toReactNode(node, `desc-${index}`)
    ));
  }, [description]);

  if (!nodes)
    return null;

  return <>{nodes}</>;
}
