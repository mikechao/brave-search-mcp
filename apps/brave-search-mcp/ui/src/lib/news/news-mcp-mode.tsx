/**
 * News Search - MCP App mode with pagination and context selection support
 */
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { NewsSearchAppProps } from './NewsSearchApp';
import type { ContextArticle, NewsSearchData } from './types';
import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { useCallback, useEffect, useState } from 'react';
import { useAppTheme } from '../../hooks/useAppTheme';
import NewsSearchApp from './NewsSearchApp';

/**
 * MCP App mode wrapper
 */
export default function NewsMcpAppMode() {
  const [app, setApp] = useState<App | null>(null);
  const [toolResult, setToolResult] = useState<{ structuredContent?: NewsSearchData } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [contextArticles, setContextArticles] = useState<ContextArticle[]>([]);
  const [hostContext, setHostContext] = useState<McpUiHostContext | null>(null);
  useAppTheme(hostContext?.theme);

  // Initialize App SDK
  useEffect(() => {
    // If not in iframe, don't initialize (dev mode)
    if (window === window.parent)
      return;

    let isMounted = true;
    const mcpApp = new App(
      { name: 'Brave News Search', version: '1.0.0' },
      {
        tools: {
          // We don't expose any client-side tools
        },
      },
    );

    // Register handlers before connecting to avoid missing early events.
    mcpApp.ontoolresult = (params) => {
      const result = params as any;
      const content = result?._meta?.structuredContent ?? result?.structuredContent;
      if (content) {
        setToolResult({ structuredContent: content });
      }
    };
    mcpApp.onhostcontextchanged = (params) => {
      setHostContext(prev => ({ ...prev, ...params }));
    };

    // Initial connection
    mcpApp.connect(new PostMessageTransport(window.parent, window.parent))
      .then(() => {
        if (!isMounted) {
          mcpApp.close();
          return;
        }
        setApp(mcpApp);
        const ctx = mcpApp.getHostContext();
        if (ctx)
          setHostContext(ctx);
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to connect to host:', err);
        }
      });

    return () => {
      isMounted = false;
      mcpApp.close();
    };
  }, []);

  const handleOpenLink = async ({ url }: { url: string }) => {
    if (app) {
      return app.openLink({ url });
    }
    return window.open(url, '_blank') ? { isError: false } : { isError: true };
  };

  const handleRequestDisplayMode = async (mode: 'inline' | 'fullscreen' | 'pip') => {
    if (app) {
      const result = await app.requestDisplayMode({ mode });
      return result.mode;
    }
    return undefined;
  };

  // Pagination handler using app.callServerTool
  const handleLoadPage = useCallback(async (offset: number) => {
    if (!toolResult?.structuredContent || !app)
      return;

    setIsLoading(true);
    try {
      // Call the server tool to get the next page
      const result = await app.callServerTool({
        name: 'brave_news_search',
        arguments: {
          query: toolResult.structuredContent.query,
          count: toolResult.structuredContent.pageSize ?? toolResult.structuredContent.count ?? 10,
          offset,
        },
      });

      const extendedResult = result as any;
      const content = extendedResult?._meta?.structuredContent ?? extendedResult?.structuredContent;
      if (content) {
        setToolResult({ structuredContent: content });
      }
    }
    catch (err) {
      console.error('Failed to load page:', err);
    }
    finally {
      setIsLoading(false);
    }
  }, [app, toolResult]);

  // Context selection handler using app.updateModelContext
  const handleContextChange = useCallback((articles: ContextArticle[]) => {
    setContextArticles(articles);

    if (app) {
      // Format context for the model
      const contentText = articles.length > 0
        ? articles.map((a, idx) => (
            `${idx + 1}: Title: ${a.title}\nURL: ${a.url}\nAge: ${a.age}\nSource: ${a.source}`
          )).join('\n\n')
        : 'No articles selected.';

      // Send update to host without triggering follow-up
      app.updateModelContext({
        content: [{ type: 'text', text: contentText }],
      }).catch(err => console.error('Failed to update model context:', err));
    }
  }, [app]);

  const props: NewsSearchAppProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: toolResult as any,
    hostContext: null,
    callServerTool: app?.callServerTool.bind(app) as any,
    sendMessage: app?.sendMessage.bind(app) as any,
    openLink: handleOpenLink,
    sendLog: app?.sendLog.bind(app) as any,
    displayMode: 'inline', // We could sync this with host context if needed
    requestDisplayMode: handleRequestDisplayMode,
    onLoadPage: app ? handleLoadPage : undefined,
    isLoading,
    isInitialLoading: !toolResult && Boolean(app),
    loadingQuery: undefined, // MCP news mode doesn't track toolInputs currently
    contextArticles,
    onContextChange: app ? handleContextChange : undefined,
  };

  return <NewsSearchApp {...props} />;
}
