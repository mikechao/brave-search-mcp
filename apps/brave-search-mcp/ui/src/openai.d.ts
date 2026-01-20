/**
 * Type declarations for ChatGPT's window.openai runtime API (Apps SDK)
 *
 * Based on official documentation:
 * - https://developers.openai.com/apps-sdk/build/chatgpt-ui
 * - https://developers.openai.com/apps-sdk/reference
 */

// ============================================================================
// Data Types
// ============================================================================

/**
 * Safe area insets for mobile devices
 */
interface SafeAreaInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * Tool input - arguments passed to the tool
 */
interface OpenAIToolInput {
  [key: string]: unknown;
}

/**
 * Tool output - structured content returned by the tool
 */
interface OpenAIToolOutput {
  [key: string]: unknown;
}

/**
 * Tool response metadata (_meta fields)
 */
interface OpenAIToolResponseMetadata {
  'openai/widgetSessionId'?: string;
  'openai/closeWidget'?: boolean;
  'openai/widgetDomain'?: string;
  'openai/widgetCSP'?: {
    connect_domains?: string[];
    resource_domains?: string[];
    redirect_domains?: string[];
    frame_domains?: string[];
  };
  [key: string]: unknown;
}

/**
 * Widget state - persisted across user sessions
 * Also exposed to ChatGPT model during follow-up turns
 */
interface OpenAIWidgetState {
  /** Content visible to the model */
  modelContent?: Record<string, unknown>;
  /** Content NOT visible to the model */
  privateContent?: Record<string, unknown>;
  /** Image IDs for follow-up turns */
  imageIds?: string[];
  [key: string]: unknown;
}

/**
 * Display modes for the widget
 */
type OpenAIDisplayMode = 'inline' | 'fullscreen' | 'pip';

/**
 * Theme variants
 */
type OpenAITheme = 'light' | 'dark';

// ============================================================================
// Method Types
// ============================================================================

/**
 * Options for openExternal
 */
interface OpenExternalOptions {
  href: string;
}

/**
 * Options for requestDisplayMode
 */
interface RequestDisplayModeOptions {
  mode: OpenAIDisplayMode;
}

/**
 * Options for requestModal
 */
interface RequestModalOptions {
  /** Template URI registered via registerResource (e.g., "ui://widget/checkout.html") */
  template?: string;
  params?: Record<string, unknown>;
}

/**
 * Options for sendFollowUpMessage
 */
interface SendFollowUpMessageOptions {
  prompt: string;
}

/**
 * Options for getFileDownloadUrl
 */
interface GetFileDownloadUrlOptions {
  fileId: string;
}

/**
 * Result from uploadFile
 */
interface UploadFileResult {
  fileId: string;
}

/**
 * Result from getFileDownloadUrl
 */
interface GetFileDownloadUrlResult {
  downloadUrl: string;
}

/**
 * Options for setOpenInAppUrl
 */
interface SetOpenInAppUrlOptions {
  href: string;
}

// ============================================================================
// Main Interface
// ============================================================================

/**
 * The window.openai component bridge
 *
 * This is the main interface between your widget and ChatGPT.
 * Values are set via the host and can be read directly or through
 * reactive hooks that listen for 'openai:set_globals' events.
 */
interface OpenAIWidgetRuntime {
  // -------------------------------------------------------------------------
  // Reactive Values (updated via openai:set_globals events)
  // -------------------------------------------------------------------------

  /** Arguments passed to the tool */
  toolInput?: OpenAIToolInput;

  /** Structured content returned by the tool (structuredContent from tool result) */
  toolOutput?: OpenAIToolOutput;

  /** Metadata from the tool response (_meta fields) */
  toolResponseMetadata?: OpenAIToolResponseMetadata;

  /** Persisted widget state (synced via setWidgetState) */
  widgetState?: OpenAIWidgetState;

  /** Current color theme ('light' | 'dark') */
  theme?: OpenAITheme;

  /** Current display mode layout */
  displayMode?: OpenAIDisplayMode;

  /** Maximum height in pixels for inline mode */
  maxHeight?: number;

  /** Safe area insets for mobile devices */
  safeArea?: SafeAreaInsets;

  /** User's locale (e.g., 'en-US') */
  locale?: string;

  /** User agent string */
  userAgent?: string;

  /** Current view identifier */
  view?: string;

  // -------------------------------------------------------------------------
  // Methods (set at initialization, accessed directly from window.openai)
  // -------------------------------------------------------------------------

  /**
   * Persist widget state across sessions and expose to ChatGPT
   * @param state - State object to persist
   */
  setWidgetState?: (state: OpenAIWidgetState) => void;

  /**
   * Call another tool from within the widget
   * @param name - Tool name
   * @param args - Tool arguments
   * @returns Promise resolving to tool result
   */
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;

  /**
   * Send a follow-up message as if the user typed it
   * @param options - Message options
   */
  sendFollowUpMessage?: (options: SendFollowUpMessageOptions) => Promise<void>;

  /**
   * Upload a file (supports image/png, image/jpeg, image/webp)
   * @param file - File to upload
   * @returns Promise with fileId
   */
  uploadFile?: (file: File) => Promise<UploadFileResult>;

  /**
   * Get a temporary download URL for a file
   * @param options - Options with fileId
   * @returns Promise with downloadUrl
   */
  getFileDownloadUrl?: (options: GetFileDownloadUrlOptions) => Promise<GetFileDownloadUrlResult>;

  /**
   * Request a different display mode (inline, fullscreen, pip)
   * Note: On mobile, PiP may be coerced to fullscreen
   * @param options - Display mode options
   */
  requestDisplayMode?: (options: RequestDisplayModeOptions) => Promise<void>;

  /**
   * Open a host-controlled modal with a different UI template
   * @param options - Modal options
   */
  requestModal?: (options: RequestModalOptions) => Promise<void>;

  /**
   * Notify the host of the widget's intrinsic height
   * @param height - Height in pixels
   */
  notifyIntrinsicHeight?: (height: number) => void;

  /**
   * Open an external URL
   * @param options - URL options
   */
  openExternal?: (options: OpenExternalOptions) => Promise<void>;

  /**
   * Set the "Open in App" URL for native app integration
   * @param options - URL options
   */
  setOpenInAppUrl?: (options: SetOpenInAppUrlOptions) => void;

  /**
   * Request to close the widget
   */
  requestClose?: () => void;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event dispatched when globals are updated
 */
interface OpenAISetGlobalsEvent extends CustomEvent {
  detail: {
    globals: Partial<OpenAIWidgetRuntime>;
  };
}

// ============================================================================
// Global Declaration
// ============================================================================

declare global {
  interface Window {
    openai?: OpenAIWidgetRuntime;
  }

  interface WindowEventMap {
    'openai:set_globals': OpenAISetGlobalsEvent;
  }
}

export {
  OpenAIDisplayMode,
  OpenAISetGlobalsEvent,
  OpenAITheme,
  OpenAIToolInput,
  OpenAIToolOutput,
  OpenAIToolResponseMetadata,
  OpenAIWidgetRuntime,
  OpenAIWidgetState,
  SafeAreaInsets,
};
