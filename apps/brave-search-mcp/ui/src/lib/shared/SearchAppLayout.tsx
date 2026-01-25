/**
 * SearchAppLayout - Shared layout wrapper for all Brave Search widgets
 * Provides consistent header, error/empty states, and optional pagination
 */
import type { ReactNode } from 'react';
import type { WidgetProps } from '../../widget-props';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { ArrowLeftSm, ArrowRightSm } from '@openai/apps-sdk-ui/components/Icon';
import { FullscreenButton } from './FullscreenButton';

export interface PaginationConfig {
  pageNumber: number;
  hasPrevious: boolean;
  hasNext: boolean;
  isLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export interface ContextConfig {
  count: number;
  onAddAll: () => void;
  addAllDisabled: boolean;
}

export interface SearchAppLayoutProps {
  /** Widget variant for CSS class */
  variant: 'video' | 'web' | 'news' | 'local' | 'image';
  /** Subtitle shown after "Brave" in header (e.g., "Video Search") */
  brandSub: string;
  /** Search query to display */
  query?: string;
  /** Count label (e.g., "10 videos", "5 places") */
  countLabel?: string;
  /** Error message to display */
  error?: string;
  /** Info banner message (e.g., fallback to web) */
  infoBanner?: string;
  /** Whether structured data is available */
  hasData: boolean;
  /** Whether results are empty (has data but no items) */
  isEmpty: boolean;
  /** Empty state title when no data */
  emptyTitle: string;
  /** Empty state description when no data */
  emptyDescription: ReactNode;
  /** Empty state title when no results */
  noResultsTitle?: string;
  /** Empty state description when no results */
  noResultsDescription?: ReactNode;
  /** Main content (grid, list, etc.) */
  children: ReactNode;
  /** Optional pagination controls */
  pagination?: PaginationConfig;
  /** Optional context selection controls */
  context?: ContextConfig;
  /** Safe area insets from host */
  hostContext?: WidgetProps['hostContext'];
  /** Current display mode */
  displayMode?: WidgetProps['displayMode'];
  /** Request display mode change */
  requestDisplayMode?: WidgetProps['requestDisplayMode'];
}

export function SearchAppLayout({
  variant,
  brandSub,
  query,
  countLabel,
  error,
  infoBanner,
  hasData,
  isEmpty,
  emptyTitle,
  emptyDescription,
  noResultsTitle = 'No results',
  noResultsDescription = 'Try a different query.',
  children,
  pagination,
  context,
  hostContext,
  displayMode,
  requestDisplayMode,
}: SearchAppLayoutProps) {
  const safeAreaInsets = hostContext?.safeAreaInsets;
  const containerStyle = {
    paddingTop: safeAreaInsets?.top,
    paddingRight: safeAreaInsets?.right,
    paddingBottom: safeAreaInsets?.bottom,
    paddingLeft: safeAreaInsets?.left,
  };

  const handleFullscreenToggle = () => {
    if (requestDisplayMode) {
      const nextMode = displayMode === 'fullscreen' ? 'inline' : 'fullscreen';
      requestDisplayMode(nextMode);
    }
  };

  // Build page info string
  const pageInfo = pagination ? ` · Page ${pagination.pageNumber}` : '';
  const contextInfo = context && context.count > 0 ? ` · ${context.count} in context` : '';

  return (
    <main className={`app ${variant}-app`} style={containerStyle} data-display-mode={displayMode}>
      <header className="header">
        <div className="brand">
          <span className="brand-mark">Brave</span>
          <span className="brand-sub">{brandSub}</span>
        </div>
        <div className="header-right">
          <div className="meta">
            <div className="term">
              {hasData ? query : `Run brave_${variant}_search to see results`}
            </div>
            <div className="count">
              {hasData ? countLabel : 'Awaiting tool output'}
              {hasData && pagination && pageInfo}
              {contextInfo}
            </div>
          </div>
          <div className="header-actions">
            {context && (
              <button
                type="button"
                className="add-all-btn"
                onClick={context.onAddAll}
                disabled={context.addAllDisabled}
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
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong>
          {' '}
          {error}
        </div>
      )}

      {infoBanner && (
        <div className="info-banner">
          {infoBanner}
        </div>
      )}

      {!hasData && (
        <section className="empty-state">
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </section>
      )}

      {hasData && isEmpty && !error && (
        <section className="empty-state">
          <h2>{noResultsTitle}</h2>
          <p>{noResultsDescription}</p>
        </section>
      )}

      {hasData && !isEmpty && children}

      {pagination && hasData && !isEmpty && (
        <footer className="app-footer">
          <nav className="pagination" aria-label="Pagination">
            <Button
              type="button"
              color="secondary"
              variant="outline"
              size="sm"
              onClick={pagination.onPrevious}
              disabled={!pagination.hasPrevious || pagination.isLoading}
              aria-label="Previous page"
            >
              <ArrowLeftSm width={14} height={14} />
              Previous
            </Button>
            <span className="pagination-info">
              {pagination.isLoading ? 'Loading...' : `Page ${pagination.pageNumber}`}
            </span>
            <Button
              type="button"
              color="secondary"
              variant="outline"
              size="sm"
              onClick={pagination.onNext}
              disabled={!pagination.hasNext || pagination.isLoading}
              aria-label="Next page"
            >
              Next
              <ArrowRightSm width={14} height={14} />
            </Button>
          </nav>
        </footer>
      )}
    </main>
  );
}
