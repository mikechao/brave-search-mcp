/**
 * Web Search - MCP-APP mode wrapper
 * Uses ext-apps SDK with manual App creation to disable autoResize
 */
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { ToolResult, WidgetProps } from '../../widget-props';
import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { useCallback, useEffect, useState } from 'react';
import { useAppTheme } from '../../hooks/useAppTheme';
import WebSearchApp from './WebSearchApp';

const APP_INFO = { name: 'Brave Web Search', version: '1.0.0' };

export default function WebMcpAppMode() {
  const [app, setApp] = useState<App | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [toolInputs, setToolInputs] = useState<Record<string, unknown> | null>(null);
  const [toolInputsPartial, setToolInputsPartial] = useState<Record<string, unknown> | null>(null);
  const [toolResult, setToolResult] = useState<ToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | null>(null);
  useAppTheme(hostContext?.theme);

  useEffect(() => {
    // Create App manually with autoResize disabled
    const appInstance = new App(APP_INFO, {}, { autoResize: false });

    // Register handlers before connection
    appInstance.ontoolinput = (params) => {
      setToolInputs(params.arguments ?? null);
      setToolInputsPartial(null);
    };
    appInstance.ontoolinputpartial = (params) => {
      setToolInputsPartial(params.arguments ?? null);
    };
    appInstance.ontoolresult = (params) => {
      setToolResult(params);
    };
    appInstance.onhostcontextchanged = (params) => {
      setHostContext(prev => ({ ...prev, ...params }));
    };

    // Connect to host
    const transport = new PostMessageTransport(window.parent, window.parent);
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
      const result = await app!.requestDisplayMode({ mode });
      return result.mode;
    },
    [app],
  );

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
    toolResult,
    hostContext,
    callServerTool,
    sendMessage,
    openLink,
    sendLog,
    displayMode: hostContext?.displayMode,
    requestDisplayMode,
  };

  // Derive initial loading state: tool invoked but no result yet
  const isInitialLoading = toolInputs !== null && toolResult === null;
  const loadingQuery = (toolInputs?.query as string) ?? undefined;

  return <WebSearchApp {...props} isInitialLoading={isInitialLoading} loadingQuery={loadingQuery} />;
}
