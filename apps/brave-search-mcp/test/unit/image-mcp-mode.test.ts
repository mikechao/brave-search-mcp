import type { ImageSearchAppProps } from '../../ui/src/lib/image/ImageSearchApp.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => {
  return {
    capturedProps: null as ImageSearchAppProps | null,
    useMcpAppReturn: {
      app: {},
      error: null,
      toolInputs: { query: 'northern lights' },
      toolInputsPartial: null,
      toolResult: {
        _meta: {
          structuredContent: {
            query: 'northern lights',
            count: 1,
            items: [
              {
                title: 'Aurora',
                pageUrl: 'https://example.com/aurora',
                imageUrl: 'https://imgs.search.brave.com/aurora.jpg',
                source: 'example.com',
              },
            ],
          },
        },
      },
      hostContext: null,
      callServerTool: vi.fn(),
      sendMessage: vi.fn(),
      openLink: vi.fn(async () => ({ isError: false })),
      sendLog: vi.fn(async () => {}),
      requestDisplayMode: vi.fn(async () => 'inline'),
    },
  };
});

vi.mock('../../ui/src/hooks/useMcpApp.js', () => {
  return {
    useMcpApp: vi.fn(() => mockState.useMcpAppReturn),
  };
});

vi.mock('../../ui/src/lib/image/ImageSearchApp.js', () => {
  return {
    default: (props: ImageSearchAppProps) => {
      mockState.capturedProps = props;
      return null;
    },
  };
});

async function importImageMcpMode() {
  const module = await import('../../ui/src/lib/image/image-mcp-mode.js');
  return module.default;
}

describe('imageMcpMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockState.capturedProps = null;
    mockState.useMcpAppReturn = {
      ...mockState.useMcpAppReturn,
      app: {},
      error: null,
      toolInputs: { query: 'northern lights' },
      toolInputsPartial: null,
      toolResult: {
        _meta: {
          structuredContent: {
            query: 'northern lights',
            count: 1,
            items: [
              {
                title: 'Aurora',
                pageUrl: 'https://example.com/aurora',
                imageUrl: 'https://imgs.search.brave.com/aurora.jpg',
                source: 'example.com',
              },
            ],
          },
        },
      },
      hostContext: null,
    };
  });

  it('passes loadingQuery from toolInputs.query to ImageSearchApp', async () => {
    const ImageMcpMode = await importImageMcpMode();

    renderToStaticMarkup(createElement(ImageMcpMode));

    expect(mockState.capturedProps).toBeTruthy();
    expect(mockState.capturedProps?.loadingQuery).toBe('northern lights');
    expect(mockState.capturedProps?.isInitialLoading).toBe(false);
  });
});
