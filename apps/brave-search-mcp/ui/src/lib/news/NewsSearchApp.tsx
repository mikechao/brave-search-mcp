/**
 * NewsSearchApp - Main news search widget component with pagination and context selection
 */
import type { WidgetProps } from '../../widget-props';
import type { ContextArticle, NewsItem, NewsSearchData } from './types';
import { useState } from 'react';
import { SearchAppLayout } from '../shared/SearchAppLayout';
import { NewsCard } from './NewsCard';

export interface NewsSearchAppProps extends WidgetProps {
  /** Callback to load a different page of results */
  onLoadPage?: (offset: number) => Promise<void>;
  /** Whether a page load is in progress */
  isLoading?: boolean;
  /** Articles currently in context */
  contextArticles?: ContextArticle[];
  /** Callback when user adds/removes article from context */
  onContextChange?: (articles: ContextArticle[]) => void;
}

export default function NewsSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
  displayMode,
  requestDisplayMode,
  onLoadPage,
  isLoading: externalIsLoading,
  contextArticles = [],
  onContextChange,
}: NewsSearchAppProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalIsLoading ?? internalLoading;

  // Access structured content from _meta (new location) or top-level (legacy)
  const rawData = toolResult as any;
  const data = (rawData?._meta?.structuredContent ?? rawData?.structuredContent) as NewsSearchData | undefined;

  const items = data?.items ?? [];
  const error = data?.error;
  const hasData = Boolean(data);
  const currentOffset = data?.offset ?? 0;

  // Pagination logic - Brave News API has max offset of 9
  const MAX_OFFSET = 9;
  const hasPrevious = currentOffset > 0;
  const hasNext = currentOffset < MAX_OFFSET && items.length > 0;
  const canPaginate = Boolean(onLoadPage) && hasData && !error;

  // Context selection helpers
  const contextUrls = new Set(contextArticles.map(a => a.url));
  const isInContext = (url: string) => contextUrls.has(url);
  const hasContextSupport = Boolean(onContextChange);

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

  const handlePrevious = async () => {
    if (!onLoadPage || isLoading || !hasPrevious)
      return;
    setInternalLoading(true);
    try {
      await onLoadPage(currentOffset - 1);
    }
    finally {
      setInternalLoading(false);
    }
  };

  const handleNext = async () => {
    if (!onLoadPage || isLoading || !hasNext)
      return;
    setInternalLoading(true);
    try {
      await onLoadPage(currentOffset + 1);
    }
    finally {
      setInternalLoading(false);
    }
  };

  const handleToggleContext = (item: NewsItem) => {
    if (!onContextChange)
      return;

    const article: ContextArticle = {
      title: item.title,
      source: item.source,
      age: item.age,
      url: item.url,
    };

    if (isInContext(item.url)) {
      // Remove from context
      onContextChange(contextArticles.filter(a => a.url !== item.url));
    }
    else {
      // Add to context
      onContextChange([...contextArticles, article]);
    }
  };

  const handleAddAllToContext = () => {
    if (!onContextChange)
      return;

    const newArticles: ContextArticle[] = items
      .filter(item => !isInContext(item.url))
      .map(item => ({
        title: item.title,
        source: item.source,
        age: item.age,
        url: item.url,
      }));

    onContextChange([...contextArticles, ...newArticles]);
  };

  const pageNumber = currentOffset + 1;

  return (
    <SearchAppLayout
      variant="news"
      brandSub="News Search"
      query={data?.query}
      countLabel={`${items.length} articles`}
      error={error}
      hasData={hasData}
      isEmpty={items.length === 0}
      emptyTitle="Ready for news"
      emptyDescription={(
        <>
          Call
          {' '}
          <code>brave_news_search</code>
          {' '}
          with a query to see the latest articles.
        </>
      )}
      noResultsTitle="No results"
      noResultsDescription="Try a different query or adjust the freshness filter."
      hostContext={hostContext}
      displayMode={displayMode}
      requestDisplayMode={requestDisplayMode}
      pagination={canPaginate
        ? {
            pageNumber,
            hasPrevious,
            hasNext,
            isLoading,
            onPrevious: handlePrevious,
            onNext: handleNext,
          }
        : undefined}
      context={hasContextSupport && items.length > 0
        ? {
            count: contextArticles.length,
            onAddAll: handleAddAllToContext,
            addAllDisabled: items.every(item => isInContext(item.url)),
          }
        : undefined}
    >
      <section className="news-list">
        {items.map((item, index) => (
          <NewsCard
            key={`${item.url}-${index}`}
            item={item}
            index={index}
            onOpenLink={handleOpenLink}
            isInContext={isInContext(item.url)}
            onToggleContext={hasContextSupport ? handleToggleContext : undefined}
          />
        ))}
      </section>
    </SearchAppLayout>
  );
}
