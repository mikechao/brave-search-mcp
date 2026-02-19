/**
 * Image Search - ChatGPT mode wrapper
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { WidgetProps } from '../../widget-props';
import type { ImageSearchData } from './types';
import { useOpenAiAppTheme } from '../../hooks/useAppTheme';
import { useChatGptBridge } from '../../hooks/useChatGptBridge';
import { useToolInput, useToolOutput } from '../../hooks/useOpenAiGlobal';
import ImageSearchApp from './ImageSearchApp';

export default function ImageChatGPTMode() {
  useOpenAiAppTheme();

  // Use reactive hooks instead of manual polling
  const toolOutput = useToolOutput() as unknown as ImageSearchData | null;

  // Access tool input (arguments) for loading state detection
  const toolInput = useToolInput() as { searchTerm?: string } | null;
  const {
    displayMode,
    hostContext,
    openLink,
    requestDisplayMode,
    noopLog,
  } = useChatGptBridge();

  // Derive initial loading state: tool invoked (has input) but no result yet
  const hasData = Boolean(toolOutput);
  const isInitialLoading = toolInput !== null && !hasData;
  const loadingQuery = toolInput?.searchTerm;

  const props: WidgetProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: toolOutput ? { structuredContent: toolOutput } : null,
    hostContext,
    openLink,
    sendLog: noopLog,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode,
  };

  return <ImageSearchApp {...props} isInitialLoading={isInitialLoading} loadingQuery={loadingQuery} />;
}
