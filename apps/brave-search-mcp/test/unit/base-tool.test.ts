import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseTool } from '../../src/tools/BaseTool.js';

const testInputSchema = z.object({
  value: z.string(),
});

class TestTool extends BaseTool<typeof testInputSchema> {
  public readonly name = 'test_tool';
  public readonly description = 'Test tool for base class behavior';
  public readonly inputSchema = testInputSchema;

  constructor(private readonly impl: (input: { value: string }) => Promise<CallToolResult>) {
    super();
  }

  public async executeCore(input: { value: string }) {
    return this.impl(input);
  }
}

class HookedErrorTool extends BaseTool<typeof testInputSchema> {
  public readonly name = 'hooked_tool';
  public readonly description = 'Test tool for error hook behavior';
  public readonly inputSchema = testInputSchema;

  constructor() {
    super();
  }

  public async executeCore(_input: { value: string }): Promise<CallToolResult> {
    throw new Error('hook boom');
  }

  protected buildErrorResult(input: { value: string }, error: unknown): CallToolResult {
    return {
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
    };
  }
}

describe('baseTool', () => {
  it('returns executeCore result when no error occurs', async () => {
    const tool = new TestTool(async input => ({
      content: [{ type: 'text', text: input.value }],
    }));

    const result = await tool.execute({ value: 'hello' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'hello' }],
    });
  });

  it('returns standardized error shape when executeCore throws an Error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tool = new TestTool(async () => {
      throw new Error('boom');
    });

    const result = await tool.execute({ value: 'x' });

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

  it('stringifies non-Error thrown values in standardized error response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tool = new TestTool(async () => {
      const disguisedError = undefined as unknown as Error;
      throw disguisedError;
    });

    const result = await tool.execute({ value: 'x' });

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

  it('lets subclasses customize caught-error results without replacing execute()', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tool = new HookedErrorTool();

    const result = await tool.execute({ value: 'custom' });

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
});
