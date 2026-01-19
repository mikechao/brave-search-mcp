/**
 * Brave Web Search Widget - Main App Component
 */
import type { WidgetProps } from '../../widget-props';
import type { WebSearchData } from './types';
import { FullscreenButton } from '../shared/FullscreenButton';
import { WebResultCard } from './WebResultCard';

export default function WebSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
  displayMode,
  requestDisplayMode,
}: WidgetProps) {
  const data = toolResult?.structuredContent as WebSearchData | undefined;
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

  const handleFullscreenToggle = () => {
    if (requestDisplayMode) {
      const nextMode = displayMode === 'fullscreen' ? 'inline' : 'fullscreen';
      requestDisplayMode(nextMode);
    }
  };

  return (
    <main className="app web-app" style={containerStyle} data-display-mode={displayMode}>
      <header className="header">
        <div className="brand">
          <span className="brand-mark">Brave</span>
          <span className="brand-sub">Web Search</span>
        </div>
        <div className="meta">
          <div className="term">
            {hasData ? data?.query : 'Run brave_web_search to see results'}
          </div>
          <div className="count">
            {hasData ? `${data?.count ?? 0} RESULTS` : 'Awaiting tool output'}
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
          <h2>Ready to search</h2>
          <p>
            Call
            {' '}
            <code>brave_web_search</code>
            {' '}
            with a search term to see the results.
          </p>
        </section>
      )}

      {hasData && items.length === 0 && !error && (
        <section className="empty-state">
          <h2>No results</h2>
          <p>Try a different query or adjust the parameters.</p>
        </section>
      )}

      {items.length > 0 && (
        <section className="web-results-list">
          {items.map((item, index) => (
            <WebResultCard
              key={item.url}
              item={item}
              index={index}
              onOpenLink={handleOpenLink}
            />
          ))}
        </section>
      )}
    </main>
  );
}
