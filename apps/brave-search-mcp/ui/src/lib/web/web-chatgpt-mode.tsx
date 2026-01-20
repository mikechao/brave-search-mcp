/**
 * Web Search - ChatGPT mode wrapper
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { WidgetProps } from '../../widget-props';
import type { WebSearchData } from './types';
import { useDisplayMode, useOpenExternal, useToolOutput } from '../../hooks/useOpenAiGlobal';
import WebSearchApp from './WebSearchApp';

export default function WebChatGPTMode() {
  // Use reactive hooks instead of manual polling
  const toolOutput = useToolOutput() as WebSearchData | null;
  const displayMode = useDisplayMode();
  const openExternal = useOpenExternal();

  const handleOpenLink = async ({ url }: { url: string }) => {
    try {
      if (openExternal) {
        openExternal({ href: url });
      }
      return { isError: false };
    }
    catch {
      return { isError: true };
    }
  };

  const handleRequestDisplayMode = async (mode: 'inline' | 'fullscreen' | 'pip') => {
    // Access directly from window.openai since functions are set at init, not via events
    if (window.openai?.requestDisplayMode) {
      await window.openai.requestDisplayMode({ mode });
    }
  };

  const noop = async () => ({ isError: false });
  const noopLog = async () => { };

  const props: WidgetProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: toolOutput ? { structuredContent: toolOutput } as any : null,
    hostContext: null,
    callServerTool: noop as any,
    sendMessage: noop as any,
    openLink: handleOpenLink,
    sendLog: noopLog as any,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode: handleRequestDisplayMode,
  };

  return <WebSearchApp {...props} />;
}


