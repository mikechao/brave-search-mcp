/**
 * Brave Local Search Widget - Main App Component (Split View)
 */
import type { WidgetProps } from '../../widget-props';
import type { LocalSearchData } from './types';
import { useRef, useState } from 'react';
import { FullscreenButton } from './FullscreenButton';
import { LocalBusinessCard } from './LocalBusinessCard';
import { LocalMap } from './LocalMap';

export default function LocalSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
  displayMode,
  requestDisplayMode,
}: WidgetProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const data = toolResult?.structuredContent as LocalSearchData | undefined;
  const items = data?.items ?? [];
  const error = data?.error;
  const fallbackToWeb = data?.fallbackToWeb;
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
            />
          </div>
        </div>
      )}
    </main>
  );
}
