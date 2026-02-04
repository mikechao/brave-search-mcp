import type { ContextVideo, VideoSearchData } from './types';
/**
 * Video Search - ChatGPT mode with pagination and context selection support
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { VideoSearchAppProps } from './VideoSearchApp';
import { useCallback, useEffect, useState } from 'react';
import { useOpenAiAppTheme } from '../../hooks/useAppTheme';
import { useDisplayMode, useSafeArea, useToolInput, useToolOutput, useToolResponseMetadata } from '../../hooks/useOpenAiGlobal';
import VideoSearchApp from './VideoSearchApp';

/**
 * ChatGPT mode wrapper with context selection support
 */
export default function VideoChatGPTMode() {
  useOpenAiAppTheme();

  // Use reactive hooks instead of manual polling
  const [pagedOutput, setPagedOutput] = useState<VideoSearchData | null>(null);

  // Access tool input (arguments) for loading state detection
  const toolInput = useToolInput() as { query?: string } | null;

  // Access tool output (content) and metadata (_meta) separately
  const rawOutput = useToolOutput() as any;
  const rawMetadata = useToolResponseMetadata() as any;

  // Prefer metadata (where structuredContent lives now), fallback to output (legacy)
  const initialData = (rawMetadata?.structuredContent ?? rawOutput?.structuredContent) as VideoSearchData | null;

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

  const [isLoading, setIsLoading] = useState(false);
  const [contextVideos, setContextVideos] = useState<ContextVideo[]>([]);

  // Keep paginated data only for the active query.
  const hostQuery = toolInput?.query ?? initialData?.query ?? null;
  const currentData = pagedOutput && hostQuery && pagedOutput.query === hostQuery
    ? pagedOutput
    : initialData;

  useEffect(() => {
    if (pagedOutput && hostQuery && pagedOutput.query !== hostQuery) {
      const timeoutId = setTimeout(() => {
        setPagedOutput(null);
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [hostQuery, pagedOutput]);

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
      return mode; // OpenAI API doesn't return the mode, so return the requested mode
    }
    return undefined;
  };

  // Pagination handler - calls the video search tool with new offset
  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData || !window.openai?.callTool)
      return;

    setIsLoading(true);
    try {
      const result = await window.openai.callTool('brave_video_search', {
        query: currentData.query,
        count: currentData.pageSize ?? currentData.count ?? 10,
        offset,
      }) as { structuredContent?: VideoSearchData; _meta?: { structuredContent?: VideoSearchData }; meta?: { structuredContent?: VideoSearchData } } | null;

      // callTool returns metadata in 'meta' (not '_meta'), initial load uses hooks
      const newData = result?.meta?.structuredContent ?? result?._meta?.structuredContent ?? result?.structuredContent;

      if (newData) {
        // Update local state with new results
        setPagedOutput(newData);
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
  const handleContextChange = useCallback((videos: ContextVideo[]) => {
    setContextVideos(videos);

    // Expose selected videos to the model via widgetState
    if (window.openai?.setWidgetState) {
      window.openai.setWidgetState({
        modelContent: {
          selectedVideos: videos.map((v, idx) => ({
            index: idx + 1,
            title: v.title,
            creator: v.creator,
            duration: v.duration,
            url: v.url,
          })),
          count: videos.length,
        },
      });
    }
  }, []);

  const noop = async () => ({ isError: false });
  const noopLog = async () => { };

  // Derive initial loading state: tool invoked (has input) but no result yet
  const hasData = Boolean(currentData);
  const isInitialLoading = toolInput !== null && !hasData;
  const loadingQuery = toolInput?.query;

  const props: VideoSearchAppProps = {
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
    // ChatGPT supports all display modes when requestDisplayMode is available
    availableDisplayModes: window.openai?.requestDisplayMode
      ? ['inline', 'fullscreen', 'pip']
      : undefined,
    onLoadPage: window.openai?.callTool ? handleLoadPage : undefined,
    isLoading,
    isInitialLoading,
    loadingQuery,
    contextVideos,
    onContextChange: window.openai?.setWidgetState ? handleContextChange : undefined,
  };

  return <VideoSearchApp {...props} />;
}
