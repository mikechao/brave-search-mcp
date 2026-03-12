import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  buildPagedStructuredContent,
  buildStructuredToolResult,
  createPagedSearchOutputSchema,
  executeTool,
  getErrorMessage,
  webResultSchema,
  webSearchOutputSchema,
} from '../../src/tools/tool-helpers.js';

describe('toolHelpers', () => {
  it('returns executeCore results when no error occurs', async () => {
    const result = await executeTool({
      toolName: 'test_tool',
      input: { value: 'hello' },
      executeCore: async input => ({
        content: [{ type: 'text', text: input.value }],
      }),
    });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'hello' }],
    });
  });

  it('returns the default caught-error shape for thrown Error values', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await executeTool({
      toolName: 'test_tool',
      input: { value: 'x' },
      executeCore: async () => {
        throw new Error('boom');
      },
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error executing test_tool:', expect.any(Error));
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error in test_tool: Error: boom',
        },
      ],
      isError: true,
    });
  });

  it('stringifies non-Error thrown values in the default error response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await executeTool({
      toolName: 'test_tool',
      input: { value: 'x' },
      executeCore: async () => {
        const disguisedError = undefined as unknown as Error;
        throw disguisedError;
      },
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error executing test_tool:', undefined);
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error in test_tool: undefined',
        },
      ],
      isError: true,
    });
  });

  it('lets tools customize caught-error results without inheritance', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await executeTool({
      toolName: 'hooked_tool',
      input: { value: 'custom' },
      executeCore: async () => {
        throw new Error('hook boom');
      },
      buildErrorResult: (input, error): CallToolResult => ({
        content: [
          {
            type: 'text',
            text: `Hooked ${input.value}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
        _meta: {
          structuredContent: {
            value: input.value,
          },
        },
      }),
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error executing hooked_tool:', expect.any(Error));
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Hooked custom: hook boom',
        },
      ],
      isError: true,
      _meta: {
        structuredContent: {
          value: 'custom',
        },
      },
    });
  });

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

  it('normalizes error messages for widget-backed tools', () => {
    expect(getErrorMessage(new Error('timeout'))).toBe('timeout');
    expect(getErrorMessage('plain failure')).toBe('plain failure');
  });
});
