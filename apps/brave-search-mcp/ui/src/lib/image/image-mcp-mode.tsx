/**
 * Image Search - MCP-APP mode wrapper
 * Uses ext-apps SDK with manual App creation to disable autoResize
 * (Carousels don't work well with auto-resize causing container dimension changes)
 */
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { SaveImageParams, WidgetProps } from '../../widget-props';
import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { useCallback, useEffect, useState } from 'react';
import ImageSearchApp from './ImageSearchApp';

const APP_INFO = { name: 'Brave Image Search', version: '1.0.0' };

/**
 * Convert a Blob to base64 data URL (without prefix)
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Remove the "data:mime/type;base64," prefix
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ImageMcpAppMode() {
  const [app, setApp] = useState<App | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [toolInputs, setToolInputs] = useState<Record<string, unknown> | null>(null);
  const [toolInputsPartial, setToolInputsPartial] = useState<Record<string, unknown> | null>(null);
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | null>(null);

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
    // @ts-expect-error - PostMessageTransport constructor signature mismatch in types
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

  const handleSaveImage = useCallback(async (params: SaveImageParams) => {
    if (!app) {
      throw new Error('App not connected');
    }

    // 1. Fetch image as blob
    const response = await fetch(params.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const blob = await response.blob();

    // 2. Convert to base64
    const base64 = await blobToBase64(blob);
    const mimeType = blob.type || 'image/jpeg';

    // 3. Update model context with the image
    await app.updateModelContext({
      content: [
        { type: 'text', text: `User saved image: ${params.title}` },
        { type: 'image', data: base64, mimeType },
      ],
    });
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
    onSaveImage: handleSaveImage,
  };

  return <ImageSearchApp {...props} />;
}
