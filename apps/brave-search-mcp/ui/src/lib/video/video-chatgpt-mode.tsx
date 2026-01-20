/**
 * Video Search - ChatGPT mode wrapper
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { WidgetProps } from '../../widget-props';
import type { VideoSearchData } from './types';
import { useDisplayMode, useOpenExternal, useRequestDisplayMode, useToolOutput } from '../../hooks/useOpenAiGlobal';
import VideoSearchApp from './VideoSearchApp';

export default function VideoChatGPTMode() {
  // Use reactive hooks instead of manual polling
  const toolOutput = useToolOutput() as VideoSearchData | null;
  const displayMode = useDisplayMode();
  const openExternal = useOpenExternal();
  const requestDisplayMode = useRequestDisplayMode();

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
    if (requestDisplayMode) {
      await requestDisplayMode({ mode });
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

  return <VideoSearchApp {...props} />;
}


