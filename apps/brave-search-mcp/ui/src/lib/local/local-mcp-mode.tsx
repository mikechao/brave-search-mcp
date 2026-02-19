import type { WidgetProps } from '../../widget-props';
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

  return <LocalSearchApp {...props} isInitialLoading={isInitialLoading} loadingQuery={loadingQuery} />;
}
