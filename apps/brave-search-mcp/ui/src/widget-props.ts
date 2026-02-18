/**
 * Shared WidgetProps interface for both MCP-APP and ChatGPT modes
 */
import type { App, McpUiDisplayMode, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type DisplayMode = McpUiDisplayMode;

/**
 * Flexible tool result type that accepts both full CallToolResult (MCP mode)
 * and partial results with only structuredContent (ChatGPT mode).
 * Uses generic structuredContent to avoid index-signature incompatibilities
 * with domain-specific interfaces.
 */
export type ToolResult = Pick<CallToolResult, '_meta' | 'isError'> & {
  content?: CallToolResult['content'];
  structuredContent?: unknown;
};

export interface WidgetProps<TToolInput = Record<string, unknown>> {
  toolInputs: TToolInput | null;
  toolInputsPartial: TToolInput | null;
  toolResult: ToolResult | null;
  hostContext: McpUiHostContext | null;
  callServerTool?: App['callServerTool'];
  sendMessage?: App['sendMessage'];
  openLink: App['openLink'];
  sendLog: App['sendLog'];
  displayMode?: DisplayMode;
  /** Request a display mode change. Returns the actual mode that was set (may differ from requested). */
  requestDisplayMode?: (mode: DisplayMode) => Promise<DisplayMode | undefined>;
  /** Display modes available on the host (for checking before requesting) */
  availableDisplayModes?: DisplayMode[];
}
