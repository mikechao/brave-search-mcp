/**
 * Brave Image Search UI - using Aceternity Carousel
 */
import type { WidgetProps } from './widget-props.ts';
import type { ImageSlideData } from '@/components/ui/carousel';
import Carousel from '@/components/ui/carousel';

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

  // Convert ImageItem[] to ImageSlideData[] for carousel
  const slides: ImageSlideData[] = items.map(item => ({
    title: item.title,
    src: item.imageUrl,
    source: item.source,
    pageUrl: item.pageUrl,
  }));

  const handleOpenLink = async (slide: ImageSlideData) => {
    try {
      const { isError } = await openLink({ url: slide.pageUrl });
      if (isError) {
        await sendLog({ level: 'warning', data: `Open link rejected: ${slide.pageUrl}` });
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
            with a search term to see the carousel.
          </p>
        </section>
      )}

      {hasData && items.length === 0 && !error && (
        <section className="empty-state">
          <h2>No results</h2>
          <p>Try a broader query or adjust the count.</p>
        </section>
      )}

      {slides.length > 0 && (
        <section className="carousel-container">
          <Carousel slides={slides} onOpenLink={handleOpenLink} />
        </section>
      )}
    </main>
  );
}
