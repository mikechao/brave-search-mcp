/**
 * Local Search - ChatGPT mode with pagination and context selection support
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { LocalSearchAppProps } from './LocalSearchApp';
import type { ContextPlace, LocalSearchData } from './types';
import { useCallback, useState } from 'react';
import { useDisplayMode, useSafeArea, useToolOutput, useToolResponseMetadata } from '../../hooks/useOpenAiGlobal';
import LocalSearchApp from './LocalSearchApp';

/**
 * ChatGPT mode wrapper with context selection and pagination support
 */
export default function LocalChatGPTMode() {
  // Use reactive hooks instead of manual polling
  const [toolOutput, setToolOutput] = useState<LocalSearchData | null>(null);

  // Access tool output (content) and metadata (_meta) separately
  const rawOutput = useToolOutput() as any;
  const rawMetadata = useToolResponseMetadata() as any;

  // Prefer metadata (where structuredContent lives now), fallback to output (legacy)
  const initialData = (rawMetadata?.structuredContent ?? rawOutput?.structuredContent) as LocalSearchData | null;

  const displayMode = useDisplayMode();
  const safeArea = useSafeArea();

  // Create synthetic hostContext from ChatGPT safe area for proper padding
  const hostContext = safeArea ? { safeAreaInsets: safeArea } : null;

  const [isLoading, setIsLoading] = useState(false);
  const [contextPlaces, setContextPlaces] = useState<ContextPlace[]>([]);

  // Use local state if we've loaded a new page, otherwise use initial
  const currentData = toolOutput ?? initialData;

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

  // Pagination handler - calls the local search tool with new offset
  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData || !window.openai?.callTool)
      return;

    setIsLoading(true);
    try {
      const result = await window.openai.callTool('brave_local_search', {
        query: currentData.query,
        count: currentData.count || 10,
        offset,
      }) as { structuredContent?: LocalSearchData; _meta?: { structuredContent?: LocalSearchData }; meta?: { structuredContent?: LocalSearchData } } | null;

      // callTool returns metadata in 'meta' (not '_meta'), initial load uses hooks
      const newData = result?.meta?.structuredContent ?? result?._meta?.structuredContent ?? result?.structuredContent;

      if (newData) {
        setToolOutput(newData);
      }
    }
    catch (err) {
      console.error('Failed to load page:', err);
    }
    finally {
      setIsLoading(false);
    }
  }, [currentData]);

  // Context selection handler - updates widgetState for model access
  const handleContextChange = useCallback((places: ContextPlace[]) => {
    setContextPlaces(places);

    // Expose selected places to the model via widgetState
    if (window.openai?.setWidgetState) {
      window.openai.setWidgetState({
        modelContent: {
          selectedPlaces: places.map((p, idx) => ({
            index: idx + 1,
            name: p.name,
            address: p.address,
            phone: p.phone,
            rating: p.rating,
          })),
          count: places.length,
        },
      });
    }
  }, []);

  const noop = async () => ({ isError: false });
  const noopLog = async () => { };

  const props: LocalSearchAppProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: currentData ? { structuredContent: currentData } as any : null,
    hostContext,
    callServerTool: noop as any,
    sendMessage: noop as any,
    openLink: handleOpenLink,
    sendLog: noopLog as any,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode: handleRequestDisplayMode,
    onLoadPage: window.openai?.callTool ? handleLoadPage : undefined,
    isLoading,
    contextPlaces,
    onContextChange: window.openai?.setWidgetState ? handleContextChange : undefined,
  };

  return <LocalSearchApp {...props} />;
}
