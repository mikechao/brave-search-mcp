/**
 * Web Search - MCP-APP mode wrapper
 * Uses ext-apps SDK hooks
 */
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { WidgetProps } from '../../widget-props';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { useCallback, useEffect, useState } from 'react';
import WebSearchApp from './WebSearchApp';

const APP_INFO = { name: 'Brave Web Search', version: '1.0.0' };

export default function WebMcpAppMode() {
  const [toolInputs, setToolInputs] = useState<Record<string, unknown> | null>(null);
  const [toolInputsPartial, setToolInputsPartial] = useState<Record<string, unknown> | null>(null);
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | null>(null);

  const { app, error } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated: (appInstance) => {
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
    },
  });

  useEffect(() => {
    if (app) {
      const ctx = app.getHostContext();
      if (ctx)
        setHostContext(ctx);
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
    params => app!.sendLog(params),
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
  };

  return <WebSearchApp {...props} />;
}
