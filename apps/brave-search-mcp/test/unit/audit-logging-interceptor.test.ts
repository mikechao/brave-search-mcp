import type { ToolAfterInterceptorContext, ToolInterceptorContext } from '../../src/tools/tool-helpers.js';
import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';
import { AuditLoggingInterceptor } from '../../src/tools/AuditLoggingInterceptor.js';

function makeBeforeContext(input: Record<string, unknown>): ToolInterceptorContext {
  return {
    toolName: 'test_tool',
    input: Object.freeze({ ...input }),
    isFallback: false,
    startedAtMs: 1000,
  };
}

function makeAfterContext(
  overrides: Partial<ToolAfterInterceptorContext> = {},
): ToolAfterInterceptorContext {
  return {
    ...overrides,
    toolName: 'test_tool',
    input: overrides.input ?? Object.freeze({ query: 'secret plan', justification: 'Investigate customer issue' }),
    effectiveInput: overrides.effectiveInput ?? Object.freeze({ query: 'secret plan', justification: 'Investigate customer issue' }),
    isFallback: overrides.isFallback ?? false,
    startedAtMs: overrides.startedAtMs ?? 1000,
    endedAtMs: overrides.endedAtMs ?? 1012,
    outcome: overrides.outcome ?? 'success',
    wasRedacted: overrides.wasRedacted ?? false,
  };
}

describe('auditLoggingInterceptor', () => {
  it('hashes query and justification by default on success', async () => {
    const interceptor = new AuditLoggingInterceptor({ auditLoggingEnabled: true, logRawInputs: false, requireJustification: false });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await interceptor.after(makeAfterContext());

    expect(stderrSpy).toHaveBeenCalledOnce();
    const event = JSON.parse(String(stderrSpy.mock.calls[0][0]));
    expect(event).toMatchObject({
      schemaVersion: '1',
      toolName: 'test_tool',
      outcome: 'success',
      isFallback: false,
      durationMs: 12,
      hasQuery: true,
      justificationProvided: true,
      wasRedacted: false,
      queryLength: 11,
      justificationLength: 26,
    });
    expect(event.queryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.justificationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.query).toBeUndefined();
    expect(event.justification).toBeUndefined();
    stderrSpy.mockRestore();
  });

  it('emits raw text when raw logging is enabled', async () => {
    const interceptor = new AuditLoggingInterceptor({ auditLoggingEnabled: true, logRawInputs: true, requireJustification: false });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await interceptor.after(makeAfterContext({
      input: Object.freeze({ query: 'visible text', justification: 'Allowed for debugging' }),
      effectiveInput: Object.freeze({ query: 'visible text', justification: 'Allowed for debugging' }),
    }));

    const event = JSON.parse(String(stderrSpy.mock.calls[0][0]));
    expect(event.query).toBe('visible text');
    expect(event.justification).toBe('Allowed for debugging');
    expect(event.queryHash).toBeUndefined();
    expect(event.justificationHash).toBeUndefined();
    stderrSpy.mockRestore();
  });

  it('denies missing justification when enforcement is enabled', async () => {
    const interceptor = new AuditLoggingInterceptor({ auditLoggingEnabled: false, logRawInputs: false, requireJustification: true });

    await expect(interceptor.before(makeBeforeContext({ query: 'hello' }))).resolves.toEqual({
      allow: false,
      code: 'JUSTIFICATION_REQUIRED',
      reason: 'A non-empty justification is required',
    });
  });

  it('records deny reason and code from the shared after context', async () => {
    const interceptor = new AuditLoggingInterceptor({ auditLoggingEnabled: true, logRawInputs: false, requireJustification: false });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await interceptor.after(makeAfterContext({
      outcome: 'denied',
      denyCode: 'POLICY_DENIED',
      denyReason: 'Query matched policy rule: "secret"',
    }));

    const event = JSON.parse(String(stderrSpy.mock.calls[0][0]));
    expect(event.outcome).toBe('denied');
    expect(event.denyCode).toBe('POLICY_DENIED');
    expect(event.denyReason).toContain('policy rule');
    stderrSpy.mockRestore();
  });

  it('records redaction and fallback metadata', async () => {
    const interceptor = new AuditLoggingInterceptor({ auditLoggingEnabled: true, logRawInputs: false, requireJustification: false });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await interceptor.after(makeAfterContext({
      isFallback: true,
      wasRedacted: true,
      input: Object.freeze({ query: 'original secret', justification: 'Why', url: 'https://example.com/page' }),
      effectiveInput: Object.freeze({ query: '[REDACTED]', justification: 'Why', url: 'https://example.com/page' }),
    }));

    const event = JSON.parse(String(stderrSpy.mock.calls[0][0]));
    expect(event.isFallback).toBe(true);
    expect(event.wasRedacted).toBe(true);
    expect(event.hasUrl).toBe(true);
    expect(event.urlHash).toMatch(/^[a-f0-9]{64}$/);
    stderrSpy.mockRestore();
  });

  it('records url-only requests used by llm context search', async () => {
    const interceptor = new AuditLoggingInterceptor({ auditLoggingEnabled: true, logRawInputs: false, requireJustification: false });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await interceptor.after(makeAfterContext({
      input: Object.freeze({ url: 'https://example.com/doc', justification: 'Read a specific page' }),
      effectiveInput: Object.freeze({ url: 'https://example.com/doc', justification: 'Read a specific page' }),
    }));

    const event = JSON.parse(String(stderrSpy.mock.calls[0][0]));
    expect(event.hasQuery).toBe(false);
    expect(event.hasUrl).toBe(true);
    expect(event.urlLength).toBe(23);
    stderrSpy.mockRestore();
  });

  it('records normalized error text for executeCore failures', async () => {
    const interceptor = new AuditLoggingInterceptor({ auditLoggingEnabled: true, logRawInputs: false, requireJustification: false });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await interceptor.after(makeAfterContext({
      outcome: 'error',
      errorMessage: 'upstream timeout',
    }));

    const event = JSON.parse(String(stderrSpy.mock.calls[0][0]));
    expect(event.outcome).toBe('error');
    expect(event.errorMessage).toBe('upstream timeout');
    stderrSpy.mockRestore();
  });

  it('marks blank justification as not provided while preserving the original field data', async () => {
    const interceptor = new AuditLoggingInterceptor({ auditLoggingEnabled: true, logRawInputs: true, requireJustification: false });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await interceptor.after(makeAfterContext({
      outcome: 'denied',
      denyCode: 'JUSTIFICATION_REQUIRED',
      denyReason: 'A non-empty justification is required',
      input: Object.freeze({ query: 'visible text', justification: '' }),
      effectiveInput: Object.freeze({ query: 'visible text', justification: '' }),
    }));

    const event = JSON.parse(String(stderrSpy.mock.calls[0][0]));
    expect(event.justificationProvided).toBe(false);
    expect(event.justification).toBe('');
    expect(event.justificationLength).toBe(0);
    stderrSpy.mockRestore();
  });

  it('emits nothing in after() when auditLoggingEnabled is false', async () => {
    const interceptor = new AuditLoggingInterceptor({ auditLoggingEnabled: false, logRawInputs: false, requireJustification: false });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await interceptor.after(makeAfterContext());

    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });
});
