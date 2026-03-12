import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

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
