import type { ContextResult, WebSearchData } from './types';
/**
 * Web Search - ChatGPT mode with pagination and context selection support
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { WebSearchAppProps } from './WebSearchApp';
import { useCallback, useState } from 'react';
import { useOpenAiAppTheme } from '../../hooks/useAppTheme';
import { extractToolStructuredContent, useChatGptBridge } from '../../hooks/useChatGptBridge';
import { useToolInput, useToolOutput, useToolResponseMetadata } from '../../hooks/useOpenAiGlobal';
import WebSearchApp from './WebSearchApp';

/**
 * ChatGPT mode wrapper with context selection support
 */
export default function WebChatGPTMode() {
  useOpenAiAppTheme();

  // Access tool input (arguments) for loading state detection
  const toolInput = useToolInput() as { query?: string } | null;

  // Access tool output (content) and metadata (_meta) separately
  const rawOutput = useToolOutput() as any;
  const rawMetadata = useToolResponseMetadata() as any;

  // Prefer metadata (where structuredContent lives now), fallback to output (legacy)
  const initialData = (rawMetadata?.structuredContent ?? rawOutput?.structuredContent) as WebSearchData | null;
  const [contextResults, setContextResults] = useState<ContextResult[]>([]);
  const {
    displayMode,
    hostContext,
    openLink,
    requestDisplayMode,
    noopLog,
    canCallTool,
    canSetWidgetState,
    callTool,
    setWidgetState,
    currentData,
    isLoading,
    setIsLoading,
    setPagedOutput,
  } = useChatGptBridge<WebSearchData>({
    toolInputQuery: toolInput?.query ?? null,
    initialData,
  });

  // Pagination handler - calls the web search tool with new offset
  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData)
      return;

    setIsLoading(true);
    try {
      const result = await callTool('brave_web_search', {
        query: currentData.query,
        count: currentData.pageSize ?? currentData.count ?? 10,
        offset,
      });
      const newData = extractToolStructuredContent<WebSearchData>(result);

      if (newData) {
        setPagedOutput(newData);
      }
    }
    catch (err) {
      console.error('Failed to load page:', err);
    }
    finally {
      setIsLoading(false);
    }
  }, [callTool, currentData, setIsLoading, setPagedOutput]);

  // Context selection handler - updates widgetState for model access
  const handleContextChange = useCallback((results: ContextResult[]) => {
    setContextResults(results);

    // Expose selected results to the model via widgetState
    setWidgetState({
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
  }, [setWidgetState]);

  // Derive initial loading state: tool invoked (has input) but no result yet
  const hasData = Boolean(currentData);
  const isInitialLoading = toolInput !== null && !hasData;
  const loadingQuery = toolInput?.query;

  const props: WebSearchAppProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: currentData ? { structuredContent: currentData } : null,
    hostContext,
    openLink,
    sendLog: noopLog,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode,
    onLoadPage: canCallTool ? handleLoadPage : undefined,
    isLoading,
    isInitialLoading,
    loadingQuery,
    contextResults,
    onContextChange: canSetWidgetState ? handleContextChange : undefined,
  };

  return <WebSearchApp {...props} />;
}
