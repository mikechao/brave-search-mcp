/**
 * Brave Image Search UI - Thumbnail Grid Layout
 */
import type { WidgetProps } from '../../widget-props';
import type { ImageItem, ImageSearchData } from './types';
import { SearchAppLayout } from '../shared/SearchAppLayout';

export interface ImageSearchAppProps extends WidgetProps {
  /** Whether the initial search is in progress (tool invoked but no result yet) */
  isInitialLoading?: boolean;
  /** Query being searched during initial loading */
  loadingQuery?: string;
}

export default function ImageSearchApp({
  toolResult,
  hostContext,
  openLink,
  sendLog,
  displayMode,
  requestDisplayMode,
  isInitialLoading,
  loadingQuery,
}: ImageSearchAppProps) {
  const data = toolResult?.structuredContent as ImageSearchData | undefined;
  const items = data?.items ?? [];
  const error = data?.error;
  const hasData = Boolean(data);

  const handleOpenLink = async (item: ImageItem) => {
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
    <SearchAppLayout
      variant="image"
      brandSub="Image Search"
      query={data?.searchTerm}
      countLabel={`${data?.count ?? 0} results`}
      error={error}
      isInitialLoading={isInitialLoading}
      loadingQuery={loadingQuery}
      hasData={hasData}
      isEmpty={items.length === 0}
      emptyTitle="Image Search"
      emptyDescription="Ask to search for images on any topic."
      noResultsTitle="No results"
      noResultsDescription="Try a broader query or adjust the count."
      hostContext={hostContext}
      displayMode={displayMode}
      requestDisplayMode={requestDisplayMode}
    >
      <section className="image-grid">
        {items.map(item => (
          <button
            key={item.imageUrl}
            className="image-thumbnail"
            onClick={() => handleOpenLink(item)}
            type="button"
          >
            <img
              src={item.imageUrl}
              alt={item.title}
              loading="lazy"
            />
            <div className="image-overlay">
              <div className="image-overlay-title">{item.title}</div>
              <div className="image-overlay-source">{item.source}</div>
            </div>
          </button>
        ))}
      </section>
    </SearchAppLayout>
  );
}
