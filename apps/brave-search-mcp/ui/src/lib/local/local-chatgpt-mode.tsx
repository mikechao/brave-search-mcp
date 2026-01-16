/**
 * Local Search - ChatGPT mode wrapper
 * Uses window.openai runtime
 */
import type { LocalSearchData } from './types';
import { useRef, useEffect, useState } from 'react';
import { LocalBusinessCard } from './LocalBusinessCard';
import { LocalMap } from './LocalMap';

export default function LocalChatGPTMode() {
    const [data, setData] = useState<LocalSearchData | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const check = () => {
            const output = window.openai?.toolOutput;
            if (output) {
                setData(output as unknown as LocalSearchData);
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

    const handleSelectFromMap = (index: number) => {
        setSelectedIndex(index);
        if (listRef.current) {
            const cards = listRef.current.querySelectorAll('.local-card');
            if (cards[index]) {
                cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    };

    const items = data?.items ?? [];
    const error = data?.error;
    const fallbackToWeb = data?.fallbackToWeb;
    const hasData = Boolean(data);

    const safeAreaInsets = window.openai?.safeAreaInsets;
    const containerStyle = {
        paddingTop: safeAreaInsets?.top,
        paddingRight: safeAreaInsets?.right,
        paddingBottom: safeAreaInsets?.bottom,
        paddingLeft: safeAreaInsets?.left,
    };

    return (
        <main className="app local-app" style={containerStyle}>
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
                    <div className="local-list" ref={listRef}>
                        {items.map((item, index) => (
                            <LocalBusinessCard
                                key={item.id || index}
                                item={item}
                                index={index}
                                isSelected={selectedIndex === index}
                                onSelect={() => setSelectedIndex(index)}
                                onOpenLink={handleOpenLink}
                            />
                        ))}
                    </div>
                    <div className="local-map-wrapper">
                        <LocalMap
                            items={items}
                            selectedIndex={selectedIndex}
                            onSelectIndex={handleSelectFromMap}
                        />
                    </div>
                </div>
            )}
        </main>
    );
}
