/**
 * Brave Local Search Widget - Main App Component (Split View)
 * Supports pagination and add-to-context functionality
 */
import type { WidgetProps } from '../../widget-props';
import type { ContextPlace, LocalBusinessItem, LocalSearchData } from './types';
import { lazy, Suspense, useRef, useState } from 'react';
import { SearchAppLayout } from '../shared/SearchAppLayout';
import { LocalBusinessCard } from './LocalBusinessCard';

const LocalMap = lazy(() => import('./LocalMap').then(module => ({ default: module.LocalMap })));

export interface LocalSearchAppProps extends WidgetProps {
  /** Callback to load a different page of results */
  onLoadPage?: (offset: number) => Promise<void>;
  /** Whether a page load is in progress */
  isLoading?: boolean;
  /** Whether the initial search is in progress (tool invoked but no result yet) */
  isInitialLoading?: boolean;
  /** Query being searched during initial loading */
  loadingQuery?: string;
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
  isInitialLoading,
  loadingQuery,
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
  const hasMapData = items.some(item => item.coordinates) || contextPlaces.some(place => place.coordinates);

  return (
    <SearchAppLayout
      variant="local"
      brandSub="Local Search"
      query={data?.query}
      countLabel={`${data?.count ?? 0} PLACES`}
      error={error}
      infoBanner={fallbackToWeb ? 'No local results found. Showing web search results instead.' : undefined}
      isInitialLoading={isInitialLoading}
      loadingQuery={loadingQuery}
      hasData={hasData}
      isEmpty={items.length === 0 && !fallbackToWeb}
      emptyTitle="Local Search"
      emptyDescription="Ask to search for local businesses and places."
      noResultsTitle="No places found"
      noResultsDescription="Try a different location or query."
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
            count: contextPlaces.length,
            onAddAll: handleAddAllToContext,
            addAllDisabled: items.every(item => isInContext(item)),
          }
        : undefined}
    >
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
          {hasMapData
            ? (
                <Suspense
                  fallback={(
                    <div className="local-map-empty">
                      <p>Loading map...</p>
                    </div>
                  )}
                >
                  <LocalMap
                    items={items}
                    selectedIndex={selectedIndex}
                    onSelectIndex={handleSelectFromMap}
                    displayMode={displayMode}
                    contextPlaces={contextPlaces}
                  />
                </Suspense>
              )
            : (
                <div className="local-map-empty">
                  <p>No location data available</p>
                </div>
              )}
        </div>
      </div>
    </SearchAppLayout>
  );
}
