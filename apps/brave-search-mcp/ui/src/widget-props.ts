/**
 * Shared WidgetProps interface for both MCP-APP and ChatGPT modes
 */
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type DisplayMode = 'inline' | 'fullscreen' | 'pip';

export interface SaveImageParams {
  imageUrl: string;
  title: string;
}

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
  requestDisplayMode?: (mode: DisplayMode) => Promise<void>;
  /** Save an image to model context (for follow-up conversations) */
  onSaveImage?: (params: SaveImageParams) => Promise<void>;
}
