import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { Dispatch, SetStateAction } from 'react';
import type { OpenAIWidgetState } from '../openai.d';
import type { DisplayMode, WidgetProps } from '../widget-props';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDisplayMode, useSafeArea } from './useOpenAiGlobal';

interface QueryData {
  query?: string | null;
}

interface UseChatGptBridgeOptions<TData extends QueryData> {
  toolInputQuery?: string | null;
  initialData?: TData | null;
}

interface UseChatGptBridgeResult<TData extends QueryData> {
  displayMode: DisplayMode | undefined;
  hostContext: McpUiHostContext | null;
  openLink: WidgetProps['openLink'];
  requestDisplayMode: NonNullable<WidgetProps['requestDisplayMode']>;
  noopLog: WidgetProps['sendLog'];
  canCallTool: boolean;
  canSetWidgetState: boolean;
  canRequestDisplayMode: boolean;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  setWidgetState: (state: OpenAIWidgetState) => void;
  currentData: TData | null;
  hostQuery: string | null;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setPagedOutput: Dispatch<SetStateAction<TData | null>>;
}

interface CallToolResultWithMeta<TData> {
  structuredContent?: TData;
  _meta?: { structuredContent?: TData };
  meta?: { structuredContent?: TData };
}

export function extractToolStructuredContent<TData>(result: unknown): TData | null {
  if (!result || typeof result !== 'object')
    return null;

  const callToolResult = result as CallToolResultWithMeta<TData>;
  return callToolResult.meta?.structuredContent
    ?? callToolResult._meta?.structuredContent
    ?? callToolResult.structuredContent
    ?? null;
}

export function useChatGptBridge<TData extends QueryData = QueryData>({
  toolInputQuery = null,
  initialData = null,
}: UseChatGptBridgeOptions<TData> = {}): UseChatGptBridgeResult<TData> {
  const displayMode = useDisplayMode();
  const safeArea = useSafeArea();
  const [pagedOutput, setPagedOutput] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hostContext = useMemo<McpUiHostContext | null>(() => {
    const insets = safeArea?.insets;
    if (!insets)
      return null;
    return {
      safeAreaInsets: {
        top: insets.top ?? 0,
        right: insets.right ?? 0,
        bottom: insets.bottom ?? 0,
        left: insets.left ?? 0,
      },
    };
  }, [safeArea]);

  const hostQuery = toolInputQuery ?? initialData?.query ?? null;
  const currentData = pagedOutput && hostQuery && pagedOutput.query === hostQuery
    ? pagedOutput
    : initialData;

  useEffect(() => {
    if (pagedOutput && hostQuery && pagedOutput.query !== hostQuery) {
      const timeoutId = setTimeout(() => {
        setPagedOutput(null);
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [hostQuery, pagedOutput]);

  const openLink = useCallback<WidgetProps['openLink']>(async ({ url }) => {
    try {
      if (window.openai?.openExternal) {
        await window.openai.openExternal({ href: url });
      }
      return { isError: false };
    }
    catch {
      return { isError: true };
    }
  }, []);

  const requestDisplayMode = useCallback<NonNullable<WidgetProps['requestDisplayMode']>>(async (mode: DisplayMode) => {
    if (window.openai?.requestDisplayMode) {
      await window.openai.requestDisplayMode({ mode });
      return mode;
    }
    return undefined;
  }, []);

  const noopLog = useCallback<WidgetProps['sendLog']>(async () => {}, []);

  const callTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    if (!window.openai?.callTool)
      return null;
    return window.openai.callTool(name, args);
  }, []);

  const setWidgetState = useCallback((state: OpenAIWidgetState) => {
    window.openai?.setWidgetState?.(state);
  }, []);

  return {
    displayMode,
    hostContext,
    openLink,
    requestDisplayMode,
    noopLog,
    canCallTool: Boolean(window.openai?.callTool),
    canSetWidgetState: Boolean(window.openai?.setWidgetState),
    canRequestDisplayMode: Boolean(window.openai?.requestDisplayMode),
    callTool,
    setWidgetState,
    currentData,
    hostQuery,
    isLoading,
    setIsLoading,
    setPagedOutput,
  };
}
