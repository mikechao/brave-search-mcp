import type { ContextVideo, VideoSearchData } from './types';
/**
 * Video Search - ChatGPT mode with pagination and context selection support
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { VideoSearchAppProps } from './VideoSearchApp';
import { useCallback, useState } from 'react';
import { useOpenAiAppTheme } from '../../hooks/useAppTheme';
import { extractToolStructuredContent, useChatGptBridge } from '../../hooks/useChatGptBridge';
import { useToolInput, useToolOutput, useToolResponseMetadata } from '../../hooks/useOpenAiGlobal';
import VideoSearchApp from './VideoSearchApp';

/**
 * ChatGPT mode wrapper with context selection support
 */
export default function VideoChatGPTMode() {
  useOpenAiAppTheme();

  // Access tool input (arguments) for loading state detection
  const toolInput = useToolInput() as { query?: string } | null;

  // Access tool output (content) and metadata (_meta) separately
  const rawOutput = useToolOutput() as any;
  const rawMetadata = useToolResponseMetadata() as any;

  // Prefer metadata (where structuredContent lives now), fallback to output (legacy)
  const initialData = (rawMetadata?.structuredContent ?? rawOutput?.structuredContent) as VideoSearchData | null;
  const [contextVideos, setContextVideos] = useState<ContextVideo[]>([]);
  const {
    displayMode,
    hostContext,
    openLink,
    requestDisplayMode,
    noopLog,
    canCallTool,
    canSetWidgetState,
    canRequestDisplayMode,
    callTool,
    setWidgetState,
    currentData,
    isLoading,
    setIsLoading,
    setPagedOutput,
  } = useChatGptBridge<VideoSearchData>({
    toolInputQuery: toolInput?.query ?? null,
    initialData,
  });

  // Pagination handler - calls the video search tool with new offset
  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData)
      return;

    setIsLoading(true);
    try {
      const result = await callTool('brave_video_search', {
        query: currentData.query,
        count: currentData.pageSize ?? currentData.count ?? 10,
        offset,
      });
      const newData = extractToolStructuredContent<VideoSearchData>(result);

      if (newData) {
        setPagedOutput(newData);
      }
    }
    catch (err) {
      console.error('Failed to load page:', err);
    }
    finally {
      setIsLoading(false);
    }
  }, [callTool, currentData, setIsLoading, setPagedOutput]);

  // Context selection handler - updates widgetState for model access
  const handleContextChange = useCallback((videos: ContextVideo[]) => {
    setContextVideos(videos);

    // Expose selected videos to the model via widgetState
    setWidgetState({
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
  }, [setWidgetState]);

  // Derive initial loading state: tool invoked (has input) but no result yet
  const hasData = Boolean(currentData);
  const isInitialLoading = toolInput !== null && !hasData;
  const loadingQuery = toolInput?.query;

  const props: VideoSearchAppProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: currentData ? { structuredContent: currentData } : null,
    hostContext,
    openLink,
    sendLog: noopLog,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode,
    // ChatGPT supports all display modes when requestDisplayMode is available
    availableDisplayModes: canRequestDisplayMode
      ? ['inline', 'fullscreen', 'pip']
      : undefined,
    onLoadPage: canCallTool ? handleLoadPage : undefined,
    isLoading,
    isInitialLoading,
    loadingQuery,
    contextVideos,
    onContextChange: canSetWidgetState ? handleContextChange : undefined,
  };

  return <VideoSearchApp {...props} />;
}
