/**
 * Brave Video Search Widget - Main App Component
 */
import type { WidgetProps } from '../../widget-props';
import type { VideoItem, VideoSearchData } from './types';
import { useState } from 'react';
import { VideoCard } from './VideoCard';
import { VideoEmbedModal } from './VideoEmbedModal';

export default function VideoSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
}: WidgetProps) {
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  const data = toolResult?.structuredContent as VideoSearchData | undefined;
  const items = data?.items ?? [];
  const error = data?.error;
  const hasData = Boolean(data);

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

  return (
    <main className="app" style={containerStyle}>
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
            {hasData ? `${data?.count ?? 0} VIDEOS` : 'Awaiting tool output'}
          </div>
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
              key={item.url}
              item={item}
              index={index}
              onPlay={handlePlay}
              onOpenLink={handleOpenLink}
            />
          ))}
        </section>
      )}

      {activeVideo && (
        <VideoEmbedModal video={activeVideo} onClose={handleCloseModal} />
      )}
    </main>
  );
}
