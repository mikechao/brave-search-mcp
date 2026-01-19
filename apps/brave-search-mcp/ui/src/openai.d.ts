/**
 * Type declarations for ChatGPT's window.openai runtime API
 */

interface SafeAreaInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

interface OpenAIToolOutput {
  [key: string]: unknown;
}

interface OpenAIWidgetRuntime {
  toolOutput?: OpenAIToolOutput;
  toolInput?: Record<string, unknown>;
  toolResponseMetadata?: Record<string, unknown>;
  widgetState?: Record<string, unknown>;
  theme?: 'light' | 'dark';
  displayMode?: string;
  maxHeight?: number;
  locale?: string;
  safeAreaInsets?: SafeAreaInsets;

  // Methods
  setWidgetState?: (state: Record<string, unknown>) => void;
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  sendFollowUpMessage?: (message: string) => Promise<void>;
  openExternal?: (options: { href: string }) => Promise<void>;
  notifyIntrinsicHeight?: (height: number) => void;
  requestDisplayMode?: (options: { mode: 'inline' | 'fullscreen' | 'pip' }) => Promise<void>;
}

declare global {
  interface Window {
    openai?: OpenAIWidgetRuntime;
  }
}

export { };
