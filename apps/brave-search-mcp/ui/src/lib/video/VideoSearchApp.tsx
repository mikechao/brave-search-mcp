/**
 * Brave Video Search Widget - Main App Component with pagination and context selection
 */
import type { WidgetProps } from '../../widget-props';
import type { ContextVideo, VideoItem, VideoSearchData } from './types';
import { useState } from 'react';
import { FullscreenButton } from '../shared/FullscreenButton';
import { VideoCard } from './VideoCard';
import { VideoEmbedModal } from './VideoEmbedModal';

export interface VideoSearchAppProps extends WidgetProps {
  /** Callback to load a different page of results */
  onLoadPage?: (offset: number) => Promise<void>;
  /** Whether a page load is in progress */
  isLoading?: boolean;
  /** Videos currently in context */
  contextVideos?: ContextVideo[];
  /** Callback when user adds/removes video from context */
  onContextChange?: (videos: ContextVideo[]) => void;
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
  contextVideos = [],
  onContextChange,
}: VideoSearchAppProps) {
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalIsLoading ?? internalLoading;

  // Access structured content from _meta (new location) or top-level (legacy)
  const rawData = toolResult as any;
  const data = (rawData?._meta?.structuredContent ?? rawData?.structuredContent) as VideoSearchData | undefined;

  const items = data?.items ?? [];
  const error = data?.error;
  const hasData = Boolean(data);
  const currentOffset = data?.offset ?? 0;

  // Pagination logic - Brave Video API has max offset of 9
  const MAX_OFFSET = 9;
  const hasPrevious = currentOffset > 0;
  const hasNext = currentOffset < MAX_OFFSET && items.length > 0;
  const canPaginate = Boolean(onLoadPage) && hasData && !error;

  // Context selection helpers
  const contextUrls = new Set(contextVideos.map(v => v.url));
  const isInContext = (url: string) => contextUrls.has(url);
  const hasContextSupport = Boolean(onContextChange);

  const safeAreaInsets = hostContext?.safeAreaInsets;
  const containerStyle = {
    paddingTop: safeAreaInsets?.top,
    paddingRight: safeAreaInsets?.right,
    paddingBottom: safeAreaInsets?.bottom,
    paddingLeft: safeAreaInsets?.left,
  };

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

  const handlePlay = (video: VideoItem) => {
    setActiveVideo(video);
  };

  const handleCloseModal = () => {
    setActiveVideo(null);
  };

  const handleFullscreenToggle = () => {
    if (requestDisplayMode) {
      const nextMode = displayMode === 'fullscreen' ? 'inline' : 'fullscreen';
      requestDisplayMode(nextMode);
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

  return (
    <main className="app video-app" style={containerStyle} data-display-mode={displayMode}>
      <header className="header">
        <div className="brand">
          <span className="brand-mark">Brave</span>
          <span className="brand-sub">Video Search</span>
        </div>
        <div className="meta">
          <div className="term">
            {hasData ? data?.query : 'Run brave_video_search to see results'}
          </div>
          <div className="count">
            {hasData ? `${data?.count ?? 0} videos` : 'Awaiting tool output'}
            {hasData && canPaginate && ` · Page ${pageNumber}`}
            {hasContextSupport && contextVideos.length > 0 && ` · ${contextVideos.length} in context`}
          </div>
        </div>
        <div className="header-actions">
          {hasContextSupport && items.length > 0 && (
            <button
              type="button"
              className="add-all-btn"
              onClick={handleAddAllToContext}
              disabled={items.every(item => isInContext(item.url))}
            >
              Add All
            </button>
          )}
          {requestDisplayMode && (
            <FullscreenButton
              onRequestFullscreen={handleFullscreenToggle}
              displayMode={displayMode}
            />
          )}
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong>
          {' '}
          {error}
        </div>
      )}

      {!hasData && (
        <section className="empty-state">
          <h2>Ready for videos</h2>
          <p>
            Call
            {' '}
            <code>brave_video_search</code>
            {' '}
            with a search term to see the results.
          </p>
        </section>
      )}

      {hasData && items.length === 0 && !error && (
        <section className="empty-state">
          <h2>No results</h2>
          <p>Try a broader query or adjust the count.</p>
        </section>
      )}

      {items.length > 0 && (
        <section className="video-grid">
          {items.map((item, index) => (
            <VideoCard
              key={`${item.url}-${index}`}
              item={item}
              index={index}
              onPlay={handlePlay}
              onOpenLink={handleOpenLink}
              isInContext={isInContext(item.url)}
              onToggleContext={hasContextSupport ? handleToggleContext : undefined}
            />
          ))}
        </section>
      )}

      {canPaginate && items.length > 0 && (
        <nav className="pagination">
          <button
            type="button"
            className="pagination-btn"
            onClick={handlePrevious}
            disabled={!hasPrevious || isLoading}
            aria-label="Previous page"
          >
            ← Previous
          </button>
          <span className="pagination-info">
            {isLoading ? 'Loading...' : `Page ${pageNumber}`}
          </span>
          <button
            type="button"
            className="pagination-btn"
            onClick={handleNext}
            disabled={!hasNext || isLoading}
            aria-label="Next page"
          >
            Next →
          </button>
        </nav>
      )}

      {activeVideo && (
        <VideoEmbedModal video={activeVideo} onClose={handleCloseModal} />
      )}
    </main>
  );
}
