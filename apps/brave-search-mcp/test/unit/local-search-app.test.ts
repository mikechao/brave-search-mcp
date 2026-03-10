import type { LocalSearchAppProps } from '../../ui/src/lib/local/LocalSearchApp.js';
import type { LocalSearchData } from '../../ui/src/lib/local/types.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LocalSearchApp from '../../ui/src/lib/local/LocalSearchApp.js';

function createProps(data: LocalSearchData): LocalSearchAppProps {
  const requestDisplayMode: NonNullable<LocalSearchAppProps['requestDisplayMode']> = vi.fn(async () => 'inline' as const);

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

describe('localSearchApp', () => {
  it('renders fallback web results without map or local context controls', () => {
    const markup = renderToStaticMarkup(createElement(LocalSearchApp, createProps({
      query: 'brunch',
      count: 2,
      pageSize: 2,
      returnedCount: 1,
      offset: 0,
      items: [],
      webFallbackItems: [
        {
          title: 'Brunch Guide',
          url: 'https://example.com/brunch',
          description: 'Best brunch spots',
          domain: 'example.com',
        },
      ],
      fallbackToWeb: true,
    })));

    expect(markup).toContain('Brunch Guide');
    expect(markup).toContain('example.com');
    expect(markup).not.toContain('No location data available');
    expect(markup).not.toContain('aria-label="Pagination"');
    expect(markup).not.toContain('Add All');
  });

  it('renders a dedicated empty state when fallback web search also has no results', () => {
    const markup = renderToStaticMarkup(createElement(LocalSearchApp, createProps({
      query: 'late night food',
      count: 3,
      pageSize: 3,
      returnedCount: 0,
      offset: 0,
      items: [],
      webFallbackItems: [],
      fallbackToWeb: true,
    })));

    expect(markup).toContain('No fallback results');
    expect(markup).toContain('No local results were found, and the fallback web search also returned no results.');
    expect(markup).not.toContain('No places found');
    expect(markup).not.toContain('No location data available');
  });

  it('keeps pagination visible for an exhausted later local page', () => {
    const markup = renderToStaticMarkup(createElement(LocalSearchApp, {
      ...createProps({
        query: 'coffee seattle',
        count: 2,
        pageSize: 2,
        returnedCount: 0,
        offset: 1,
        items: [],
      }),
      onLoadPage: vi.fn(async () => {}),
    }));

    expect(markup).toContain('No places found');
    expect(markup).toContain('aria-label="Pagination"');
    expect(markup).toContain('Page 2');
    expect(markup).not.toContain('No fallback results');
  });
});
