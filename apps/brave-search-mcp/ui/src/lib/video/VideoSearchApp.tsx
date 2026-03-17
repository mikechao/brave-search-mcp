/**
 * Brave Video Search Widget - Main App Component with pagination and context selection
 */
import type { DisplayMode, WidgetProps } from '../../widget-props';
import type { ContextVideo, VideoItem, VideoSearchData } from './types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchAppLayout } from '../shared/SearchAppLayout';
import { VideoCard } from './VideoCard';
import { VideoEmbedModal } from './VideoEmbedModal';
import { VideoPipView } from './VideoPipView';

const EMPTY_CONTEXT_VIDEOS: ContextVideo[] = [];

interface PendingPipAttempt {
  id: number;
  requestCompleted: boolean;
}

export interface VideoSearchAppProps extends WidgetProps {
  /** Callback to load a different page of results */
  onLoadPage?: (offset: number) => Promise<void>;
  /** Whether a page load is in progress */
  isLoading?: boolean;
  /** Whether the initial search is in progress (tool invoked but no result yet) */
  isInitialLoading?: boolean;
  /** Query being searched during initial loading */
  loadingQuery?: string;
  /** Videos currently in context */
  contextVideos?: ContextVideo[];
  /** Callback when user adds/removes video from context */
  onContextChange?: (videos: ContextVideo[]) => void;
  /** Display modes available on the host */
  availableDisplayModes?: DisplayMode[];
}

export default function VideoSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
  displayMode,
  requestDisplayMode,
  onLoadPage,
  isLoading: externalIsLoading,
  isInitialLoading,
  loadingQuery,
  contextVideos = EMPTY_CONTEXT_VIDEOS,
  onContextChange,
  availableDisplayModes,
}: VideoSearchAppProps) {
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [pipFailed, setPipFailed] = useState(false); // Track if PiP request failed
  const [pendingPipAttempt, setPendingPipAttempt] = useState<PendingPipAttempt | null>(null);
  const isLoading = externalIsLoading ?? internalLoading;

  // Track previous display mode to detect host-initiated PiP exit
  const prevDisplayModeRef = useRef(displayMode);
  const latestDisplayModeRef = useRef(displayMode);
  const latestPendingPipAttemptRef = useRef<PendingPipAttempt | null>(null);
  const nextPipAttemptIdRef = useRef(0);

  // Check if host supports PiP mode
  const supportsPip = availableDisplayModes?.includes('pip') ?? false;
  const canAttemptPip = supportsPip && Boolean(requestDisplayMode);

  // Access structured content from _meta (new location) or top-level (legacy)
  const data = (toolResult?._meta?.structuredContent ?? toolResult?.structuredContent) as VideoSearchData | undefined;

  const items = data?.items ?? [];
  const error = data?.error;
  const hasData = Boolean(data);
  const currentOffset = data?.offset ?? 0;
  const returnedCount = data?.returnedCount ?? items.length;
  const pageSize = data?.pageSize ?? data?.count ?? items.length;

  // Pagination logic - Brave Video API has max offset of 9
  const MAX_OFFSET = 9;
  const hasPrevious = currentOffset > 0;
  const hasNext = currentOffset < MAX_OFFSET && items.length > 0;
  const canPaginate = Boolean(onLoadPage) && hasData && !error;

  // Context selection helpers
  const contextUrls = useMemo(() => new Set(contextVideos.map(v => v.url)), [contextVideos]);
  const isInContext = (url: string) => contextUrls.has(url);
  const hasContextSupport = Boolean(onContextChange);

  const handleOpenLink = async (url: string) => {
    try {
      const { isError } = await openLink({ url });
      if (isError) {
        await sendLog({ level: 'warning', data: `Open link rejected: ${url}` });
      }
    }
    catch (e) {
      await sendLog({
        level: 'error',
        data: `Open link failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  // Handle host-initiated PiP exit (user dismissed PiP via host controls)
  // We need to clear activeVideo when host exits PiP mode
  useEffect(() => {
    latestDisplayModeRef.current = displayMode;
    const wasInPip = prevDisplayModeRef.current === 'pip';
    const exitedPip = wasInPip && displayMode !== 'pip';
    prevDisplayModeRef.current = displayMode;

    if (exitedPip && activeVideo) {
      // Host exited PiP mode, close the video
      // Using setTimeout to avoid the lint warning about direct setState in useEffect
      // This is intentional reactive behavior based on host context changes
      const timeoutId = setTimeout(() => setActiveVideo(null), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [displayMode, activeVideo]);

  useEffect(() => {
    latestPendingPipAttemptRef.current = pendingPipAttempt;
  }, [pendingPipAttempt]);

  useEffect(() => {
    if (pendingPipAttempt === null)
      return;

    if (displayMode === 'pip') {
      const timeoutId = setTimeout(() => {
        setPipFailed(false);
        setPendingPipAttempt(null);
      }, 0);

      return () => clearTimeout(timeoutId);
    }

    if (!pendingPipAttempt.requestCompleted)
      return;

    const attemptId = pendingPipAttempt.id;
    const timeoutId = setTimeout(() => {
      if (latestPendingPipAttemptRef.current?.id !== attemptId)
        return;

      if (latestDisplayModeRef.current !== 'pip')
        setPipFailed(true);

      setPendingPipAttempt(null);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [displayMode, pendingPipAttempt]);

  const handlePlay = async (video: VideoItem) => {
    setActiveVideo(video);
    setPipFailed(false); // Reset on new play
    setPendingPipAttempt(null);

    // Auto-enter PiP mode if host supports it
    if (canAttemptPip && requestDisplayMode) {
      const attemptId = nextPipAttemptIdRef.current + 1;
      nextPipAttemptIdRef.current = attemptId;
      setPendingPipAttempt({
        id: attemptId,
        requestCompleted: false,
      });

      try {
        await requestDisplayMode('pip');
        setPendingPipAttempt((current) => {
          if (current?.id !== attemptId)
            return current;

          return {
            ...current,
            requestCompleted: true,
          };
        });
      }
      catch {
        if (latestPendingPipAttemptRef.current?.id === attemptId) {
          setPendingPipAttempt(null);
          setPipFailed(true);
        }
      }
    }
  };

  const handleCloseModal = async () => {
    setActiveVideo(null);
    setPipFailed(false);
    setPendingPipAttempt(null);
    // If in PiP mode, request return to inline
    if (displayMode === 'pip' && requestDisplayMode) {
      await requestDisplayMode('inline');
    }
  };

  const handlePrevious = async () => {
    if (!onLoadPage || isLoading || !hasPrevious)
      return;
    setInternalLoading(true);
    try {
      await onLoadPage(currentOffset - 1);
    }
    finally {
      setInternalLoading(false);
    }
  };

  const handleNext = async () => {
    if (!onLoadPage || isLoading || !hasNext)
      return;
    setInternalLoading(true);
    try {
      await onLoadPage(currentOffset + 1);
    }
    finally {
      setInternalLoading(false);
    }
  };

  const handleToggleContext = (item: VideoItem) => {
    if (!onContextChange)
      return;

    const video: ContextVideo = {
      title: item.title,
      creator: item.creator,
      duration: item.duration,
      url: item.url,
    };

    if (isInContext(item.url)) {
      // Remove from context
      onContextChange(contextVideos.filter(v => v.url !== item.url));
    }
    else {
      // Add to context
      onContextChange([...contextVideos, video]);
    }
  };

  const handleAddAllToContext = () => {
    if (!onContextChange)
      return;

    const newVideos: ContextVideo[] = items
      .filter(item => !isInContext(item.url))
      .map(item => ({
        title: item.title,
        creator: item.creator,
        duration: item.duration,
        url: item.url,
      }));

    onContextChange([...contextVideos, ...newVideos]);
  };

  const pageNumber = currentOffset + 1;

  // Render PiP view when in PiP mode with active video
  if (displayMode === 'pip' && activeVideo) {
    return <VideoPipView video={activeVideo} />;
  }

  return (
    <>
      <SearchAppLayout
        variant="video"
        brandSub="Video Search"
        query={data?.query}
        countLabel={`${returnedCount}/${pageSize} videos`}
        error={error}
        isInitialLoading={isInitialLoading}
        loadingQuery={loadingQuery}
        hasData={hasData}
        isEmpty={items.length === 0}
        emptyTitle="Video Search"
        emptyDescription="Ask to search for videos on any topic."
        noResultsTitle="No results"
        noResultsDescription="Try a broader query or adjust the count."
        hostContext={hostContext}
        displayMode={displayMode}
        requestDisplayMode={requestDisplayMode}
        pagination={canPaginate
          ? {
              pageNumber,
              hasPrevious,
              hasNext,
              isLoading,
              onPrevious: handlePrevious,
              onNext: handleNext,
            }
          : undefined}
        context={hasContextSupport && items.length > 0
          ? {
              count: contextVideos.length,
              onAddAll: handleAddAllToContext,
              addAllDisabled: items.every(item => isInContext(item.url)),
            }
          : undefined}
      >
        <section className="video-grid">
          {items.map((item, index) => (
            <VideoCard
              key={item.url}
              item={item}
              index={index}
              onPlay={handlePlay}
              onOpenLink={handleOpenLink}
              isInContext={isInContext(item.url)}
              onToggleContext={hasContextSupport ? handleToggleContext : undefined}
            />
          ))}
        </section>
      </SearchAppLayout>

      {/* Show modal when PiP is not supported, or when PiP request failed */}
      {activeVideo && (!canAttemptPip || pipFailed) && (
        <VideoEmbedModal video={activeVideo} onClose={handleCloseModal} />
      )}
    </>
  );
}
