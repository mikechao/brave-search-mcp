import type { ToolResult, WidgetProps } from '../../widget-props';
import type { LocalSearchData } from './types';
import { useCallback, useState } from 'react';
import { useMcpApp } from '../../hooks/useMcpApp';
import LocalSearchApp from './LocalSearchApp';

const APP_INFO = { name: 'Brave Local Search', version: '1.0.0' };

export default function LocalMcpAppMode() {
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
  } = useMcpApp({ appInfo: APP_INFO });
  const [pagedToolResult, setPagedToolResult] = useState<ToolResult | null>(null);
  const [pagedQuery, setPagedQuery] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const currentQuery = (toolInputs?.query as string) ?? null;
  const currentResult = pagedToolResult && pagedQuery === currentQuery
    ? pagedToolResult
    : toolResult;
  const currentData = (currentResult?._meta?.structuredContent ?? currentResult?.structuredContent) as LocalSearchData | undefined;

  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData)
      return;

    setIsLoading(true);
    try {
      const result = await callServerTool({
        name: 'brave_local_search',
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

  const props: WidgetProps = {
    toolInputs,
    toolInputsPartial,
    toolResult: currentResult,
    hostContext,
    callServerTool,
    sendMessage,
    openLink,
    sendLog,
    displayMode: hostContext?.displayMode,
    requestDisplayMode,
  };

  // Derive initial loading state: tool invoked but no result yet
  const isInitialLoading = toolInputs !== null && !currentResult;
  const loadingQuery = (toolInputs?.query as string) ?? undefined;

  return (
    <LocalSearchApp
      {...props}
      onLoadPage={handleLoadPage}
      isLoading={isLoading}
      isInitialLoading={isInitialLoading}
      loadingQuery={loadingQuery}
    />
  );
}
