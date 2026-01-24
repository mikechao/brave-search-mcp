/**
 * Brave Local Search Widget - Main App Component (Split View)
 * Supports pagination and add-to-context functionality
 */
import type { WidgetProps } from '../../widget-props';
import type { ContextPlace, LocalBusinessItem, LocalSearchData } from './types';
import { useRef, useState } from 'react';
import { FullscreenButton } from '../shared/FullscreenButton';
import { LocalBusinessCard } from './LocalBusinessCard';
import { LocalMap } from './LocalMap';

export interface LocalSearchAppProps extends WidgetProps {
  /** Callback to load a different page of results */
  onLoadPage?: (offset: number) => Promise<void>;
  /** Whether a page load is in progress */
  isLoading?: boolean;
  /** Places currently in context */
  contextPlaces?: ContextPlace[];
  /** Callback when user adds/removes place from context */
  onContextChange?: (places: ContextPlace[]) => void;
}

export default function LocalSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
  displayMode,
  requestDisplayMode,
  onLoadPage,
  isLoading: externalIsLoading,
  contextPlaces = [],
  onContextChange,
}: LocalSearchAppProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const isLoading = externalIsLoading ?? internalLoading;

  // Access structured content from _meta (new location) or top-level (legacy)
  const rawData = toolResult as any;
  const data = (rawData?._meta?.structuredContent ?? rawData?.structuredContent) as LocalSearchData | undefined;

  const items = data?.items ?? [];
  const error = data?.error;
  const fallbackToWeb = data?.fallbackToWeb;
  const hasData = Boolean(data);
  const currentOffset = data?.offset ?? 0;

  // Pagination logic - Brave API has max offset of 9
  const MAX_OFFSET = 9;
  const hasPrevious = currentOffset > 0;
  const hasNext = currentOffset < MAX_OFFSET && items.length > 0;
  const canPaginate = Boolean(onLoadPage) && hasData && !error && !fallbackToWeb;

  // Context selection helpers
  const contextIds = new Set(contextPlaces.map(p => `${p.name}-${p.address}`));
  const isInContext = (item: LocalBusinessItem) => contextIds.has(`${item.name}-${item.address}`);
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

  const handleSelectFromMap = (index: number) => {
    setSelectedIndex(index);
    // Scroll the list to show the selected card
    if (listRef.current) {
      const cards = listRef.current.querySelectorAll('.local-card');
      if (cards[index]) {
        cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
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

  const handleToggleContext = (item: LocalBusinessItem) => {
    if (!onContextChange)
      return;

    const place: ContextPlace = {
      name: item.name,
      address: item.address,
      phone: item.phone,
      rating: item.rating,
      coordinates: item.coordinates,
    };

    if (isInContext(item)) {
      // Remove from context
      onContextChange(contextPlaces.filter(p => `${p.name}-${p.address}` !== `${item.name}-${item.address}`));
    }
    else {
      // Add to context
      onContextChange([...contextPlaces, place]);
    }
  };

  const handleAddAllToContext = () => {
    if (!onContextChange)
      return;

    const newPlaces: ContextPlace[] = items
      .filter(item => !isInContext(item))
      .map(item => ({
        name: item.name,
        address: item.address,
        phone: item.phone,
        rating: item.rating,
        coordinates: item.coordinates,
      }));

    onContextChange([...contextPlaces, ...newPlaces]);
  };

  const pageNumber = currentOffset + 1;

  return (
    <main className="app local-app" style={containerStyle} data-display-mode={displayMode}>
      <header className="header">
        <div className="brand">
          <span className="brand-mark">Brave</span>
          <span className="brand-sub">Local Search</span>
        </div>
        <div className="meta">
          <div className="term">
            {hasData ? data?.query : 'Run brave_local_search to see results'}
          </div>
          <div className="count">
            {hasData ? `${data?.count ?? 0} PLACES` : 'Awaiting tool output'}
            {hasData && canPaginate && ` · Page ${pageNumber}`}
            {hasContextSupport && contextPlaces.length > 0 && ` · ${contextPlaces.length} in context`}
          </div>
        </div>
        <div className="header-actions">
          {hasContextSupport && items.length > 0 && (
            <button
              type="button"
              className="add-all-btn"
              onClick={handleAddAllToContext}
              disabled={items.every(item => isInContext(item))}
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

      {fallbackToWeb && (
        <div className="info-banner">
          No local results found. Showing web search results instead.
        </div>
      )}

      {!hasData && (
        <section className="empty-state">
          <h2>Ready for local search</h2>
          <p>
            Call
            {' '}
            <code>brave_local_search</code>
            {' '}
            with a location query to see the results.
          </p>
        </section>
      )}

      {hasData && items.length === 0 && !error && !fallbackToWeb && (
        <section className="empty-state">
          <h2>No places found</h2>
          <p>Try a different location or query.</p>
        </section>
      )}

      {items.length > 0 && (
        <div className="local-split-view">
          {/* Left: Business List */}
          <div className="local-list" ref={listRef}>
            {items.map((item, index) => (
              <LocalBusinessCard
                key={item.id || index}
                item={item}
                index={index}
                isSelected={selectedIndex === index}
                onSelect={() => setSelectedIndex(prev => prev === index ? null : index)}
                onOpenLink={handleOpenLink}
                isInContext={isInContext(item)}
                onToggleContext={hasContextSupport ? handleToggleContext : undefined}
              />
            ))}
          </div>

          {/* Right: Map */}
          <div className="local-map-wrapper">
            <LocalMap
              items={items}
              selectedIndex={selectedIndex}
              onSelectIndex={handleSelectFromMap}
              displayMode={displayMode}
              contextPlaces={contextPlaces}
            />
          </div>
        </div>
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
