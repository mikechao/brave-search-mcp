/**
 * Local Search - ChatGPT mode wrapper
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { WidgetProps } from '../../widget-props';
import type { LocalSearchData } from './types';
import { useDisplayMode, useToolOutput } from '../../hooks/useOpenAiGlobal';
import LocalSearchApp from './LocalSearchApp';

export default function LocalChatGPTMode() {
  // Use reactive hooks instead of manual polling
  const toolOutput = useToolOutput() as unknown as LocalSearchData | null;
  const displayMode = useDisplayMode();

  const handleOpenLink = async ({ url }: { url: string }) => {
    // Access directly from window.openai since functions are set at init, not via events
    try {
      if (window.openai?.openExternal) {
        window.openai.openExternal({ href: url });
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

  return <LocalSearchApp {...props} />;
}
