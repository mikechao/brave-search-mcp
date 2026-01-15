/**
 * Web Search - ChatGPT mode wrapper
 * Uses window.openai runtime
 */
import type { WebSearchData } from './types';
import { useEffect, useState } from 'react';
import { WebResultCard } from './WebResultCard';

export default function WebChatGPTMode() {
    const [data, setData] = useState<WebSearchData | null>(null);

    useEffect(() => {
        const check = () => {
            const output = window.openai?.toolOutput;
            if (output) {
                setData(output as unknown as WebSearchData);
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
