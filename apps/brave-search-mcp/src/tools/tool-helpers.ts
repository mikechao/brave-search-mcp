import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

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

interface ExecuteToolOptions<TInput> {
  toolName: string;
  input: TInput;
  executeCore: (input: TInput) => Promise<CallToolResult>;
  buildErrorResult?: (input: TInput, error: unknown) => CallToolResult;
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
}: ExecuteToolOptions<TInput>): Promise<CallToolResult> {
  try {
    return await executeCore(input);
  }
  catch (error) {
    console.error(`Error executing ${toolName}:`, error);
    return buildErrorResult
      ? buildErrorResult(input, error)
      : buildDefaultErrorResult(toolName, error);
  }
}
