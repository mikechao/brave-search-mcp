import type { WidgetProps } from '../../widget-props';
import { useMcpApp } from '../../hooks/useMcpApp';
import ImageSearchApp from './ImageSearchApp';

const APP_INFO = { name: 'Brave Image Search', version: '1.0.0' };

export default function ImageMcpAppMode() {
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
  const loadingQuery = (toolInputs?.searchTerm as string) ?? undefined;

  return <ImageSearchApp {...props} isInitialLoading={isInitialLoading} loadingQuery={loadingQuery} />;
}
