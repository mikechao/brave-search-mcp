/**
 * Brave Image Search UI - Thumbnail Grid Layout
 */
import type { WidgetProps } from '../../widget-props';
import type { ContextImage, ImageItem, ImageSearchData } from './types';
import { Check, Plus } from '@openai/apps-sdk-ui/components/Icon';
import { useMemo, useState } from 'react';
import { SearchAppLayout } from '../shared/SearchAppLayout';

const EMPTY_CONTEXT_IMAGES: ContextImage[] = [];
const EMPTY_PENDING_IMAGE_URLS: string[] = [];

function ContextSpinner() {
  return (
    <span
      className="inline-block animate-spin rounded-full border-solid border-[var(--grid-line-strong)] border-t-[var(--accent)]"
      style={{ width: 14, height: 14, borderWidth: 2 }}
      aria-hidden="true"
    />
  );
}

export interface ImageSearchAppProps extends WidgetProps {
  /** Whether the initial search is in progress (tool invoked but no result yet) */
  isInitialLoading?: boolean;
  /** Query being searched during initial loading */
  loadingQuery?: string;
  /** Images currently in context */
  contextImages?: ContextImage[];
  /** Callback when user adds/removes image from context */
  onContextChange?: (images: ContextImage[]) => void | Promise<void>;
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
  const [pendingImageUrls, setPendingImageUrls] = useState<string[]>(EMPTY_PENDING_IMAGE_URLS);
  const contextImageUrls = useMemo(() => new Set(contextImages.map(i => i.imageUrl)), [contextImages]);
  const pendingImageUrlSet = useMemo(() => new Set(pendingImageUrls), [pendingImageUrls]);
  const hasPendingContextAdd = pendingImageUrls.length > 0;
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

  const handleToggleContext = async (item: ImageItem) => {
    if (!onContextChange)
      return;

    if (pendingImageUrlSet.has(item.imageUrl)) {
      return;
    }

    if (contextImageUrls.has(item.imageUrl)) {
      onContextChange(contextImages.filter(image => image.imageUrl !== item.imageUrl));
      return;
    }

    if (hasPendingContextAdd) {
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
    setPendingImageUrls(current => current.includes(item.imageUrl) ? current : [...current, item.imageUrl]);
    try {
      await onContextChange([...contextImages, contextImage]);
    }
    catch {
      // Parent wrappers own failure handling; just clear the pending UI state here.
    }
    finally {
      setPendingImageUrls(current => current.filter(imageUrl => imageUrl !== item.imageUrl));
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
        {items.map((item) => {
          const isInContext = contextImageUrls.has(item.imageUrl);
          const isPending = pendingImageUrlSet.has(item.imageUrl);
          const ariaLabel = isPending
            ? 'Adding to context'
            : isInContext
              ? 'Remove from context'
              : 'Add to context';
          const title = isPending
            ? 'Adding to context'
            : isInContext
              ? 'In context'
              : 'Add to context';

          return (
            <article key={item.imageUrl} className="image-thumbnail-shell">
              <button
                className={`image-thumbnail ${isInContext ? 'image-thumbnail--in-context' : ''}`}
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
                  className={`context-btn ${isInContext ? 'context-btn--active' : ''} ${isPending ? 'context-btn--pending' : ''}`}
                  onClick={() => handleToggleContext(item)}
                  aria-label={ariaLabel}
                  title={title}
                  disabled={hasPendingContextAdd}
                >
                  {isPending ? <ContextSpinner /> : isInContext ? <Check width={14} height={14} /> : <Plus width={14} height={14} />}
                </button>
              )}
            </article>
          );
        })}
      </section>
    </SearchAppLayout>
  );
}
