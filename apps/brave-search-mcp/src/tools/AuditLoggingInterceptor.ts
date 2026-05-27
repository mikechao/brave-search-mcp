import type { AuthSource, TransportKind } from '../auth/identity-context.js';
import type { PreInterceptorResult, ToolAfterInterceptorContext, ToolInterceptor, ToolInterceptorContext } from './tool-helpers.js';
import { createHash } from 'node:crypto';
import process from 'node:process';

export interface AuditLoggingConfig {
  auditLoggingEnabled: boolean;
  logRawInputs: boolean;
  requireJustification: boolean;
}

export interface AuditEvent {
  schemaVersion: '1';
  timestamp: string;
  requestId: string;
  transport: TransportKind;
  authSource: AuthSource;
  callerId?: string;
  toolName: string;
  outcome: 'success' | 'error' | 'denied';
  isFallback: boolean;
  durationMs: number;
  hasQuery: boolean;
  queryHash?: string;
  query?: string;
  queryLength?: number;
  hasUrl: boolean;
  urlHash?: string;
  url?: string;
  urlLength?: number;
  justificationProvided: boolean;
  justificationHash?: string;
  justification?: string;
  justificationLength?: number;
  wasRedacted: boolean;
  denyCode?: string;
  denyReason?: string;
  errorMessage?: string;
}

export function writeAuditEvent(event: AuditEvent): void {
  process.stderr.write(`${JSON.stringify(event)}\n`);
}

export class AuditLoggingInterceptor implements ToolInterceptor {
  constructor(private readonly config: AuditLoggingConfig) {}

  async before(context: ToolInterceptorContext): Promise<PreInterceptorResult | void> {
    if (!this.config.requireJustification)
      return;

    const justification = typeof context.input.justification === 'string'
      ? context.input.justification.trim()
      : '';

    if (!justification) {
      return {
        allow: false,
        code: 'JUSTIFICATION_REQUIRED',
        reason: 'A non-empty justification is required',
      };
    }
  }

  async after(context: ToolAfterInterceptorContext): Promise<void> {
    if (!this.config.auditLoggingEnabled)
      return;
    writeAuditEvent(this.buildEvent(context));
  }

  private buildEvent(context: ToolAfterInterceptorContext): AuditEvent {
    const query = this.readStringField(context.input, 'query');
    const url = this.readStringField(context.input, 'url');
    const justification = this.readStringField(context.input, 'justification');
    const hasMeaningfulJustification = this.hasMeaningfulJustification(justification);

    return {
      schemaVersion: '1',
      timestamp: new Date(context.endedAtMs).toISOString(),
      requestId: context.requestId,
      transport: context.transport,
      authSource: context.authSource,
      ...(context.callerId ? { callerId: context.callerId } : {}),
      toolName: context.toolName,
      outcome: context.outcome,
      isFallback: context.isFallback,
      durationMs: Math.max(context.endedAtMs - context.startedAtMs, 0),
      hasQuery: query !== undefined,
      ...this.serializeOptionalTextField('query', query),
      hasUrl: url !== undefined,
      ...this.serializeOptionalTextField('url', url),
      // Audit the caller's original request, not the potentially redacted effective input.
      // `wasRedacted` signals that execution used a sanitized form instead.
      // `callerId` is the normalized identity surface. Audit logs must not try to
      // reconstruct credentials or auth material from transport-specific inputs.
      justificationProvided: hasMeaningfulJustification,
      ...this.serializeOptionalTextField('justification', justification),
      wasRedacted: context.wasRedacted,
      ...(context.denyCode ? { denyCode: context.denyCode } : {}),
      ...(context.denyReason ? { denyReason: context.denyReason } : {}),
      ...(context.errorMessage ? { errorMessage: context.errorMessage } : {}),
    };
  }

  private readStringField(
    input: Readonly<Record<string, unknown>>,
    key: 'query' | 'url' | 'justification',
  ): string | undefined {
    const value = input[key];
    return typeof value === 'string' ? value : undefined;
  }

  private hasMeaningfulJustification(value: string | undefined): boolean {
    return !!value?.trim().length;
  }

  private serializeOptionalTextField(
    key: 'query' | 'url' | 'justification',
    value: string | undefined,
  ): Partial<AuditEvent> {
    if (value === undefined)
      return {};

    const lengthKey = `${key}Length` as const;
    if (this.config.logRawInputs) {
      return {
        [key]: value,
        [lengthKey]: value.length,
      };
    }

    const hashKey = `${key}Hash` as const;
    return {
      [hashKey]: createHash('sha256').update(value).digest('hex'),
      [lengthKey]: value.length,
    };
  }
}
