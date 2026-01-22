/**
 * News Search - MCP-APP mode wrapper with pagination support
 * Uses ext-apps SDK with manual App creation to disable autoResize
 */
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { NewsSearchAppProps } from './NewsSearchApp';
import type { NewsSearchData } from './types';
import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { useCallback, useEffect, useState } from 'react';
import NewsSearchApp from './NewsSearchApp';

const APP_INFO = { name: 'Brave News Search', version: '1.0.0' };

export default function NewsMcpAppMode() {
  const [app, setApp] = useState<App | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [toolInputs, setToolInputs] = useState<Record<string, unknown> | null>(null);
  const [toolInputsPartial, setToolInputsPartial] = useState<Record<string, unknown> | null>(null);
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Create App manually with autoResize disabled
    const appInstance = new App(APP_INFO, {}, { autoResize: false });

    // Register handlers before connection
    appInstance.ontoolinput = (params) => {
      setToolInputs(params.arguments as Record<string, unknown>);
      setToolInputsPartial(null);
    };
    appInstance.ontoolinputpartial = (params) => {
      setToolInputsPartial(params.arguments as Record<string, unknown>);
    };
    appInstance.ontoolresult = (params) => {
      setToolResult(params as CallToolResult);
    };
    appInstance.onhostcontextchanged = (params) => {
      setHostContext(prev => ({ ...prev, ...params }));
    };

    // Connect to host
    const transport = new PostMessageTransport(window.parent);
    appInstance.connect(transport)
      .then(() => {
        setApp(appInstance);
        const ctx = appInstance.getHostContext();
        if (ctx)
          setHostContext(ctx);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      appInstance.close();
    };
  }, []);

  const callServerTool = useCallback<App['callServerTool']>(
    (params, options) => app!.callServerTool(params, options),
    [app],
  );
  const sendMessage = useCallback<App['sendMessage']>(
    (params, options) => app!.sendMessage(params, options),
    [app],
  );
  const openLink = useCallback<App['openLink']>(
    (params, options) => app!.openLink(params, options),
    [app],
  );
  const sendLog = useCallback<App['sendLog']>(
    params => app!.sendLog(params),
    [app],
  );
  const requestDisplayMode = useCallback(
    async (mode: 'inline' | 'fullscreen' | 'pip') => {
      await app!.requestDisplayMode({ mode });
    },
    [app],
  );

  // Pagination handler - calls the news search tool with new offset
  const handleLoadPage = useCallback(async (offset: number) => {
    if (!app || !toolResult)
      return;

    const data = toolResult.structuredContent as NewsSearchData | undefined;
    if (!data)
      return;

    setIsLoading(true);
    try {
      const result = await app.callServerTool({
        name: 'brave_news_search',
        arguments: {
          query: data.query,
          count: data.count || 10,
          offset,
        },
      });

      // Update results with the new page
      if (result && !result.isError) {
        setToolResult(result as CallToolResult);
      }
    }
    catch (err) {
      console.error('Failed to load page:', err);
    }
    finally {
      setIsLoading(false);
    }
  }, [app, toolResult]);

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
    toolResult,
    hostContext,
    callServerTool,
    sendMessage,
    openLink,
    sendLog,
    displayMode: hostContext?.displayMode,
    requestDisplayMode,
    onLoadPage: handleLoadPage,
    isLoading,
  };

  return <NewsSearchApp {...props} />;
}
