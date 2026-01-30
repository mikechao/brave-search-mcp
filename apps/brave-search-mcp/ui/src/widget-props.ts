/**
 * Shared WidgetProps interface for both MCP-APP and ChatGPT modes
 */
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type DisplayMode = 'inline' | 'fullscreen' | 'pip';

export interface WidgetProps<TToolInput = Record<string, unknown>> {
  toolInputs: TToolInput | null;
  toolInputsPartial: TToolInput | null;
  toolResult: CallToolResult | null;
  hostContext: McpUiHostContext | null;
  callServerTool: App['callServerTool'];
  sendMessage: App['sendMessage'];
  openLink: App['openLink'];
  sendLog: App['sendLog'];
  displayMode?: DisplayMode;
  /** Request a display mode change. Returns the actual mode that was set (may differ from requested). */
  requestDisplayMode?: (mode: DisplayMode) => Promise<DisplayMode | undefined>;
  /** Display modes available on the host (for checking before requesting) */
  availableDisplayModes?: DisplayMode[];
}
