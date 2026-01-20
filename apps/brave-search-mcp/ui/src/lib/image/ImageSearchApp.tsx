/**
 * Brave Image Search UI - Thumbnail Grid Layout
 */
import type { WidgetProps } from '../../widget-props';
import type { ImageItem, ImageSearchData } from './types';
import { FullscreenButton } from '../shared/FullscreenButton';

export default function ImageSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
  displayMode,
  requestDisplayMode,
}: WidgetProps) {
  const data = toolResult?.structuredContent as ImageSearchData | undefined;
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

  const handleOpenLink = async (item: ImageItem) => {
    try {
      const { isError } = await openLink({ url: item.pageUrl });
      if (isError) {
        await sendLog({ level: 'warning', data: `Open link rejected: ${item.pageUrl}` });
      }
    }
    catch (e) {
      await sendLog({
        level: 'error',
        data: `Open link failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const handleFullscreenToggle = () => {
    if (requestDisplayMode) {
      const nextMode = displayMode === 'fullscreen' ? 'inline' : 'fullscreen';
      requestDisplayMode(nextMode);
    }
  };

  return (
    <main className="app image-app" style={containerStyle} data-display-mode={displayMode}>
      <header className="header">
        <div className="brand">
          <span className="brand-mark">Brave</span>
          <span className="brand-sub">Image Search</span>
        </div>
        <div className="meta">
          <div className="term">
            {hasData ? data?.searchTerm : 'Run brave_image_search to see results'}
          </div>
          <div className="count">
            {hasData ? `${data?.count ?? 0} results` : 'Awaiting tool output'}
          </div>
        </div>
        {requestDisplayMode && (
          <FullscreenButton
            onRequestFullscreen={handleFullscreenToggle}
            displayMode={displayMode}
          />
        )}
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
          <h2>Ready for images</h2>
          <p>
            Call
            {' '}
            <code>brave_image_search</code>
            {' '}
            with a search term to see results.
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
        <section className="image-grid">
          {items.map((item, index) => (
            <button
              key={`${item.pageUrl}-${index}`}
              className="image-thumbnail"
              onClick={() => handleOpenLink(item)}
              type="button"
            >
              <img
                src={item.imageUrl}
                alt={item.title}
                loading="lazy"
              />
              <div className="image-overlay">
                <div className="image-overlay-title">{item.title}</div>
                <div className="image-overlay-source">{item.source}</div>
              </div>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
