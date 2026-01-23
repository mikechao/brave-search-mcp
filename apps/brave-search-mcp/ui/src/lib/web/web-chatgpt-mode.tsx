import type { ContextResult, WebSearchData } from './types';
/**
 * Web Search - ChatGPT mode with pagination and context selection support
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { WebSearchAppProps } from './WebSearchApp';
import { useCallback, useState } from 'react';
import { useDisplayMode, useToolOutput, useToolResponseMetadata } from '../../hooks/useOpenAiGlobal';
import WebSearchApp from './WebSearchApp';

/**
 * ChatGPT mode wrapper with context selection support
 */
export default function WebChatGPTMode() {
  // Use reactive hooks instead of manual polling
  const [toolOutput, setToolOutput] = useState<WebSearchData | null>(null);

  // Access tool output (content) and metadata (_meta) separately
  const rawOutput = useToolOutput() as any;
  const rawMetadata = useToolResponseMetadata() as any;

  // Prefer metadata (where structuredContent lives now), fallback to output (legacy)
  const initialData = (rawMetadata?.structuredContent ?? rawOutput?.structuredContent) as WebSearchData | null;

  const displayMode = useDisplayMode();
  const [isLoading, setIsLoading] = useState(false);
  const [contextResults, setContextResults] = useState<ContextResult[]>([]);

  // Use local state if we've loaded a new page, otherwise use initial
  const currentData = toolOutput ?? initialData;

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
    }
  };

  // Pagination handler - calls the web search tool with new offset
  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData || !window.openai?.callTool)
      return;

    setIsLoading(true);
    try {
      const result = await window.openai.callTool('brave_web_search', {
        query: currentData.query,
        count: currentData.count || 10,
        offset,
      }) as { structuredContent?: WebSearchData; _meta?: { structuredContent?: WebSearchData }; meta?: { structuredContent?: WebSearchData } } | null;

      // callTool returns metadata in 'meta' (not '_meta'), initial load uses hooks
      const newData = result?.meta?.structuredContent ?? result?._meta?.structuredContent ?? result?.structuredContent;

      if (newData) {
        // Update local state with new results
        setToolOutput(newData);
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

  const noop = async () => ({ isError: false });
  const noopLog = async () => { };

  const props: WebSearchAppProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: currentData ? { structuredContent: currentData } as any : null,
    hostContext: null,
    callServerTool: noop as any,
    sendMessage: noop as any,
    openLink: handleOpenLink,
    sendLog: noopLog as any,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode: handleRequestDisplayMode,
    onLoadPage: window.openai?.callTool ? handleLoadPage : undefined,
    isLoading,
    contextResults,
    onContextChange: window.openai?.setWidgetState ? handleContextChange : undefined,
  };

  return <WebSearchApp {...props} />;
}
