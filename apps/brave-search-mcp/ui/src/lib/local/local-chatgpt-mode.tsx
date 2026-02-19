/**
 * Local Search - ChatGPT mode with pagination and context selection support
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { LocalSearchAppProps } from './LocalSearchApp';
import type { ContextPlace, LocalSearchData } from './types';
import { useCallback, useState } from 'react';
import { useOpenAiAppTheme } from '../../hooks/useAppTheme';
import { extractToolStructuredContent, useChatGptBridge } from '../../hooks/useChatGptBridge';
import { useToolInput, useToolOutput, useToolResponseMetadata } from '../../hooks/useOpenAiGlobal';
import LocalSearchApp from './LocalSearchApp';

/**
 * ChatGPT mode wrapper with context selection and pagination support
 */
export default function LocalChatGPTMode() {
  useOpenAiAppTheme();

  // Access tool input (arguments) for loading state detection
  const toolInput = useToolInput() as { query?: string } | null;

  // Access tool output (content) and metadata (_meta) separately
  const rawOutput = useToolOutput() as any;
  const rawMetadata = useToolResponseMetadata() as any;

  // Prefer metadata (where structuredContent lives now), fallback to output (legacy)
  const initialData = (rawMetadata?.structuredContent ?? rawOutput?.structuredContent) as LocalSearchData | null;
  const [contextPlaces, setContextPlaces] = useState<ContextPlace[]>([]);
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
  } = useChatGptBridge<LocalSearchData>({
    toolInputQuery: toolInput?.query ?? null,
    initialData,
  });

  // Pagination handler - calls the local search tool with new offset
  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData)
      return;

    setIsLoading(true);
    try {
      const result = await callTool('brave_local_search', {
        query: currentData.query,
        count: currentData.pageSize ?? currentData.count ?? 10,
        offset,
      });
      const newData = extractToolStructuredContent<LocalSearchData>(result);

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
  const handleContextChange = useCallback((places: ContextPlace[]) => {
    setContextPlaces(places);

    // Expose selected places to the model via widgetState
    setWidgetState({
      modelContent: {
        selectedPlaces: places.map((p, idx) => ({
          index: idx + 1,
          name: p.name,
          address: p.address,
          phone: p.phone,
          rating: p.rating,
        })),
        count: places.length,
      },
    });
  }, [setWidgetState]);

  // Derive initial loading state: tool invoked (has input) but no result yet
  const hasData = Boolean(currentData);
  const isInitialLoading = toolInput !== null && !hasData;
  const loadingQuery = toolInput?.query;

  const props: LocalSearchAppProps = {
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
    contextPlaces,
    onContextChange: canSetWidgetState ? handleContextChange : undefined,
  };

  return <LocalSearchApp {...props} />;
}
