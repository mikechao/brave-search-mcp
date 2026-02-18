import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { expect } from 'vitest';

export function getFirstTextContent(result: CallToolResult): string {
  const first = result.content[0];
  expect(first).toBeDefined();
  expect(first?.type).toBe('text');

  if (!first || first.type !== 'text') {
    throw new Error('Expected first content block to be text');
  }

  return first.text;
}

export function getMetaStructuredContent<T>(result: CallToolResult): T {
  const meta = result._meta as { structuredContent?: unknown } | undefined;
  expect(meta?.structuredContent).toBeDefined();
  return meta?.structuredContent as T;
}
