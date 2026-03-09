import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  buildPagedStructuredContent,
  buildStructuredToolResult,
  createPagedSearchOutputSchema,
  getErrorMessage,
  webResultSchema,
  webSearchOutputSchema,
} from '../../src/tools/search-tool-shared.js';

describe('searchToolShared', () => {
  it('builds paged structured content with derived page metadata', () => {
    const structured = buildPagedStructuredContent({
      query: 'brunch',
      count: 3,
      offset: 2,
      items: [
        { title: 'A' },
        { title: 'B' },
      ],
      extra: {
        fallbackToWeb: true,
      },
    });

    expect(structured).toEqual({
      query: 'brunch',
      count: 3,
      pageSize: 3,
      returnedCount: 2,
      offset: 2,
      items: [
        { title: 'A' },
        { title: 'B' },
      ],
      fallbackToWeb: true,
    });
  });

  it('allows overriding returnedCount for local fallback payloads', () => {
    const structured = buildPagedStructuredContent({
      query: 'late night food',
      count: 4,
      offset: 0,
      items: [],
      returnedCount: 1,
      extra: {
        webFallbackItems: [{ title: 'Guide' }],
      },
    });

    expect(structured).toMatchObject({
      query: 'late night food',
      count: 4,
      pageSize: 4,
      returnedCount: 1,
      offset: 0,
      items: [],
      webFallbackItems: [{ title: 'Guide' }],
    });
  });

  it('attaches structured content under _meta.structuredContent', () => {
    const result = buildStructuredToolResult('Found it', { query: 'coffee', items: [] });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Found it' }],
      _meta: {
        structuredContent: {
          query: 'coffee',
          items: [],
        },
      },
    });
  });

  it('creates paged schemas that preserve the shared web fallback contract', () => {
    const localFallbackSchema = createPagedSearchOutputSchema(z.object({
      name: z.string(),
    }), {
      webFallbackItems: z.array(webResultSchema).optional(),
      fallbackToWeb: z.boolean().optional(),
    });

    const parsed = localFallbackSchema.safeParse({
      query: 'brunch',
      count: 2,
      pageSize: 2,
      returnedCount: 1,
      offset: 0,
      items: [],
      webFallbackItems: [
        {
          title: 'Brunch Guide',
          url: 'https://example.com/brunch',
          description: 'Best brunch spots',
          domain: 'example.com',
        },
      ],
      fallbackToWeb: true,
    });

    expect(parsed.success).toBe(true);
  });

  it('exports the shared web output schema used by web and local tools', () => {
    const parsed = webSearchOutputSchema.safeParse({
      query: 'open source',
      count: 5,
      pageSize: 5,
      returnedCount: 1,
      offset: 0,
      items: [
        {
          title: 'OSS Home',
          url: 'https://example.com',
          description: 'Portal',
          domain: 'example.com',
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it('normalizes error messages for widget-backed tool hooks', () => {
    expect(getErrorMessage(new Error('timeout'))).toBe('timeout');
    expect(getErrorMessage('plain failure')).toBe('plain failure');
  });
});
