import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../../src/server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { describe, expect, it, vi } from 'vitest';
import { BraveImageSearchTool } from '../../src/tools/BraveImageSearchTool.js';
import { createMockBraveSearch } from '../mocks/index.js';
import { getFirstTextContent } from './tool-result-helpers.js';

function createServerStub() {
  return {
    log: vi.fn(),
  } as unknown as BraveMcpServer;
}

describe('braveImageSearchTool', () => {
  it('calls brave image search with strict safe search and formats text output for non-UI', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveImageSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      false,
    );

    mockBraveSearch.imageSearch.mockResolvedValue({
      type: 'images',
      query: { original: 'cats' },
      results: [
        {
          type: 'image_result',
          title: 'Cat One',
          url: 'https://example.com/cat-1',
          source: 'example.com',
          page_fetched: '2026-02-01T00:00:00Z',
          thumbnail: {
            src: 'https://imgs.search.brave.com/cat-1.jpg',
            width: 640,
            height: 480,
          },
          properties: {
            url: 'https://example.com/cat-1.jpg',
            resized: 'https://example.com/cat-1-resized.jpg',
            height: 480,
            width: 640,
            format: 'jpg',
            content_size: '100KB',
          },
          meta_url: {
            scheme: 'https',
            netloc: 'example.com',
            hostname: 'example.com',
            favicon: 'https://example.com/favicon.ico',
            path: '/cat-1',
          },
          confidence: 'high',
        },
      ],
    } as unknown as Awaited<ReturnType<BraveSearch['imageSearch']>>);

    const result = await tool.executeCore({ searchTerm: 'cats', count: 5 });

    expect(mockBraveSearch.imageSearch).toHaveBeenCalledWith('cats', {
      count: 5,
      safesearch: SafeSearchLevel.Strict,
    });
    const text = getFirstTextContent(result);
    expect(text).toContain('1: Title: Cat One');
    expect(text).toContain('URL: https://example.com/cat-1');
    expect(text).toContain('Image URL: https://imgs.search.brave.com/cat-1.jpg');
    expect(text).toContain('Confidence: high');
    expect(text).toContain('Width: 640');
    expect(text).toContain('Height: 480');
    expect((server as unknown as { log: ReturnType<typeof vi.fn> }).log).toHaveBeenCalledWith(
      'Searching for images of "cats" with count 5',
      'debug',
    );
  });

  it('returns no-results text and structured content in UI mode', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveImageSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      true,
    );

    mockBraveSearch.imageSearch.mockResolvedValue({
      type: 'images',
      query: { original: 'unknown' },
      results: [],
    } as unknown as Awaited<ReturnType<BraveSearch['imageSearch']>>);

    const result = await tool.executeCore({ searchTerm: 'unknown', count: 3 });

    expect(getFirstTextContent(result)).toBe('No image results found for "unknown"');
    expect(result).toHaveProperty('structuredContent');
    expect(result.structuredContent).toEqual({
      searchTerm: 'unknown',
      count: 0,
      items: [],
    });
  });

  it('skips image results without thumbnail src and reports filtered count in UI mode', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveImageSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      true,
    );

    mockBraveSearch.imageSearch.mockResolvedValue({
      type: 'images',
      query: { original: 'landscape' },
      results: [
        {
          type: 'image_result',
          title: 'Missing Thumbnail',
          url: 'https://example.com/missing',
          source: 'example.com',
          page_fetched: '2026-02-01T00:00:00Z',
          thumbnail: {},
          properties: {
            url: 'https://example.com/missing.jpg',
            resized: 'https://example.com/missing-resized.jpg',
            height: 320,
            width: 480,
            format: 'jpg',
            content_size: '60KB',
          },
          meta_url: {
            scheme: 'https',
            netloc: 'example.com',
            hostname: 'example.com',
            favicon: 'https://example.com/favicon.ico',
            path: '/missing',
          },
        },
        {
          type: 'image_result',
          title: 'Valid Thumbnail',
          url: 'https://example.com/valid',
          source: 'example.com',
          page_fetched: '2026-02-01T00:00:00Z',
          thumbnail: {
            src: 'https://imgs.search.brave.com/valid.jpg',
            width: 800,
            height: 600,
          },
          properties: {
            url: 'https://example.com/valid.jpg',
            resized: 'https://example.com/valid-resized.jpg',
            height: 600,
            width: 800,
            format: 'jpg',
            content_size: '140KB',
          },
          meta_url: {
            scheme: 'https',
            netloc: 'example.com',
            hostname: 'example.com',
            favicon: 'https://example.com/favicon.ico',
            path: '/valid',
          },
        },
      ],
    } as unknown as Awaited<ReturnType<BraveSearch['imageSearch']>>);

    const result = await tool.executeCore({ searchTerm: 'landscape', count: 10 });

    const text = getFirstTextContent(result);
    expect(text).toContain('Found 1 image results for "landscape".');
    expect(text).toContain('CRITICAL RULES');
    expect(result.structuredContent).toEqual({
      searchTerm: 'landscape',
      count: 1,
      items: [
        {
          title: 'Valid Thumbnail',
          pageUrl: 'https://example.com/valid',
          imageUrl: 'https://imgs.search.brave.com/valid.jpg',
          source: 'example.com',
          confidence: undefined,
          width: 800,
          height: 600,
        },
      ],
    });
  });

  it('returns isError response when execute catches an error (non-UI)', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveImageSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      false,
    );
    mockBraveSearch.imageSearch.mockRejectedValue(new Error('network down'));

    const result = await tool.execute({ searchTerm: 'failure', count: 2 });

    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Error in brave_image_search: network down' }],
    });
    expect(result).not.toHaveProperty('structuredContent');
  });

  it('returns structured error response when execute catches an error in UI mode', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveImageSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      true,
    );
    mockBraveSearch.imageSearch.mockRejectedValue(new Error('timeout'));

    const result = await tool.execute({ searchTerm: 'failure', count: 2 });

    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Error in brave_image_search: timeout' }],
      structuredContent: {
        searchTerm: 'failure',
        count: 0,
        items: [],
        error: 'timeout',
      },
    });
  });
});
