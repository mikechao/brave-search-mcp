import type { ToolInterceptor } from '../../src/tools/tool-helpers.js';
import { describe, expect, it, vi } from 'vitest';
import { QueryPolicyInterceptor } from '../../src/tools/QueryPolicyInterceptor.js';
import { executeTool } from '../../src/tools/tool-helpers.js';

function makeRules(phrases: string[] = [], patterns: string[] = []) {
  return {
    deniedPhrases: phrases,
    deniedPatterns: patterns.map(p => new RegExp(p, 'i')),
  };
}

function makeContext(input: Record<string, unknown>, isFallback = false) {
  return {
    toolName: 'test_tool',
    input: Object.freeze(input) as Readonly<Record<string, unknown>>,
    isFallback,
    startedAtMs: Date.now(),
    requestId: 'req-policy',
    transport: 'stdio' as const,
    authSource: 'stdio-process' as const,
  };
}

describe('queryPolicyInterceptor', () => {
  // --- Hard-block mode ---

  it('returns { allow: false, code: "POLICY_DENIED" } when query contains a denied phrase (case-insensitive)', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['forbidden']), false);
    const result = await interceptor.before(makeContext({ query: 'search for Forbidden term' }));
    expect(result).toMatchObject({ allow: false, code: 'POLICY_DENIED' });
  });

  it('returns { allow: false } when query matches a denied regex pattern', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules([], ['\\bsecret\\b']), false);
    const result = await interceptor.before(makeContext({ query: 'find the secret location' }));
    expect(result).toMatchObject({ allow: false });
  });

  it('returns { allow: false } when url contains a denied phrase', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['forbidden']), false);
    const result = await interceptor.before(makeContext({ url: 'https://example.com/forbidden/page' }));
    expect(result).toMatchObject({ allow: false });
  });

  it('denial reason says "URL" when url triggers the block, not "Query"', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['forbidden']), false);
    const result = await interceptor.before(makeContext({ url: 'https://example.com/forbidden' }));
    const reason = (result as { reason: string }).reason;
    expect(reason).toContain('URL');
    expect(reason).not.toContain('Query');
  });

  it('returns undefined when neither query nor url matches any rule', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['forbidden']), false);
    const result = await interceptor.before(makeContext({ query: 'safe search query' }));
    expect(result).toBeUndefined();
  });

  it('phrase matching is case-insensitive (FORBIDDEN blocked by phrase "forbidden")', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['forbidden']), false);
    const result = await interceptor.before(makeContext({ query: 'FORBIDDEN content' }));
    expect(result).toMatchObject({ allow: false });
  });

  it('returns undefined when input has no query or url fields', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['forbidden']), false);
    const result = await interceptor.before(makeContext({ count: 10 }));
    expect(result).toBeUndefined();
  });

  it('does not throw when query is a non-string (e.g., numeric)', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['forbidden']), false);
    const result = await interceptor.before(makeContext({ query: 42 }));
    expect(result).toBeUndefined();
  });

  it('checks isFallback: true context the same as a primary call', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['forbidden']), false);
    const result = await interceptor.before(makeContext({ query: 'forbidden term' }, true));
    expect(result).toMatchObject({ allow: false });
  });

  // --- Redaction mode ---

  it('returns { allow: true } with redactedInput.query having matched text replaced by [REDACTED]', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['secret']), true);
    const ctx = makeContext({ query: 'find the secret message' });
    const result = await interceptor.before(ctx);
    expect(result).toMatchObject({ allow: true });
    expect((result as { redactedInput: Record<string, unknown> }).redactedInput.query).toBe('find the [REDACTED] message');
  });

  it('returns { allow: true } with redactedInput.url redacted when it matches', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['forbidden']), true);
    const ctx = makeContext({ url: 'https://example.com/forbidden' });
    const result = await interceptor.before(ctx);
    expect(result).toMatchObject({ allow: true });
    expect((result as { redactedInput: Record<string, unknown> }).redactedInput.url).toBe('https://example.com/[REDACTED]');
  });

  it('returns undefined when nothing matches in redaction mode', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['forbidden']), true);
    const result = await interceptor.before(makeContext({ query: 'safe query' }));
    expect(result).toBeUndefined();
  });

  it('preserves original context.input.query immutability after before() returns', async () => {
    const interceptor = new QueryPolicyInterceptor(makeRules(['secret']), true);
    const input = { query: 'find the secret' };
    const ctx = makeContext(input);
    await interceptor.before(ctx);
    expect(ctx.input.query).toBe('find the secret');
  });

  // --- Integration tests with executeTool ---

  it('hard-block with executeTool: result has isError:true and [POLICY:DENIED]; executeCore is not called', async () => {
    const executeCoreSpy = vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'result' }] }));
    const interceptors: ToolInterceptor[] = [
      new QueryPolicyInterceptor(makeRules(['forbidden']), false),
    ];
    const result = await executeTool({
      toolName: 'test_tool',
      input: { query: 'find the forbidden term' },
      executeCore: executeCoreSpy,
      interceptors,
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: 'text'; text: string }).text;
    expect(text).toContain('[POLICY:DENIED]');
    expect(executeCoreSpy).not.toHaveBeenCalled();
  });

  it('redaction with executeTool: executeCore called with redacted query, result not isError', async () => {
    const capturedInputs: unknown[] = [];
    const interceptors: ToolInterceptor[] = [
      new QueryPolicyInterceptor(makeRules(['secret']), true),
    ];
    const result = await executeTool({
      toolName: 'test_tool',
      input: { query: 'find the secret data' },
      executeCore: async (input) => {
        capturedInputs.push(input);
        return { content: [{ type: 'text' as const, text: 'ok' }] };
      },
      interceptors,
    });
    expect(result.isError).toBeFalsy();
    expect(capturedInputs).toHaveLength(1);
    expect((capturedInputs[0] as Record<string, unknown>).query).toBe('find the [REDACTED] data');
  });
});
