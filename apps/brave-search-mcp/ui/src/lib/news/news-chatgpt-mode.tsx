/**
 * News Search - ChatGPT mode with pagination and context selection support
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { NewsSearchAppProps } from './NewsSearchApp';
import type { ContextArticle, NewsSearchData } from './types';
import { useCallback, useState } from 'react';
import { useDisplayMode, useSafeArea, useToolOutput, useToolResponseMetadata } from '../../hooks/useOpenAiGlobal';
import NewsSearchApp from './NewsSearchApp';

/**
 * ChatGPT mode wrapper with context selection support
 */
export default function NewsChatGPTMode() {
  // Use reactive hooks instead of manual polling
  const [toolOutput, setToolOutput] = useState<NewsSearchData | null>(null);

  // Access tool output (content) and metadata (_meta) separately
  const rawOutput = useToolOutput() as any;
  const rawMetadata = useToolResponseMetadata() as any;

  // Prefer metadata (where structuredContent lives now), fallback to output (legacy)
  const initialData = (rawMetadata?.structuredContent ?? rawOutput?.structuredContent) as NewsSearchData | null;

  const displayMode = useDisplayMode();
  const safeArea = useSafeArea();

  // Create synthetic hostContext from ChatGPT safe area for proper padding
  const hostContext = safeArea ? { safeAreaInsets: safeArea } : null;

  const [isLoading, setIsLoading] = useState(false);
  const [contextArticles, setContextArticles] = useState<ContextArticle[]>([]);

  // Use local state if we've loaded a new page, otherwise use initial
  const currentData = toolOutput ?? initialData;

  console.log('NewsChaptGPTMode', window.openai?.safeArea);

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
      }) as { structuredContent?: NewsSearchData; _meta?: { structuredContent?: NewsSearchData }; meta?: { structuredContent?: NewsSearchData } } | null;

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
  const handleContextChange = useCallback((articles: ContextArticle[]) => {
    setContextArticles(articles);

    // Expose selected articles to the model via widgetState
    if (window.openai?.setWidgetState) {
      window.openai.setWidgetState({
        modelContent: {
          selectedArticles: articles.map((a, idx) => ({
            index: idx + 1,
            title: a.title,
            source: a.source,
            age: a.age,
            url: a.url,
          })),
          count: articles.length,
        },
      });
    }
  }, []);

  const noop = async () => ({ isError: false });
  const noopLog = async () => { };

  const props: NewsSearchAppProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: currentData ? { structuredContent: currentData } as any : null,
    hostContext,
    callServerTool: noop as any,
    sendMessage: noop as any,
    openLink: handleOpenLink,
    sendLog: noopLog as any,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode: handleRequestDisplayMode,
    onLoadPage: window.openai?.callTool ? handleLoadPage : undefined,
    isLoading,
    contextArticles,
    onContextChange: window.openai?.setWidgetState ? handleContextChange : undefined,
  };

  return <NewsSearchApp {...props} />;
}
