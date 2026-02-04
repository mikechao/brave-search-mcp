/**
 * Brave Web Search Widget - Main App Component with pagination and context selection
 */
import type { WidgetProps } from '../../widget-props';
import type { ContextResult, WebResultItem, WebSearchData } from './types';
import { useState } from 'react';
import { SearchAppLayout } from '../shared/SearchAppLayout';
import { WebResultCard } from './WebResultCard';

export interface WebSearchAppProps extends WidgetProps {
  /** Callback to load a different page of results */
  onLoadPage?: (offset: number) => Promise<void>;
  /** Whether a page load is in progress */
  isLoading?: boolean;
  /** Whether the initial search is in progress (tool invoked but no result yet) */
  isInitialLoading?: boolean;
  /** Query being searched during initial loading */
  loadingQuery?: string;
  /** Results currently in context */
  contextResults?: ContextResult[];
  /** Callback when user adds/removes result from context */
  onContextChange?: (results: ContextResult[]) => void;
}

export default function WebSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
  displayMode,
  requestDisplayMode,
  onLoadPage,
  isLoading: externalIsLoading,
  isInitialLoading,
  loadingQuery,
  contextResults = [],
  onContextChange,
}: WebSearchAppProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalIsLoading ?? internalLoading;

  // Access structured content from _meta (new location) or top-level (legacy)
  const rawData = toolResult as any;
  const data = (rawData?._meta?.structuredContent ?? rawData?.structuredContent) as WebSearchData | undefined;

  const items = data?.items ?? [];
  const error = data?.error;
  const hasData = Boolean(data);
  const currentOffset = data?.offset ?? 0;
  const returnedCount = data?.returnedCount ?? items.length;
  const pageSize = data?.pageSize ?? data?.count ?? items.length;

  // Pagination logic - Brave Web API has max offset of 9
  const MAX_OFFSET = 9;
  const hasPrevious = currentOffset > 0;
  const hasNext = currentOffset < MAX_OFFSET && items.length > 0;
  const canPaginate = Boolean(onLoadPage) && hasData && !error;

  // Context selection helpers
  const contextUrls = new Set(contextResults.map(r => r.url));
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

  const handleToggleContext = (item: WebResultItem) => {
    if (!onContextChange)
      return;

    const result: ContextResult = {
      title: item.title,
      url: item.url,
      description: item.description,
      domain: item.domain,
    };

    if (isInContext(item.url)) {
      // Remove from context
      onContextChange(contextResults.filter(r => r.url !== item.url));
    }
    else {
      // Add to context
      onContextChange([...contextResults, result]);
    }
  };

  const handleAddAllToContext = () => {
    if (!onContextChange)
      return;

    const newResults: ContextResult[] = items
      .filter(item => !isInContext(item.url))
      .map(item => ({
        title: item.title,
        url: item.url,
        description: item.description,
        domain: item.domain,
      }));

    onContextChange([...contextResults, ...newResults]);
  };

  const pageNumber = currentOffset + 1;

  return (
    <SearchAppLayout
      variant="web"
      brandSub="Web Search"
      query={data?.query}
      countLabel={`${returnedCount}/${pageSize} results`}
      error={error}
      isInitialLoading={isInitialLoading}
      loadingQuery={loadingQuery}
      hasData={hasData}
      isEmpty={items.length === 0}
      emptyTitle="Web Search"
      emptyDescription="Ask to search the web for any topic."
      noResultsTitle="No results"
      noResultsDescription="Try a different query or adjust the parameters."
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
            count: contextResults.length,
            onAddAll: handleAddAllToContext,
            addAllDisabled: items.every(item => isInContext(item.url)),
          }
        : undefined}
    >
      <section className="web-results-list">
        {items.map((item, index) => (
          <WebResultCard
            key={item.url}
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
