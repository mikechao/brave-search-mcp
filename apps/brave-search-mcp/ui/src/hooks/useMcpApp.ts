import type { App as McpApp, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { DisplayMode, ToolResult, WidgetProps } from '../widget-props';
import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { useCallback, useEffect, useState } from 'react';
import { useAppTheme } from './useAppTheme';

type ToolInput = Record<string, unknown>;

interface UseMcpAppOptions {
  appInfo: ConstructorParameters<typeof App>[0];
  capabilities?: ConstructorParameters<typeof App>[1];
  autoResize?: boolean;
}

interface UseMcpAppResult<TToolInput extends ToolInput> {
  app: McpApp | null;
  error: Error | null;
  toolInputs: TToolInput | null;
  toolInputsPartial: TToolInput | null;
  toolResult: ToolResult | null;
  hostContext: McpUiHostContext | null;
  callServerTool: McpApp['callServerTool'];
  sendMessage: McpApp['sendMessage'];
  openLink: McpApp['openLink'];
  sendLog: McpApp['sendLog'];
  requestDisplayMode: NonNullable<WidgetProps['requestDisplayMode']>;
}

export function useMcpApp<TToolInput extends ToolInput = ToolInput>({
  appInfo,
  capabilities,
  autoResize = false,
}: UseMcpAppOptions): UseMcpAppResult<TToolInput> {
  const [app, setApp] = useState<McpApp | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [toolInputs, setToolInputs] = useState<TToolInput | null>(null);
  const [toolInputsPartial, setToolInputsPartial] = useState<TToolInput | null>(null);
  const [toolResult, setToolResult] = useState<ToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | null>(null);

  useAppTheme(hostContext?.theme);

  useEffect(() => {
    let isMounted = true;
    const appInstance = new App(appInfo, capabilities ?? {}, { autoResize });

    appInstance.ontoolinput = (params) => {
      setToolInputs((params.arguments ?? null) as TToolInput | null);
      setToolInputsPartial(null);
    };
    appInstance.ontoolinputpartial = (params) => {
      setToolInputsPartial((params.arguments ?? null) as TToolInput | null);
    };
    appInstance.ontoolresult = (params) => {
      setToolResult(params as ToolResult);
    };
    appInstance.onhostcontextchanged = (params) => {
      setHostContext(prev => ({ ...prev, ...params }));
    };

    appInstance.connect(new PostMessageTransport(window.parent, window.parent))
      .then(() => {
        if (!isMounted) {
          appInstance.close();
          return;
        }

        setApp(appInstance);
        const ctx = appInstance.getHostContext();
        if (ctx)
          setHostContext(ctx);
      })
      .catch((connectError) => {
        if (!isMounted)
          return;
        setError(connectError instanceof Error ? connectError : new Error(String(connectError)));
      });

    return () => {
      isMounted = false;
      appInstance.close();
    };
  }, [appInfo, capabilities, autoResize]);

  const requireApp = useCallback(() => {
    if (!app)
      throw new Error('MCP App is not connected yet.');
    return app;
  }, [app]);

  const callServerTool = useCallback<McpApp['callServerTool']>(
    (params, options) => requireApp().callServerTool(params, options),
    [requireApp],
  );
  const sendMessage = useCallback<McpApp['sendMessage']>(
    (params, options) => requireApp().sendMessage(params, options),
    [requireApp],
  );
  const openLink = useCallback<McpApp['openLink']>(
    (params, options) => requireApp().openLink(params, options),
    [requireApp],
  );
  const sendLog = useCallback<McpApp['sendLog']>(
    params => requireApp().sendLog(params),
    [requireApp],
  );
  const requestDisplayMode = useCallback(async (mode: DisplayMode) => {
    const result = await requireApp().requestDisplayMode({ mode });
    return result.mode;
  }, [requireApp]);

  return {
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
  };
}
