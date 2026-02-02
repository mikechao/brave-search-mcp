/**
 * useOpenAiGlobal hook for ChatGPT Apps SDK integration
 *
 * Based on the reference implementation from:
 * https://developers.openai.com/apps-sdk/build/chatgpt-ui
 *
 * This hook listens for host `openai:set_globals` events and lets React
 * components subscribe to a single global value reactively.
 */
import type { OpenAISetGlobalsEvent, OpenAIWidgetRuntime } from '../openai.d';
import { useCallback, useSyncExternalStore } from 'react';

const SET_GLOBALS_EVENT_TYPE = 'openai:set_globals';

/**
 * Subscribe to a specific window.openai global value reactively.
 * Uses useSyncExternalStore with stable callbacks for correct subscription behavior.
 *
 * Note: Only works for reactive values that are updated via events.
 * Functions like openExternal and requestDisplayMode are set at initialization
 * and should be accessed directly from window.openai.
 */
export function useOpenAiGlobal<K extends keyof OpenAIWidgetRuntime>(
  key: K,
): OpenAIWidgetRuntime[K] | undefined {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === 'undefined')
      return () => {};

    const handleSetGlobal = (event: Event) => {
      const customEvent = event as OpenAISetGlobalsEvent;
      if (customEvent.detail?.globals && key in customEvent.detail.globals) {
        onStoreChange();
      }
    };

    window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
      passive: true,
    });

    return () => {
      window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
    };
  }, [key]);

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined')
      return undefined;
    return window.openai?.[key];
  }, [key]);
  const getServerSnapshot = useCallback(() => undefined, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ============================================================================
// Convenience Hooks - Reactive Values
// ============================================================================

/** Tool arguments passed to the current tool */
export function useToolInput() {
  return useOpenAiGlobal('toolInput');
}

/** Structured content returned by the tool */
export function useToolOutput() {
  return useOpenAiGlobal('toolOutput');
}

/** Metadata from the tool response */
export function useToolResponseMetadata() {
  return useOpenAiGlobal('toolResponseMetadata');
}

/** Persisted widget state */
export function useWidgetState() {
  return useOpenAiGlobal('widgetState');
}

/** Current display mode ('inline' | 'fullscreen' | 'pip') */
export function useDisplayMode() {
  return useOpenAiGlobal('displayMode');
}

/** Current theme ('light' | 'dark') */
export function useTheme() {
  return useOpenAiGlobal('theme');
}

/** Maximum height in pixels for inline mode */
export function useMaxHeight() {
  return useOpenAiGlobal('maxHeight');
}

/** Safe area insets for mobile devices */
export function useSafeArea() {
  return useOpenAiGlobal('safeArea');
}

/** User's locale (e.g., 'en-US') */
export function useLocale() {
  return useOpenAiGlobal('locale');
}

/** User agent string */
export function useUserAgent() {
  return useOpenAiGlobal('userAgent');
}

/** Current view identifier */
export function useView() {
  return useOpenAiGlobal('view');
}
