/**
 * News Search - ChatGPT mode with pagination support
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { NewsSearchAppProps } from './NewsSearchApp';
import type { NewsSearchData } from './types';
import { useCallback, useState } from 'react';
import { useDisplayMode, useToolOutput } from '../../hooks/useOpenAiGlobal';
import NewsSearchApp from './NewsSearchApp';

/**
 * ChatGPT mode wrapper using reactive hooks
 */
export default function NewsChatGPTMode() {
  // Use reactive hooks instead of manual polling
  const [toolOutput, setToolOutput] = useState<NewsSearchData | null>(null);
  const initialToolOutput = useToolOutput() as unknown as NewsSearchData | null;
  const displayMode = useDisplayMode();
  const [isLoading, setIsLoading] = useState(false);

  // Use local state if we've loaded a new page, otherwise use initial
  const currentData = toolOutput ?? initialToolOutput;

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

  // Pagination handler - calls the news search tool with new offset
  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData || !window.openai?.callTool)
      return;

    setIsLoading(true);
    try {
      const result = await window.openai.callTool('brave_news_search', {
        query: currentData.query,
        count: currentData.count || 10,
        offset,
      }) as { structuredContent?: NewsSearchData } | null;

      if (result?.structuredContent) {
        // Update local state with new results
        setToolOutput(result.structuredContent);

        // Expose new results to the model via widgetState
        if (window.openai?.setWidgetState) {
          window.openai.setWidgetState({
            modelContent: {
              query: result.structuredContent.query,
              offset: result.structuredContent.offset,
              articles: result.structuredContent.items.map((item, idx) => ({
                index: idx + 1,
                title: item.title,
                source: item.source,
                age: item.age,
                url: item.url,
              })),
            },
          });
        }
      }
    }
    catch (err) {
      console.error('Failed to load page:', err);
    }
    finally {
      setIsLoading(false);
    }
  }, [currentData]);

  const noop = async () => ({ isError: false });
  const noopLog = async () => { };

  const props: NewsSearchAppProps = {
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
  };

  return <NewsSearchApp {...props} />;
}
