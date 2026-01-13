/**
 * Brave Image Search UI - MCP App Wrapper
 */
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ImageSearchApp from './image-search-app.tsx';
import './global.css';

const APP_INFO = { name: 'Brave Image Search', version: '1.0.0' };

export interface WidgetProps<TToolInput = Record<string, unknown>> {
  toolInputs: TToolInput | null;
  toolInputsPartial: TToolInput | null;
  toolResult: CallToolResult | null;
  hostContext: McpUiHostContext | null;
  callServerTool: App['callServerTool'];
  sendMessage: App['sendMessage'];
  openLink: App['openLink'];
  sendLog: App['sendLog'];
}

function McpAppWrapper() {
  const [toolInputs, setToolInputs] = useState<Record<string, unknown> | null>(null);
  const [toolInputsPartial, setToolInputsPartial] = useState<Record<string, unknown> | null>(null);
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | null>(null);

  const { app, error } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = (params) => {
        setToolInputs(params.arguments as Record<string, unknown>);
        setToolInputsPartial(null);
      };
      app.ontoolinputpartial = (params) => {
        setToolInputsPartial(params.arguments as Record<string, unknown>);
      };
      app.ontoolresult = (params) => {
        setToolResult(params as CallToolResult);
      };
      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }));
      };
    },
  });

  useEffect(() => {
    if (app) {
      const ctx = app.getHostContext();
      if (ctx) setHostContext(ctx);
    }
  }, [app]);

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
    (params) => app!.sendLog(params),
    [app],
  );

  if (error) return <div className="error">Error: {error.message}</div>;
  if (!app) return <div className="loading">Connecting...</div>;

  return (
    <ImageSearchApp
      toolInputs={toolInputs}
      toolInputsPartial={toolInputsPartial}
      toolResult={toolResult}
      hostContext={hostContext}
      callServerTool={callServerTool}
      sendMessage={sendMessage}
      openLink={openLink}
      sendLog={sendLog}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <McpAppWrapper />
  </StrictMode>,
);
