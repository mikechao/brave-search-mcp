import type { DisplayMode, ToolResult } from '../../widget-props';
import type { ContextVideo, VideoSearchData } from './types';
import type { VideoSearchAppProps } from './VideoSearchApp';
import { useCallback, useMemo, useState } from 'react';
import { useMcpApp } from '../../hooks/useMcpApp';
import { TOOL_NAMES } from '../shared/tool-names';
import VideoSearchApp from './VideoSearchApp';

interface VideoToolInput extends Record<string, unknown> {
  query?: string;
  count?: number;
  offset?: number;
}

const APP_INFO = { name: 'Brave Video Search', version: '1.0.0' };
const APP_CAPABILITIES = { availableDisplayModes: ['inline', 'fullscreen', 'pip'] as DisplayMode[] };

function getStructuredContent(result: ToolResult | null): VideoSearchData | null {
  const content = (result?._meta?.structuredContent ?? result?.structuredContent) as VideoSearchData | undefined;
  return content ?? null;
}

export default function VideoMcpAppMode() {
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
  } = useMcpApp<VideoToolInput>({ appInfo: APP_INFO, capabilities: APP_CAPABILITIES });
  const [pagedToolResult, setPagedToolResult] = useState<ToolResult | null>(null);
  const [pagedQuery, setPagedQuery] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [contextVideos, setContextVideos] = useState<ContextVideo[]>([]);
  const currentQuery = toolInputs?.query ?? null;
  const hostData = getStructuredContent(toolResult);
  const currentResult = useMemo(() => {
    if (pagedToolResult && pagedQuery === currentQuery)
      return pagedToolResult;

    if (!toolResult)
      return null;

    if (currentQuery === null || hostData?.query === currentQuery)
      return toolResult;

    return null;
  }, [currentQuery, hostData?.query, pagedQuery, pagedToolResult, toolResult]);
  const currentData = useMemo(() => getStructuredContent(currentResult), [currentResult]);

  const handleLoadPage = useCallback(async (offset: number) => {
    if (!currentData)
      return;

    setIsLoading(true);
    try {
      const result = await callServerTool({
        name: TOOL_NAMES.video,
        arguments: {
          query: currentData.query,
          count: currentData.pageSize ?? currentData.count ?? 10,
          offset,
        },
      });
      setPagedToolResult(result as ToolResult);
      setPagedQuery(currentData.query);
    }
    catch (err) {
      console.error('Failed to load page:', err);
    }
    finally {
      setIsLoading(false);
    }
  }, [callServerTool, currentData]);

  const handleContextChange = useCallback((videos: ContextVideo[]) => {
    setContextVideos(videos);

    if (app) {
      const contentText = videos.length > 0
        ? videos.map((video, index) => (
            `${index + 1}: Title: ${video.title}\nURL: ${video.url}\nDuration: ${video.duration}\nCreator: ${video.creator}`
          )).join('\n\n')
        : 'No videos selected.';

      app.updateModelContext({
        content: [{ type: 'text', text: contentText }],
      }).catch(err => console.error('Failed to update model context:', err));
    }
  }, [app]);

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

  const props: VideoSearchAppProps = {
    toolInputs,
    toolInputsPartial,
    toolResult: currentResult,
    hostContext,
    callServerTool,
    sendMessage,
    openLink,
    sendLog,
    displayMode: hostContext?.displayMode ?? 'inline',
    requestDisplayMode,
    availableDisplayModes: hostContext?.availableDisplayModes,
    onLoadPage: handleLoadPage,
    isLoading,
    contextVideos,
    onContextChange: handleContextChange,
  };

  // Derive initial loading state: tool invoked but no result yet
  const isInitialLoading = toolInputs !== null && currentResult === null;
  const loadingQuery = toolInputs?.query;

  return <VideoSearchApp {...props} isInitialLoading={isInitialLoading} loadingQuery={loadingQuery} />;
}
