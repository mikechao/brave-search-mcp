/**
 * News Search - MCP App mode with pagination and context selection support
 */
import type { DisplayMode, ToolResult } from '../../widget-props';
import type { NewsSearchAppProps } from './NewsSearchApp';
import type { ContextArticle, NewsSearchData } from './types';
import { useCallback, useMemo, useState } from 'react';
import { useMcpApp } from '../../hooks/useMcpApp';
import NewsSearchApp from './NewsSearchApp';

interface NewsToolInput extends Record<string, unknown> {
  query?: string;
  count?: number;
  offset?: number;
}

const APP_INFO = { name: 'Brave News Search', version: '1.0.0' };
const APP_CAPABILITIES = { availableDisplayModes: ['inline', 'fullscreen', 'pip'] as DisplayMode[] };

function getStructuredContent(result: ToolResult | null): NewsSearchData | null {
  const content = (result?._meta?.structuredContent ?? result?.structuredContent) as NewsSearchData | undefined;
  return content ?? null;
}

/**
 * MCP App mode wrapper
 */
export default function NewsMcpAppMode() {
  const {
    app,
    error,
    toolInputs,
    toolInputsPartial,
    toolResult,
    hostContext,
    callServerTool,
    sendMessage,
    openLink,
    sendLog,
    requestDisplayMode,
  } = useMcpApp<NewsToolInput>({ appInfo: APP_INFO, capabilities: APP_CAPABILITIES });
  const [pagedToolResult, setPagedToolResult] = useState<ToolResult | null>(null);
  const [pagedQuery, setPagedQuery] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [contextArticles, setContextArticles] = useState<ContextArticle[]>([]);
  const currentQuery = toolInputs?.query ?? null;
  const hostData = getStructuredContent(toolResult);
  const currentResult = useMemo(() => {
    if (pagedToolResult && pagedQuery === currentQuery)
      return pagedToolResult;

    if (!toolResult)
      return null;

    if (currentQuery === null || hostData?.query === currentQuery)
      return toolResult;

    return null;
  }, [currentQuery, hostData?.query, pagedQuery, pagedToolResult, toolResult]);
  const currentData = useMemo(() => getStructuredContent(currentResult), [currentResult]);

  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData)
      return;

    setIsLoading(true);
    try {
      const result = await callServerTool({
        name: 'brave_news_search',
        arguments: {
          query: currentData.query,
          count: currentData.pageSize ?? currentData.count ?? 10,
          offset,
        },
      });
      setPagedToolResult(result as ToolResult);
      setPagedQuery(currentData.query);
    }
    catch (err) {
      console.error('Failed to load page:', err);
    }
    finally {
      setIsLoading(false);
    }
  }, [callServerTool, currentData]);

  const handleContextChange = useCallback((articles: ContextArticle[]) => {
    setContextArticles(articles);

    if (app) {
      const contentText = articles.length > 0
        ? articles.map((article, index) => (
            `${index + 1}: Title: ${article.title}\nURL: ${article.url}\nAge: ${article.age}\nSource: ${article.source}`
          )).join('\n\n')
        : 'No articles selected.';

      app.updateModelContext({
        content: [{ type: 'text', text: contentText }],
      }).catch(err => console.error('Failed to update model context:', err));
    }
  }, [app]);

  if (error) {
    return (
      <div className="error">
        Error:
        {error.message}
      </div>
    );
  }
  if (!app)
    return <div className="loading">Connecting...</div>;

  const props: NewsSearchAppProps = {
    toolInputs,
    toolInputsPartial,
    toolResult: currentResult,
    hostContext,
    callServerTool,
    sendMessage,
    openLink,
    sendLog,
    displayMode: hostContext?.displayMode ?? 'inline',
    requestDisplayMode,
    onLoadPage: handleLoadPage,
    isLoading,
    isInitialLoading: toolInputs !== null && currentResult === null,
    loadingQuery: toolInputs?.query,
    contextArticles,
    onContextChange: handleContextChange,
  };

  return <NewsSearchApp {...props} />;
}
