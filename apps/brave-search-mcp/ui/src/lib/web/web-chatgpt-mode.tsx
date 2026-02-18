import type { ContextResult, WebSearchData } from './types';
/**
 * Web Search - ChatGPT mode with pagination and context selection support
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { WebSearchAppProps } from './WebSearchApp';
import { useCallback, useEffect, useState } from 'react';
import { useOpenAiAppTheme } from '../../hooks/useAppTheme';
import { useDisplayMode, useSafeArea, useToolInput, useToolOutput, useToolResponseMetadata } from '../../hooks/useOpenAiGlobal';
import WebSearchApp from './WebSearchApp';

/**
 * ChatGPT mode wrapper with context selection support
 */
export default function WebChatGPTMode() {
  useOpenAiAppTheme();

  // Use reactive hooks instead of manual polling
  const [pagedOutput, setPagedOutput] = useState<WebSearchData | null>(null);

  // Access tool input (arguments) for loading state detection
  const toolInput = useToolInput() as { query?: string } | null;

  // Access tool output (content) and metadata (_meta) separately
  const rawOutput = useToolOutput() as any;
  const rawMetadata = useToolResponseMetadata() as any;

  // Prefer metadata (where structuredContent lives now), fallback to output (legacy)
  const initialData = (rawMetadata?.structuredContent ?? rawOutput?.structuredContent) as WebSearchData | null;

  const displayMode = useDisplayMode();
  const safeArea = useSafeArea();

  // Create synthetic hostContext from ChatGPT safe area for proper padding
  // safeArea has nested .insets object: { insets: { top, bottom, left, right } }
  // Coerce optional values to required numbers for McpUiHostContext compatibility
  const insets = safeArea?.insets;
  const hostContext = insets
    ? {
        safeAreaInsets: {
          top: insets.top ?? 0,
          right: insets.right ?? 0,
          bottom: insets.bottom ?? 0,
          left: insets.left ?? 0,
        },
      }
    : null;
  const [isLoading, setIsLoading] = useState(false);
  const [contextResults, setContextResults] = useState<ContextResult[]>([]);

  // Keep paginated data only for the active query.
  const hostQuery = toolInput?.query ?? initialData?.query ?? null;
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

  const handleOpenLink = async ({ url }: { url: string }) => {
    // Access directly from window.openai since functions are set at init, not via events
    try {
      if (window.openai?.openExternal) {
        window.openai.openExternal({ href: url });
      }
      return { isError: false };
    }
    catch {
      return { isError: true };
    }
  };

  const handleRequestDisplayMode = async (mode: 'inline' | 'fullscreen' | 'pip') => {
    // Access directly from window.openai since functions are set at init, not via events
    if (window.openai?.requestDisplayMode) {
      await window.openai.requestDisplayMode({ mode });
      return mode; // OpenAI API doesn't return the mode, so return the requested mode
    }
    return undefined;
  };

  // Pagination handler - calls the web search tool with new offset
  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData || !window.openai?.callTool)
      return;

    setIsLoading(true);
    try {
      const result = await window.openai.callTool('brave_web_search', {
        query: currentData.query,
        count: currentData.pageSize ?? currentData.count ?? 10,
        offset,
      }) as { structuredContent?: WebSearchData; _meta?: { structuredContent?: WebSearchData }; meta?: { structuredContent?: WebSearchData } } | null;

      // callTool returns metadata in 'meta' (not '_meta'), initial load uses hooks
      const newData = result?.meta?.structuredContent ?? result?._meta?.structuredContent ?? result?.structuredContent;

      if (newData) {
        // Update local state with new results
        setPagedOutput(newData);
      }
    }
    catch (err) {
      console.error('Failed to load page:', err);
    }
    finally {
      setIsLoading(false);
    }
  }, [currentData]);

  // Context selection handler - updates widgetState for model access
  const handleContextChange = useCallback((results: ContextResult[]) => {
    setContextResults(results);

    // Expose selected results to the model via widgetState
    if (window.openai?.setWidgetState) {
      window.openai.setWidgetState({
        modelContent: {
          selectedResults: results.map((r, idx) => ({
            index: idx + 1,
            title: r.title,
            domain: r.domain,
            description: r.description,
            url: r.url,
          })),
          count: results.length,
        },
      });
    }
  }, []);

  const noopLog = async () => { };

  // Derive initial loading state: tool invoked (has input) but no result yet
  const hasData = Boolean(currentData);
  const isInitialLoading = toolInput !== null && !hasData;
  const loadingQuery = toolInput?.query;

  const props: WebSearchAppProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: currentData ? { structuredContent: currentData } : null,
    hostContext,
    openLink: handleOpenLink,
    sendLog: noopLog,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode: handleRequestDisplayMode,
    onLoadPage: window.openai?.callTool ? handleLoadPage : undefined,
    isLoading,
    isInitialLoading,
    loadingQuery,
    contextResults,
    onContextChange: window.openai?.setWidgetState ? handleContextChange : undefined,
  };

  return <WebSearchApp {...props} />;
}
