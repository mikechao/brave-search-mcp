import type { DisplayMode, WidgetProps } from '../../widget-props';
import { useMcpApp } from '../../hooks/useMcpApp';
import VideoSearchApp from './VideoSearchApp';

const APP_INFO = { name: 'Brave Video Search', version: '1.0.0' };
const APP_CAPABILITIES = { availableDisplayModes: ['inline', 'fullscreen', 'pip'] as DisplayMode[] };

export default function VideoMcpAppMode() {
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
  } = useMcpApp({ appInfo: APP_INFO, capabilities: APP_CAPABILITIES });

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
    availableDisplayModes: hostContext?.availableDisplayModes,
  };

  // Derive initial loading state: tool invoked but no result yet
  const isInitialLoading = toolInputs !== null && toolResult === null;
  const loadingQuery = (toolInputs?.query as string) ?? undefined;

  return <VideoSearchApp {...props} isInitialLoading={isInitialLoading} loadingQuery={loadingQuery} />;
}
