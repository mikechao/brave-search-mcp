/**
 * Image Search - ChatGPT mode wrapper
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { WidgetProps } from '../../widget-props';
import type { ImageSearchData } from './types';
import { useDisplayMode, useSafeArea, useToolOutput } from '../../hooks/useOpenAiGlobal';
import ImageSearchApp from './ImageSearchApp';

export default function ImageChatGPTMode() {
  // Use reactive hooks instead of manual polling
  const toolOutput = useToolOutput() as unknown as ImageSearchData | null;
  const displayMode = useDisplayMode();
  const safeArea = useSafeArea();

  // Create synthetic hostContext from ChatGPT safe area for proper padding
  // safeArea has nested .insets object: { insets: { top, bottom, left, right } }
  // Coerce optional values to required numbers for McpUiHostContext compatibility
  const insets = safeArea?.insets;
  const hostContext = insets
    ? {
        safeAreaInsets: {
          top: insets.top ?? 0,
          right: insets.right ?? 0,
          bottom: insets.bottom ?? 0,
          left: insets.left ?? 0,
        },
      }
    : null;

  const handleOpenLink = async ({ url }: { url: string }) => {
    // Access directly from window.openai since functions are set at init, not via events
    try {
      if (window.openai?.openExternal) {
        await window.openai.openExternal({ href: url });
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
    hostContext,
    callServerTool: noop as any,
    sendMessage: noop as any,
    openLink: handleOpenLink,
    sendLog: noopLog as any,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode: handleRequestDisplayMode,
  };

  return <ImageSearchApp {...props} />;
}
