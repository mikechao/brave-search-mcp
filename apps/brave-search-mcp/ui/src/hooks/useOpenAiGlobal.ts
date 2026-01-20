/**
 * useOpenAiGlobal hook for ChatGPT Apps SDK integration
 * 
 * Based on the reference implementation from:
 * https://developers.openai.com/apps-sdk/build/chatgpt-ui
 * 
 * This hook listens for host `openai:set_globals` events and lets React
 * components subscribe to a single global value reactively.
 */
import { useSyncExternalStore } from 'react';

const SET_GLOBALS_EVENT_TYPE = 'openai:set_globals';

interface SetGlobalsEvent extends Event {
    detail: {
        globals: Partial<OpenAiGlobals>;
    };
}

/**
 * Type definitions for window.openai properties
 */
export interface OpenAiGlobals {
    toolInput: Record<string, unknown> | null;
    toolOutput: Record<string, unknown> | null;
    toolResponseMetadata: Record<string, unknown> | null;
    widgetState: Record<string, unknown> | null;
    displayMode: 'inline' | 'fullscreen' | 'pip' | undefined;
    theme: 'light' | 'dark' | undefined;
    maxHeight: number | undefined;
    safeArea: { top: number; right: number; bottom: number; left: number } | undefined;
    locale: string | undefined;
    userAgent: string | undefined;
    view: string | undefined;
    openExternal: ((params: { href: string }) => void) | undefined;
    requestDisplayMode: ((params: { mode: 'inline' | 'fullscreen' | 'pip' }) => Promise<void>) | undefined;
    callTool: ((name: string, args: Record<string, unknown>) => Promise<unknown>) | undefined;
    sendFollowUpMessage: ((message: string) => void) | undefined;
    setWidgetState: ((state: Record<string, unknown>) => void) | undefined;
    uploadFile: ((file: File) => Promise<{ url: string }>) | undefined;
    getFileDownloadUrl: ((fileId: string) => Promise<string>) | undefined;
    notifyIntrinsicHeight: ((height: number) => void) | undefined;
    requestModal: ((params: { template: string }) => void) | undefined;
    close: (() => void) | undefined;
}

// Note: Window.openai is declared in openai.d.ts

/**
 * Subscribe to a specific window.openai global value reactively.
 * Re-renders only when that specific key changes.
 */
export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
    key: K
): OpenAiGlobals[K] | undefined {
    return useSyncExternalStore(
        (onChange) => {
            const handleSetGlobal = (event: Event) => {
                const setGlobalsEvent = event as SetGlobalsEvent;
                const value = setGlobalsEvent.detail?.globals?.[key];
                if (value === undefined) {
                    return;
                }
                onChange();
            };

            window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
                passive: true,
            });

            return () => {
                window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
            };
        },
        // Cast to avoid type conflict with openai.d.ts OpenAIWidgetRuntime
        () => (window.openai as OpenAiGlobals | undefined)?.[key]
    );
}

// Convenience hooks for common use cases
export function useToolInput() {
    return useOpenAiGlobal('toolInput');
}

export function useToolOutput() {
    return useOpenAiGlobal('toolOutput');
}

export function useDisplayMode() {
    return useOpenAiGlobal('displayMode');
}

export function useTheme() {
    return useOpenAiGlobal('theme');
}

export function useOpenExternal() {
    return useOpenAiGlobal('openExternal');
}

export function useRequestDisplayMode() {
    return useOpenAiGlobal('requestDisplayMode');
}

export function useCallTool() {
    return useOpenAiGlobal('callTool');
}
