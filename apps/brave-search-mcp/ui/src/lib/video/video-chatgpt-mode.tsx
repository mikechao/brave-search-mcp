/**
 * Video Search - ChatGPT mode wrapper
 * Uses window.openai runtime
 */
import type { VideoItem, VideoSearchData } from './types';
import { useEffect, useState } from 'react';
import { VideoCard } from './VideoCard';
import { VideoEmbedModal } from './VideoEmbedModal';

export default function VideoChatGPTMode() {
    const [data, setData] = useState<VideoSearchData | null>(null);
    const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

    useEffect(() => {
        const check = () => {
            const output = window.openai?.toolOutput;
            if (output) {
                setData(output as unknown as VideoSearchData);
            }
        };
        check();
        const interval = setInterval(check, 200);
        return () => clearInterval(interval);
    }, []);

    const handleOpenLink = async (url: string) => {
        try {
            if (window.openai?.openExternal) {
                window.openai.openExternal({ href: url });
            }
            else {
                window.open(url, '_blank');
            }
        }
        catch {
            console.error('Open link failed');
        }
    };

    const handlePlay = (video: VideoItem) => {
        setActiveVideo(video);
    };

    const handleCloseModal = () => {
        setActiveVideo(null);
    };

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

    return (
        <main className="app" style={containerStyle}>
            <header className="header">
                <div className="brand">
                    <span className="brand-mark">Brave</span>
                    <span className="brand-sub">Video Search</span>
                </div>
                <div className="meta">
                    <div className="term">
                        {hasData ? data?.query : 'Run brave_video_search to see results'}
                    </div>
                    <div className="count">
                        {hasData ? `${data?.count ?? 0} VIDEOS` : 'Awaiting tool output'}
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
                    <h2>Ready for videos</h2>
                    <p>
                        Call
                        {' '}
                        <code>brave_video_search</code>
                        {' '}
                        with a search term to see the results.
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
                <section className="video-grid">
                    {items.map((item, index) => (
                        <VideoCard
                            key={item.url}
                            item={item}
                            index={index}
                            onPlay={handlePlay}
                            onOpenLink={handleOpenLink}
                        />
                    ))}
                </section>
            )}

            {activeVideo && (
                <VideoEmbedModal video={activeVideo} onClose={handleCloseModal} />
            )}
        </main>
    );
}
