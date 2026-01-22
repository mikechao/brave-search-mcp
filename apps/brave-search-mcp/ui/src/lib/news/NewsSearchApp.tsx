/**
 * NewsSearchApp - Main news search widget component with pagination
 */
import type { WidgetProps } from '../../widget-props';
import type { NewsSearchData } from './types';
import { useState } from 'react';
import { FullscreenButton } from '../shared/FullscreenButton';
import { NewsCard } from './NewsCard';

export interface NewsSearchAppProps extends WidgetProps {
  /** Callback to load a different page of results */
  onLoadPage?: (offset: number) => Promise<void>;
  /** Whether a page load is in progress */
  isLoading?: boolean;
}

export default function NewsSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
  displayMode,
  requestDisplayMode,
  onLoadPage,
  isLoading: externalIsLoading,
}: NewsSearchAppProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalIsLoading ?? internalLoading;

  const data = toolResult?.structuredContent as NewsSearchData | undefined;
  const items = data?.items ?? [];
  const error = data?.error;
  const hasData = Boolean(data);
  const currentOffset = data?.offset ?? 0;

  // Pagination logic - Brave News API has max offset of 9
  const MAX_OFFSET = 9;
  const hasPrevious = currentOffset > 0;
  const hasNext = currentOffset < MAX_OFFSET && items.length > 0;
  const canPaginate = Boolean(onLoadPage) && hasData && !error;

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

  const pageNumber = currentOffset + 1;

  return (
    <main className="app news-app" style={containerStyle} data-display-mode={displayMode}>
      <header className="header">
        <div className="brand">
          <span className="brand-mark">Brave</span>
          <span className="brand-sub">News Search</span>
        </div>
        <div className="meta">
          <div className="term">
            {hasData ? data?.query : 'Run brave_news_search to see results'}
          </div>
          <div className="count">
            {hasData ? `${items.length} articles` : 'Awaiting tool output'}
            {hasData && canPaginate && ` · Page ${pageNumber}`}
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
          <h2>Ready for news</h2>
          <p>
            Call
            {' '}
            <code>brave_news_search</code>
            {' '}
            with a query to see the latest articles.
          </p>
        </section>
      )}

      {hasData && items.length === 0 && !error && (
        <section className="empty-state">
          <h2>No results</h2>
          <p>Try a different query or adjust the freshness filter.</p>
        </section>
      )}

      {items.length > 0 && (
        <section className="news-list">
          {items.map((item, index) => (
            <NewsCard
              key={`${item.url}-${index}`}
              item={item}
              index={index}
              onOpenLink={handleOpenLink}
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
    </main>
  );
}
