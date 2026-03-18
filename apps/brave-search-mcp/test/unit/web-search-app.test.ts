import type { WebSearchData } from '../../ui/src/lib/web/types.js';
import type { WebSearchAppProps } from '../../ui/src/lib/web/WebSearchApp.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import WebSearchApp from '../../ui/src/lib/web/WebSearchApp.js';

function createProps(data: WebSearchData): WebSearchAppProps {
  const requestDisplayMode: NonNullable<WebSearchAppProps['requestDisplayMode']> = vi.fn(async () => 'inline' as const);

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

describe('webSearchApp', () => {
  it('disables next pagination when Brave says no more results are available', () => {
    const markup = renderToStaticMarkup(createElement(WebSearchApp, {
      ...createProps({
        query: 'open source',
        count: 1,
        pageSize: 1,
        returnedCount: 1,
        offset: 0,
        moreResultsAvailable: false,
        items: [
          {
            title: 'OSS Home',
            url: 'https://example.com',
            description: 'Portal',
            domain: 'example.com',
          },
        ],
      }),
      onLoadPage: vi.fn(async () => {}),
    }));

    expect(markup).toContain('OSS Home');
    expect(markup).toContain('Page 1');
    expect(markup).toMatch(/<button[^>]*(?:disabled=""[^>]*aria-label="Next page"|aria-label="Next page"[^>]*disabled="")/);
  });

  it('falls back to the legacy pagination heuristic when Brave does not provide the flag', () => {
    const markup = renderToStaticMarkup(createElement(WebSearchApp, {
      ...createProps({
        query: 'open source',
        count: 1,
        pageSize: 1,
        returnedCount: 1,
        offset: 0,
        items: [
          {
            title: 'OSS Home',
            url: 'https://example.com',
            description: 'Portal',
            domain: 'example.com',
          },
        ],
      }),
      onLoadPage: vi.fn(async () => {}),
    }));

    expect(markup).toContain('Page 1');
    expect(markup).not.toContain('aria-label="Next page" disabled');
  });
});
