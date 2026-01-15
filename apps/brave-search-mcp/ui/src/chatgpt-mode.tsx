import type { ImageSlideData } from '@/components/ui/carousel';
/**
 * ChatGPT mode wrapper - uses window.openai runtime
 * COMPLETELY STANDALONE - no ext-apps SDK dependency
 */
import { useEffect, useState } from 'react';
import Carousel from '@/components/ui/carousel';
import './global.css';
import './openai.d.ts';

// Define interfaces locally to avoid importing from ext-apps
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

export default function ChatGPTMode() {
  // Use state to track toolOutput - ChatGPT populates it AFTER initial render
  const [data, setData] = useState<ImageSearchData | undefined>(
    window.openai?.toolOutput as ImageSearchData | undefined,
  );

  // Watch for toolOutput updates from ChatGPT
  useEffect(() => {
    // Check immediately
    const currentData = window.openai?.toolOutput as ImageSearchData | undefined;
    if (currentData) {
      setData(currentData);
    }

    // Poll for updates since ChatGPT may set toolOutput after render
    const interval = setInterval(() => {
      const newData = window.openai?.toolOutput as ImageSearchData | undefined;
      if (newData) {
        setData(newData);
        clearInterval(interval); // Stop polling once we have data
      }
    }, 100);

    // Cleanup
    return () => clearInterval(interval);
  }, []);

  const items = data?.items ?? [];
  const error = data?.error;
  const hasData = Boolean(data);

  // Get safe area insets from ChatGPT
  const safeAreaInsets = window.openai?.safeAreaInsets;
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
      if (window.openai?.openExternal) {
        // ChatGPT expects { href: url } object, not just the url string
        await window.openai.openExternal({ href: slide.pageUrl });
      }
      else {
        // Fallback to window.open
        window.open(slide.pageUrl, '_blank');
      }
    }
    catch (e) {
      console.error('Open link failed:', e instanceof Error ? e.message : String(e));
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
