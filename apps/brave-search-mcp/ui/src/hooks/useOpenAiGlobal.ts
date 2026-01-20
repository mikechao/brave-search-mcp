/**
 * useOpenAiGlobal hook for ChatGPT Apps SDK integration
 * 
 * Based on the reference implementation from:
 * https://developers.openai.com/apps-sdk/build/chatgpt-ui
 * 
 * This hook listens for host `openai:set_globals` events and lets React
 * components subscribe to a single global value reactively.
 */
import { useEffect, useState } from 'react';

const SET_GLOBALS_EVENT_TYPE = 'openai:set_globals';

interface SetGlobalsEvent extends CustomEvent {
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
 * Uses useState + useEffect with event listener instead of useSyncExternalStore
 * to avoid issues with StrictMode double-invocation.
 */
export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
    key: K
): OpenAiGlobals[K] | undefined {
    // Initialize with current value
    const [value, setValue] = useState<OpenAiGlobals[K] | undefined>(
        () => (window.openai as OpenAiGlobals | undefined)?.[key]
    );

    useEffect(() => {
        // Update state when event fires
        const handleSetGlobal = (event: Event) => {
            const customEvent = event as SetGlobalsEvent;
            // Only update if this specific key was included in the update
            if (customEvent.detail?.globals && key in customEvent.detail.globals) {
                const newValue = (window.openai as OpenAiGlobals | undefined)?.[key];
                setValue(newValue);
            }
        };

        // Listen for global updates from host
        window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
            passive: true,
        });

        // Also check initial value in case it was set before mount
        const initialValue = (window.openai as OpenAiGlobals | undefined)?.[key];
        if (initialValue !== undefined) {
            setValue(initialValue);
        }

        return () => {
            window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
        };
    }, [key]);

    return value;
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
