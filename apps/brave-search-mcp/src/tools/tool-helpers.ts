import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AuthSource, TransportKind } from '../auth/identity-context.js';
import { z } from 'zod';
import { createRequestContext, getRequestContext } from '../auth/identity-context.js';

export type ToolLogLevel
  = 'error'
    | 'debug'
    | 'info'
    | 'notice'
    | 'warning'
    | 'critical'
    | 'alert'
    | 'emergency';

export type ToolLogger = (
  message: string,
  level?: ToolLogLevel,
) => void;

export interface LocalWebFallbackInput {
  query: string;
  count?: number;
  offset?: number;
  justification?: string;
}

export type LocalWebFallbackExecutor = (
  input: LocalWebFallbackInput,
) => Promise<CallToolResult>;

const FRESHNESS_DATE_RANGE_PATTERN = /^\d{4}-\d{2}-\d{2}to\d{4}-\d{2}-\d{2}$/;
const FRESHNESS_FORMAT_ERROR = 'Date range must be in format YYYY-MM-DDtoYYYY-MM-DD';
const FRESHNESS_DATE_VALIDATION_ERROR = 'Date range must contain valid calendar dates and start date must not be after end date';
const FRESHNESS_DESCRIPTION = `Filters search results by when they were discovered.
The following values are supported:
- pd: Discovered within the last 24 hours.
- pw: Discovered within the last 7 Days.
- pm: Discovered within the last 31 Days.
- py: Discovered within the last 365 Days.
- YYYY-MM-DDtoYYYY-MM-DD: Custom date range (e.g., 2022-04-01to2022-07-30)`;

const pagedSearchOutputBaseShape = {
  query: z.string(),
  count: z.number(),
  pageSize: z.number().optional(),
  returnedCount: z.number().optional(),
  offset: z.number().optional(),
  moreResultsAvailable: z.boolean().optional(),
  error: z.string().optional(),
} satisfies z.ZodRawShape;

export const webResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string(),
  domain: z.string().optional().default(''),
  favicon: z.string().optional(),
  age: z.string().optional(),
  thumbnail: z.object({
    src: z.string(),
    height: z.number().optional(),
    width: z.number().optional(),
  }).optional(),
});

export const freshnessInputSchema = z.union([
  z.enum(['pd', 'pw', 'pm', 'py']),
  z.string().superRefine((value, ctx) => {
    if (!FRESHNESS_DATE_RANGE_PATTERN.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: FRESHNESS_FORMAT_ERROR,
      });
      return;
    }

    if (!isValidDateRange(value)) {
      ctx.addIssue({
        code: 'custom',
        message: FRESHNESS_DATE_VALIDATION_ERROR,
      });
    }
  }),
])
  .optional()
  .describe(FRESHNESS_DESCRIPTION);

export const justificationInputSchema = z.string().optional().describe(
  'Optional operator-facing reason for the request, used by audit logging and optional justification enforcement.',
);

export const webSearchOutputSchema = createPagedSearchOutputSchema(webResultSchema);

export type PagedStructuredContent<TItem, TExtra extends object = Record<string, never>> = {
  query: string;
  count: number;
  pageSize: number;
  returnedCount: number;
  offset?: number;
  moreResultsAvailable?: boolean;
  items: TItem[];
} & TExtra;

interface BuildPagedStructuredContentInput<TItem, TExtra extends object> {
  query: string;
  count: number;
  items: TItem[];
  offset?: number;
  returnedCount?: number;
  moreResultsAvailable?: boolean;
  extra?: TExtra;
}

export type ToolExecutionOutcome = 'success' | 'error' | 'denied';

export interface ToolInterceptorContext<TInput extends Record<string, unknown> = Record<string, unknown>> {
  toolName: string;
  input: Readonly<TInput>;
  isFallback: boolean;
  startedAtMs: number;
  requestId: string;
  transport: TransportKind;
  authSource: AuthSource;
  callerId?: string;
  scopes?: string[];
}

export interface ToolAfterInterceptorContext<TInput extends Record<string, unknown> = Record<string, unknown>>
  extends ToolInterceptorContext<TInput> {
  outcome: ToolExecutionOutcome;
  endedAtMs: number;
  effectiveInput: Readonly<Record<string, unknown>>;
  wasRedacted: boolean;
  denyCode?: string;
  denyReason?: string;
  errorMessage?: string;
}

export interface PreInterceptorResult {
  allow: boolean;
  reason?: string;
  code?: string;
  redactedInput?: Readonly<Record<string, unknown>>;
}

export interface ToolInterceptor<TInput extends Record<string, unknown> = Record<string, unknown>> {
  before?: (context: ToolInterceptorContext<TInput>) => Promise<PreInterceptorResult | void>;
  after?: (context: ToolAfterInterceptorContext<TInput>) => Promise<void>;
}

interface ExecuteToolOptions<TInput> {
  toolName: string;
  input: TInput;
  executeCore: (input: TInput) => Promise<CallToolResult>;
  buildErrorResult?: (input: TInput, error: unknown) => CallToolResult;
  interceptors?: readonly ToolInterceptor[];
  isFallback?: boolean;
}

export function createPagedSearchOutputSchema<
  TItemSchema extends z.ZodTypeAny,
  TExtraShape extends z.ZodRawShape = z.ZodRawShape,
>(
  itemSchema: TItemSchema,
  extraShape?: TExtraShape,
) {
  return z.object({
    ...pagedSearchOutputBaseShape,
    items: z.array(itemSchema),
    ...(extraShape ?? {}),
  });
}

export function buildStructuredToolResult<TStructuredContent extends object>(
  text: string,
  structuredContent?: TStructuredContent,
): CallToolResult {
  const result: CallToolResult = {
    content: [{ type: 'text', text }],
  };

  if (structuredContent !== undefined) {
    result._meta = {
      structuredContent,
    };
  }

  return result;
}

export function buildPagedStructuredContent<
  TItem,
  TExtra extends object = Record<string, never>,
>({
  query,
  count,
  items,
  offset,
  returnedCount,
  moreResultsAvailable,
  extra,
}: BuildPagedStructuredContentInput<TItem, TExtra>): PagedStructuredContent<TItem, TExtra> {
  return {
    query,
    count,
    pageSize: count,
    returnedCount: returnedCount ?? items.length,
    ...(offset !== undefined ? { offset } : {}),
    ...(moreResultsAvailable !== undefined ? { moreResultsAvailable } : {}),
    items,
    ...(extra ?? {} as TExtra),
  };
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isValidDateRange(dateRange: string): boolean {
  const match = dateRange.match(/^(\d{4}-\d{2}-\d{2})to(\d{4}-\d{2}-\d{2})$/);
  if (!match)
    return false;

  const [, startDateStr, endDateStr] = match;
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return false;

  if (startDate.toISOString().slice(0, 10) !== startDateStr || endDate.toISOString().slice(0, 10) !== endDateStr)
    return false;

  return startDate.getTime() <= endDate.getTime();
}

export function buildDefaultErrorResult(toolName: string, error: unknown): CallToolResult {
  return {
    content: [{
      type: 'text',
      text: `Error in ${toolName}: ${error}`,
    }],
    isError: true,
  };
}

export function buildToolErrorResult(
  toolName: string,
  error: unknown,
  structuredContent?: object,
): CallToolResult {
  return {
    ...buildStructuredToolResult(
      `Error in ${toolName}: ${getErrorMessage(error)}`,
      structuredContent,
    ),
    isError: true,
  };
}

export async function executeTool<TInput>({
  toolName,
  input,
  executeCore,
  buildErrorResult,
  interceptors,
  isFallback = false,
}: ExecuteToolOptions<TInput>): Promise<CallToolResult> {
  const startedAtMs = Date.now();
  const frozenInput = Object.freeze({ ...(input as Record<string, unknown>) }) as Readonly<Record<string, unknown>>;
  const requestContext = getRequestContext() ?? createRequestContext({ transport: 'stdio', authSource: 'none' });
  const context: ToolInterceptorContext = {
    toolName,
    input: frozenInput,
    isFallback,
    startedAtMs,
    requestId: requestContext.requestId,
    transport: requestContext.identity.transport,
    authSource: requestContext.identity.authSource,
    ...(requestContext.identity.callerId ? { callerId: requestContext.identity.callerId } : {}),
    ...(requestContext.identity.scopes?.length ? { scopes: requestContext.identity.scopes } : {}),
  };
  let wasRedacted = false;
  let denyCode: string | undefined;
  let denyReason: string | undefined;
  let errorMessage: string | undefined;

  async function runAfterHooks(outcome: ToolExecutionOutcome, effectiveInputForAfter: Readonly<Record<string, unknown>>): Promise<void> {
    if (!interceptors?.length)
      return;
    const afterContext: ToolAfterInterceptorContext = {
      ...context,
      outcome,
      endedAtMs: Date.now(),
      effectiveInput: effectiveInputForAfter,
      wasRedacted,
      ...(denyCode ? { denyCode } : {}),
      ...(denyReason ? { denyReason } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    };
    for (const interceptor of interceptors) {
      if (interceptor.after) {
        try {
          await interceptor.after(afterContext);
        }
        catch (err) {
          console.error(`Error in after() interceptor for ${toolName}:`, err);
        }
      }
    }
  }

  let effectiveInput: TInput = input;
  // beforeContext accumulates redactions so each successive before() hook sees
  // the output of prior redactions. context (used by after() hooks) is never
  // mutated so audit interceptors always see the original input.
  let beforeContext: ToolInterceptorContext = context;

  try {
    // Run before() hooks in order; short-circuit on first deny
    for (const interceptor of interceptors ?? []) {
      if (interceptor.before) {
        const result = await interceptor.before(beforeContext);
        if (result && result.allow === false) {
          denyCode = result.code;
          denyReason = result.reason ?? 'request denied';
          const denyError = new Error(`[POLICY:DENIED] ${result.reason ?? 'request denied'}`);
          const denyResult = buildErrorResult
            ? buildErrorResult(input, denyError)
            : buildDefaultErrorResult(toolName, denyError);
          await runAfterHooks('denied', beforeContext.input);
          return denyResult;
        }
        if (result?.redactedInput) {
          effectiveInput = { ...result.redactedInput } as TInput;
          wasRedacted = true;
          beforeContext = { ...context, input: Object.freeze({ ...result.redactedInput }) };
        }
      }
    }

    const toolResult = await executeCore(effectiveInput);
    await runAfterHooks('success', beforeContext.input);
    return toolResult;
  }
  catch (error) {
    console.error(`Error executing ${toolName}:`, error);
    errorMessage = getErrorMessage(error);
    await runAfterHooks('error', beforeContext.input);
    return buildErrorResult
      ? buildErrorResult(input, error)
      : buildDefaultErrorResult(toolName, error);
  }
}
