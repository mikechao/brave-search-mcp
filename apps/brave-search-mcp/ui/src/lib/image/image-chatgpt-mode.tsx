/**
 * Image Search - ChatGPT mode wrapper
 * Uses window.openai runtime - COMPLETELY STANDALONE
 */
import type { ImageSlideData } from '@/components/ui/carousel';
import type { ImageSearchData } from './types';
import { useEffect, useState } from 'react';
import Carousel from '@/components/ui/carousel';

export default function ImageChatGPTMode() {
    const [data, setData] = useState<ImageSearchData | undefined>(
        window.openai?.toolOutput as ImageSearchData | undefined,
    );

    useEffect(() => {
        const currentData = window.openai?.toolOutput as ImageSearchData | undefined;
        if (currentData) {
            setData(currentData);
        }

        const interval = setInterval(() => {
            const newData = window.openai?.toolOutput as ImageSearchData | undefined;
            if (newData) {
                setData(newData);
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, []);

    const items = data?.items ?? [];
    const error = data?.error;
    const hasData = Boolean(data);

    const safeAreaInsets = window.openai?.safeAreaInsets;
    const containerStyle = {
        paddingTop: safeAreaInsets?.top,
        paddingRight: safeAreaInsets?.right,
        paddingBottom: safeAreaInsets?.bottom,
        paddingLeft: safeAreaInsets?.left,
    };

    const slides: ImageSlideData[] = items.map(item => ({
        title: item.title,
        src: item.imageUrl,
        source: item.source,
        pageUrl: item.pageUrl,
    }));

    const handleOpenLink = async (slide: ImageSlideData) => {
        try {
            if (window.openai?.openExternal) {
                await window.openai.openExternal({ href: slide.pageUrl });
            }
            else {
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
