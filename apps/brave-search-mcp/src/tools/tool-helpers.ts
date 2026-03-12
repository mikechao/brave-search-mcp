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

const pagedSearchOutputBaseShape = {
  query: z.string(),
  count: z.number(),
  pageSize: z.number().optional(),
  returnedCount: z.number().optional(),
  offset: z.number().optional(),
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

export const webSearchOutputSchema = createPagedSearchOutputSchema(webResultSchema);

export type PagedStructuredContent<TItem, TExtra extends object = Record<string, never>> = {
  query: string;
  count: number;
  pageSize: number;
  returnedCount: number;
  offset?: number;
  items: TItem[];
} & TExtra;

interface BuildPagedStructuredContentInput<TItem, TExtra extends object> {
  query: string;
  count: number;
  items: TItem[];
  offset?: number;
  returnedCount?: number;
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
  extra,
}: BuildPagedStructuredContentInput<TItem, TExtra>): PagedStructuredContent<TItem, TExtra> {
  return {
    query,
    count,
    pageSize: count,
    returnedCount: returnedCount ?? items.length,
    ...(offset !== undefined ? { offset } : {}),
    items,
    ...(extra ?? {} as TExtra),
  };
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
