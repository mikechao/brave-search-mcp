/**
 * Image Search - ChatGPT mode wrapper
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { WidgetProps } from '../../widget-props';
import type { ImageSearchData } from './types';
import { useOpenAiAppTheme } from '../../hooks/useAppTheme';
import { useDisplayMode, useSafeArea, useToolInput, useToolOutput } from '../../hooks/useOpenAiGlobal';
import ImageSearchApp from './ImageSearchApp';

export default function ImageChatGPTMode() {
  useOpenAiAppTheme();

  // Use reactive hooks instead of manual polling
  const toolOutput = useToolOutput() as unknown as ImageSearchData | null;

  // Access tool input (arguments) for loading state detection
  const toolInput = useToolInput() as { searchTerm?: string } | null;

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
      return mode; // OpenAI API doesn't return the mode, so return the requested mode
    }
    return undefined;
  };

  const noopLog = async () => { };

  // Derive initial loading state: tool invoked (has input) but no result yet
  const hasData = Boolean(toolOutput);
  const isInitialLoading = toolInput !== null && !hasData;
  const loadingQuery = toolInput?.searchTerm;

  const props: WidgetProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: toolOutput ? { structuredContent: toolOutput } : null,
    hostContext,
    openLink: handleOpenLink,
    sendLog: noopLog,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode: handleRequestDisplayMode,
  };

  return <ImageSearchApp {...props} isInitialLoading={isInitialLoading} loadingQuery={loadingQuery} />;
}
