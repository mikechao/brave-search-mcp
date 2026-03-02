/**
 * Brave Image Search UI - Thumbnail Grid Layout
 */
import type { WidgetProps } from '../../widget-props';
import type { ContextImage, ImageItem, ImageSearchData } from './types';
import { Check, Plus } from '@openai/apps-sdk-ui/components/Icon';
import { useMemo } from 'react';
import { SearchAppLayout } from '../shared/SearchAppLayout';

const EMPTY_CONTEXT_IMAGES: ContextImage[] = [];

export interface ImageSearchAppProps extends WidgetProps {
  /** Whether the initial search is in progress (tool invoked but no result yet) */
  isInitialLoading?: boolean;
  /** Query being searched during initial loading */
  loadingQuery?: string;
  /** Images currently in context */
  contextImages?: ContextImage[];
  /** Callback when user adds/removes image from context */
  onContextChange?: (images: ContextImage[]) => void;
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
  contextImages = EMPTY_CONTEXT_IMAGES,
  onContextChange,
}: ImageSearchAppProps) {
  const data = toolResult?.structuredContent as ImageSearchData | undefined;
  const items = data?.items ?? [];
  const error = data?.error;
  const hasData = Boolean(data);
  const contextImageUrls = useMemo(() => new Set(contextImages.map(i => i.imageUrl)), [contextImages]);
  const hasContextSupport = Boolean(onContextChange);

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

  const handleToggleContext = (item: ImageItem) => {
    if (!onContextChange)
      return;

    if (contextImageUrls.has(item.imageUrl)) {
      onContextChange(contextImages.filter(image => image.imageUrl !== item.imageUrl));
      return;
    }

    const contextImage: ContextImage = {
      title: item.title,
      source: item.source,
      pageUrl: item.pageUrl,
      imageUrl: item.imageUrl,
      confidence: item.confidence,
      width: item.width,
      height: item.height,
    };
    onContextChange([...contextImages, contextImage]);
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
          <article key={item.imageUrl} className="image-thumbnail-shell">
            <button
              className={`image-thumbnail ${contextImageUrls.has(item.imageUrl) ? 'image-thumbnail--in-context' : ''}`}
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
            {hasContextSupport && (
              <button
                type="button"
                className={`context-btn ${contextImageUrls.has(item.imageUrl) ? 'context-btn--active' : ''}`}
                onClick={() => handleToggleContext(item)}
                aria-label={contextImageUrls.has(item.imageUrl) ? 'Remove from context' : 'Add to context'}
                title={contextImageUrls.has(item.imageUrl) ? 'In context' : 'Add to context'}
              >
                {contextImageUrls.has(item.imageUrl) ? <Check width={14} height={14} /> : <Plus width={14} height={14} />}
              </button>
            )}
          </article>
        ))}
      </section>
    </SearchAppLayout>
  );
}
