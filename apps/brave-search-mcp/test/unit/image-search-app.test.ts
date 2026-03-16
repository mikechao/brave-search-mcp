import type { ImageSearchAppProps } from '../../ui/src/lib/image/ImageSearchApp.js';
import type { ImageSearchData } from '../../ui/src/lib/image/types.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ImageSearchApp from '../../ui/src/lib/image/ImageSearchApp.js';

function createProps(data: ImageSearchData): ImageSearchAppProps {
  const requestDisplayMode: NonNullable<ImageSearchAppProps['requestDisplayMode']> = vi.fn(async () => 'inline' as const);

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

describe('imageSearchApp', () => {
  it('renders the query from structured content in the header', () => {
    const markup = renderToStaticMarkup(createElement(ImageSearchApp, createProps({
      query: 'northern lights',
      count: 1,
      items: [
        {
          title: 'Aurora over Iceland',
          pageUrl: 'https://example.com/aurora',
          imageUrl: 'https://imgs.search.brave.com/aurora.jpg',
          source: 'example.com',
          width: 800,
          height: 600,
        },
      ],
    })));

    expect(markup).toContain('northern lights');
    expect(markup).toContain('Aurora over Iceland');
    expect(markup).toContain('1 results');
  });
});
