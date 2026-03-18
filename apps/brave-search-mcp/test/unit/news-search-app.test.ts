import type { NewsSearchAppProps } from '../../ui/src/lib/news/NewsSearchApp.js';
import type { NewsSearchData } from '../../ui/src/lib/news/types.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import NewsSearchApp from '../../ui/src/lib/news/NewsSearchApp.js';

function createProps(data: NewsSearchData): NewsSearchAppProps {
  const requestDisplayMode: NonNullable<NewsSearchAppProps['requestDisplayMode']> = vi.fn(async () => 'inline' as const);

  return {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: { structuredContent: data },
    hostContext: null,
    openLink: vi.fn(async () => ({ isError: false })),
    sendLog: vi.fn(async () => {}),
    displayMode: 'inline',
    requestDisplayMode,
  };
}

describe('newsSearchApp', () => {
  it('disables next pagination when Brave says no more results are available', () => {
    const markup = renderToStaticMarkup(createElement(NewsSearchApp, {
      ...createProps({
        query: 'tech',
        count: 1,
        pageSize: 1,
        returnedCount: 1,
        offset: 0,
        moreResultsAvailable: false,
        items: [
          {
            title: 'Top Story',
            url: 'https://example.com/story',
            description: 'Latest tech story',
            source: 'example.com',
            age: '1h ago',
            breaking: false,
          },
        ],
      }),
      onLoadPage: vi.fn(async () => {}),
    }));

    expect(markup).toContain('Top Story');
    expect(markup).toContain('Page 1');
    expect(markup).toMatch(/<button[^>]*(?:disabled=""[^>]*aria-label="Next page"|aria-label="Next page"[^>]*disabled="")/);
  });

  it('falls back to the legacy pagination heuristic when Brave does not provide the flag', () => {
    const markup = renderToStaticMarkup(createElement(NewsSearchApp, {
      ...createProps({
        query: 'tech',
        count: 1,
        pageSize: 1,
        returnedCount: 1,
        offset: 0,
        items: [
          {
            title: 'Top Story',
            url: 'https://example.com/story',
            description: 'Latest tech story',
            source: 'example.com',
            age: '1h ago',
            breaking: false,
          },
        ],
      }),
      onLoadPage: vi.fn(async () => {}),
    }));

    expect(markup).toContain('Page 1');
    expect(markup).not.toContain('aria-label="Next page" disabled');
  });
});
