/**
 * NewsSearchApp - Main news search widget component
 */
import type { WidgetProps } from '../../widget-props';
import type { NewsSearchData } from './types';
import { NewsCard } from './NewsCard';

export default function NewsSearchApp({
    toolResult,
    hostContext,
    openLink,
    sendLog,
}: WidgetProps) {
    const data = toolResult?.structuredContent as NewsSearchData | undefined;
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

    return (
        <main className="app" style={containerStyle}>
            <header className="header">
                <div className="brand">
                    <span className="brand-mark">Brave</span>
                    <span className="brand-sub">News Search</span>
                </div>
                <div className="meta">
                    <div className="term">
                        {hasData ? data?.query : 'Run brave_news_search to see results'}
                    </div>
                    <div className="count">
                        {hasData ? `${data?.count ?? 0} articles` : 'Awaiting tool output'}
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
                    <h2>Ready for news</h2>
                    <p>
                        Call
                        {' '}
                        <code>brave_news_search</code>
                        {' '}
                        with a query to see the latest articles.
                    </p>
                </section>
            )}

            {hasData && items.length === 0 && !error && (
                <section className="empty-state">
                    <h2>No results</h2>
                    <p>Try a different query or adjust the freshness filter.</p>
                </section>
            )}

            {items.length > 0 && (
                <section className="news-list">
                    {items.map((item, index) => (
                        <NewsCard
                            key={`${item.url}-${index}`}
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
