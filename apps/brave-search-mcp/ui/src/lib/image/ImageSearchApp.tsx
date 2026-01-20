/**
 * Brave Image Search UI - Thumbnail Grid Layout with Save to Context
 */
import type { WidgetProps } from '../../widget-props';
import type { ImageItem, ImageSearchData } from './types';
import { useState } from 'react';
import { FullscreenButton } from '../shared/FullscreenButton';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ImageSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
  displayMode,
  requestDisplayMode,
  onSaveImage,
}: WidgetProps) {
  const data = toolResult?.structuredContent as ImageSearchData | undefined;
  const items = data?.items ?? [];
  const error = data?.error;
  const hasData = Boolean(data);

  // Track save state for each image by index
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({});

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

  const handleSaveImage = async (item: ImageItem, index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the link

    if (!onSaveImage || saveStates[index] === 'saving' || saveStates[index] === 'saved') {
      return;
    }

    setSaveStates(prev => ({ ...prev, [index]: 'saving' }));

    try {
      await onSaveImage({ imageUrl: item.imageUrl, title: item.title });
      setSaveStates(prev => ({ ...prev, [index]: 'saved' }));
    }
    catch (err) {
      console.error('Failed to save image:', err);
      setSaveStates(prev => ({ ...prev, [index]: 'error' }));
    }
  };

  const handleFullscreenToggle = () => {
    if (requestDisplayMode) {
      const nextMode = displayMode === 'fullscreen' ? 'inline' : 'fullscreen';
      requestDisplayMode(nextMode);
    }
  };

  const getSaveIcon = (state: SaveState | undefined) => {
    switch (state) {
      case 'saving':
        return (
          <svg className="save-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
          </svg>
        );
      case 'saved':
        return (
          <svg className="save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'error':
        return (
          <svg className="save-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        );
      default:
        return (
          <svg className="save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        );
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

      {onSaveImage && hasData && items.length > 0 && (
        <div className="save-hint">
          Click the save icon to add an image to the conversation context
        </div>
      )}

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
            <div
              key={`${item.pageUrl}-${index}`}
              className={`image-thumbnail ${saveStates[index] ? `image-thumbnail--${saveStates[index]}` : ''}`}
            >
              <button
                className="image-thumbnail-btn"
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
              {onSaveImage && (
                <button
                  className={`image-save-btn ${saveStates[index] || 'idle'}`}
                  onClick={e => handleSaveImage(item, index, e)}
                  disabled={saveStates[index] === 'saving' || saveStates[index] === 'saved'}
                  title={
                    saveStates[index] === 'saved'
                      ? 'Saved to context'
                      : saveStates[index] === 'error'
                        ? 'Failed to save - click to retry'
                        : 'Save to conversation context'
                  }
                  type="button"
                >
                  {getSaveIcon(saveStates[index])}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
