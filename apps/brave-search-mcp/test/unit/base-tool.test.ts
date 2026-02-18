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
});
