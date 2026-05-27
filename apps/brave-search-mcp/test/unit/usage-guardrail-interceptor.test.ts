import type { ToolInterceptor, ToolInterceptorContext } from '../../src/tools/tool-helpers.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeTool } from '../../src/tools/tool-helpers.js';
import { UsageGuardrailInterceptor } from '../../src/tools/UsageGuardrailInterceptor.js';

function makeContext(isFallback = false, overrides: Partial<ToolInterceptorContext> = {}): ToolInterceptorContext {
  return {
    toolName: 'test_tool',
    input: Object.freeze({}),
    isFallback,
    startedAtMs: Date.now(),
    requestId: overrides.requestId ?? 'req-1',
    transport: overrides.transport ?? 'stdio',
    authSource: overrides.authSource ?? 'stdio-process',
    callerId: overrides.callerId,
  };
}

describe('usageGuardrailInterceptor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined (allow) when the request count is below the limit', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 3, windowMs: 0, cooldownMs: 0 });
    const result = await interceptor.before(makeContext());
    expect(result).toBeUndefined();
  });

  it('returns { allow: false, code: "RATE_LIMITED" } on the call that meets the limit', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 2, windowMs: 0, cooldownMs: 0 });
    await interceptor.before(makeContext()); // call 1 — allowed
    await interceptor.before(makeContext()); // call 2 — allowed (fills limit)
    const result = await interceptor.before(makeContext()); // call 3 — denied
    expect(result).toMatchObject({ allow: false, code: 'RATE_LIMITED' });
  });

  it('returns { allow: false, code: "RATE_LIMITED" } on every call after the limit is hit', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 1, windowMs: 0, cooldownMs: 0 });
    await interceptor.before(makeContext()); // call 1 — fills limit
    const result1 = await interceptor.before(makeContext());
    const result2 = await interceptor.before(makeContext());
    expect(result1).toMatchObject({ allow: false, code: 'RATE_LIMITED' });
    expect(result2).toMatchObject({ allow: false, code: 'RATE_LIMITED' });
  });

  it('returns undefined for a fallback call even after the limit is exhausted', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 1, windowMs: 0, cooldownMs: 0 });
    await interceptor.before(makeContext()); // fills limit
    await interceptor.before(makeContext()); // hits limit (denied)
    const fallbackResult = await interceptor.before(makeContext(true)); // isFallback = true
    expect(fallbackResult).toBeUndefined();
  });

  it('a regular call followed by a fallback call counts as 1, not 2', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 2, windowMs: 0, cooldownMs: 0 });
    await interceptor.before(makeContext()); // call 1 — allowed (count = 1)
    await interceptor.before(makeContext(true)); // fallback — not counted (count = 1)
    const result = await interceptor.before(makeContext()); // call 2 — should be allowed (count = 2)
    expect(result).toBeUndefined();
  });

  it('rolling window recovery: allows new calls after the window expires', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 2, windowMs: 1000, cooldownMs: 0 });
    await interceptor.before(makeContext()); // call 1
    await interceptor.before(makeContext()); // call 2 — fills limit
    const denied = await interceptor.before(makeContext());
    expect(denied).toMatchObject({ allow: false, code: 'RATE_LIMITED' });

    // Advance time past the window
    vi.advanceTimersByTime(1001);

    const allowed = await interceptor.before(makeContext());
    expect(allowed).toBeUndefined();
  });

  it('process-lifetime cap (windowMs: 0): denies all subsequent calls after limit, even after time advance', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 1, windowMs: 0, cooldownMs: 0 });
    await interceptor.before(makeContext()); // fills limit
    vi.advanceTimersByTime(999999);
    const result = await interceptor.before(makeContext());
    expect(result).toMatchObject({ allow: false, code: 'RATE_LIMITED' });
  });

  it('cooldown blocks calls even after the rolling window would have reset', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 2, windowMs: 100, cooldownMs: 5000 });
    await interceptor.before(makeContext()); // call 1
    await interceptor.before(makeContext()); // call 2 — fills limit
    await interceptor.before(makeContext()); // triggers cooldown

    // Advance past the window but not past the cooldown
    vi.advanceTimersByTime(200);

    const result = await interceptor.before(makeContext());
    expect(result).toMatchObject({ allow: false, code: 'RATE_LIMITED' });
  });

  it('requests succeed again after the cooldown has elapsed', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 1, windowMs: 100, cooldownMs: 5000 });
    await interceptor.before(makeContext()); // fills limit
    await interceptor.before(makeContext()); // triggers cooldown

    // Advance past both window and cooldown
    vi.advanceTimersByTime(6000);

    const result = await interceptor.before(makeContext());
    expect(result).toBeUndefined();
  });

  it('process-lifetime cap with cooldownMs: reason does not include retry hint', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 1, windowMs: 0, cooldownMs: 5000 });
    await interceptor.before(makeContext()); // fills limit
    const result = await interceptor.before(makeContext());
    expect(result).toMatchObject({ allow: false, code: 'RATE_LIMITED' });
    const reason = (result as { reason: string }).reason;
    expect(reason).not.toContain('Retry after');
  });

  it('process-lifetime cap with cooldownMs: permanently blocked after cooldown window passes', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 1, windowMs: 0, cooldownMs: 5000 });
    await interceptor.before(makeContext()); // fills limit
    await interceptor.before(makeContext()); // first deny
    vi.advanceTimersByTime(6000); // past cooldown duration
    const result = await interceptor.before(makeContext()); // still denied
    expect(result).toMatchObject({ allow: false, code: 'RATE_LIMITED' });
  });

  it('tracks counters independently per callerId', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 1, windowMs: 0, cooldownMs: 0 });
    await interceptor.before(makeContext(false, { callerId: 'alpha', requestId: 'req-alpha-1' }));

    const alphaDenied = await interceptor.before(makeContext(false, { callerId: 'alpha', requestId: 'req-alpha-2' }));
    const betaAllowed = await interceptor.before(makeContext(false, { callerId: 'beta', requestId: 'req-beta-1' }));

    expect(alphaDenied).toMatchObject({ allow: false, code: 'RATE_LIMITED' });
    expect(betaAllowed).toBeUndefined();
  });

  it('shares anonymous buckets by transport when callerId is missing', async () => {
    const interceptor = new UsageGuardrailInterceptor({ requestLimit: 1, windowMs: 0, cooldownMs: 0 });
    await interceptor.before(makeContext(false, { transport: 'http', authSource: 'none', requestId: 'req-http-1' }));

    const httpDenied = await interceptor.before(makeContext(false, { transport: 'http', authSource: 'none', requestId: 'req-http-2' }));
    const stdioAllowed = await interceptor.before(makeContext(false, { transport: 'stdio', authSource: 'stdio-process', requestId: 'req-stdio-1' }));

    expect(httpDenied).toMatchObject({ allow: false, code: 'RATE_LIMITED' });
    expect(stdioAllowed).toBeUndefined();
  });
});

describe('usageGuardrailInterceptor — executeTool integration', () => {
  it('deny: result has isError:true and [POLICY:DENIED], executeCore is not called', async () => {
    const executeCoreSpy = vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'result' }] }));
    const interceptors: ToolInterceptor[] = [
      new UsageGuardrailInterceptor({ requestLimit: 1, windowMs: 0, cooldownMs: 0 }),
    ];
    // First call — allowed, fills the limit
    await executeTool({
      toolName: 'test_tool',
      input: { query: 'first' },
      executeCore: executeCoreSpy,
      interceptors,
    });
    executeCoreSpy.mockClear();
    // Second call — denied by guardrail
    const result = await executeTool({
      toolName: 'test_tool',
      input: { query: 'second' },
      executeCore: executeCoreSpy,
      interceptors,
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: 'text'; text: string }).text;
    expect(text).toContain('[POLICY:DENIED]');
    expect(text).toContain('Request limit of 1 exceeded');
    expect(executeCoreSpy).not.toHaveBeenCalled();
  });
});
