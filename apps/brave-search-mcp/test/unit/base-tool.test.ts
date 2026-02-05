import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseTool } from '../../src/tools/BaseTool.js';

class TestTool extends BaseTool<z.ZodObject<{ value: z.ZodString }>, { ok: boolean; value: string }> {
  public readonly name = 'test_tool';
  public readonly description = 'Test tool for base class behavior';
  public readonly inputSchema = z.object({
    value: z.string(),
  });

  constructor(private readonly impl: (input: { value: string }) => Promise<{ ok: boolean; value: string }>) {
    super();
  }

  public async executeCore(input: { value: string }) {
    return this.impl(input);
  }
}

describe('baseTool', () => {
  it('returns executeCore result when no error occurs', async () => {
    const tool = new TestTool(async input => ({ ok: true, value: input.value }));

    const result = await tool.execute({ value: 'hello' });

    expect(result).toEqual({
      ok: true,
      value: 'hello',
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
