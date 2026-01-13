/**
 * Brave Image Search UI
 */
import type { WidgetProps } from './mcp-app-wrapper.tsx';

interface ImageItem {
  title: string;
  pageUrl: string;
  imageUrl: string;
  source: string;
  confidence?: string;
  width?: number;
  height?: number;
}

interface ImageSearchData {
  searchTerm: string;
  count: number;
  items: ImageItem[];
  error?: string;
}

export default function ImageSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
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

  const handleOpen = async (item: ImageItem) => {
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

  return (
    <main className="app" style={containerStyle}>
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
      </header>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!hasData && (
        <section className="empty-state">
          <h2>Ready for images</h2>
          <p>
            Call <code>brave_image_search</code> with a search term to populate the grid.
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
        <section className="grid">
          {items.map((item, index) => {
            const aspectRatio = item.width && item.height
              ? `${item.width} / ${item.height}`
              : '4 / 3';
            const dims = item.width && item.height
              ? `${item.width}×${item.height}`
              : 'Unknown size';
            return (
              <button
                key={`${item.pageUrl}-${index}`}
                type="button"
                className="card"
                style={{ animationDelay: `${index * 35}ms` }}
                onClick={() => handleOpen(item)}
              >
                <div className="thumb" style={{ aspectRatio }}>
                  <img src={item.imageUrl} alt={item.title} loading="lazy" />
                  <div className="overlay">
                    <div className="overlay-title">{item.title}</div>
                    <div className="overlay-meta">
                      <span>{item.source}</span>
                      <span>{dims}</span>
                    </div>
                  </div>
                </div>
                <div className="caption">
                  <span className="caption-title">{item.title}</span>
                  <span className="caption-source">{item.source}</span>
                </div>
              </button>
            );
          })}
        </section>
      )}
    </main>
  );
}
