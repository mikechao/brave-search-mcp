import type { BraveSearch } from 'brave-search';
import { describe, expect, it, vi } from 'vitest';
import { TOOL_NAMES } from '../../src/tool-catalog.js';
import { BraveNewsSearchTool } from '../../src/tools/BraveNewsSearchTool.js';
import { createMockBraveSearch } from '../mocks/index.js';
import { getFirstTextContent, getMetaStructuredContent } from './tool-result-helpers.js';

interface NewsStructuredContent {
  query: string;
  count: number;
  pageSize?: number;
  returnedCount?: number;
  offset?: number;
  moreResultsAvailable?: boolean;
  items: Array<{
    title: string;
    url: string;
    description: string;
    source: string;
    age: string;
    pageAge?: string;
    breaking: boolean;
    thumbnail?: { src: string; height?: number; width?: number };
    favicon?: string;
  }>;
  error?: string;
}

function createLogStub() {
  return vi.fn();
}

describe('braveNewsSearchTool', () => {
  it('forwards options, sorts by pageAge, and formats non-UI text', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const tool = new BraveNewsSearchTool(log, mockBraveSearch as unknown as BraveSearch, false);

    mockBraveSearch.newsSearch.mockResolvedValue({
      type: 'news',
      query: { original: 'ai' },
      results: [
        {
          type: 'news_result',
          title: 'Older story',
          url: 'https://example.com/old',
          description: 'old',
          age: '2 days ago',
          page_age: '2026-01-01T10:00:00Z',
          meta_url: {
            netloc: 'old.example.com',
            hostname: 'old.example.com',
          },
        },
        {
          type: 'news_result',
          title: 'Newest story',
          url: 'https://example.com/new',
          description: 'new',
          age: '1 hour ago',
          page_age: '2026-01-02T10:00:00Z',
          meta_url: {
            netloc: 'new.example.com',
            hostname: 'new.example.com',
          },
        },
      ],
    } as unknown as Awaited<ReturnType<BraveSearch['newsSearch']>>);

    const result = await tool.executeCore({
      query: 'ai',
      count: 4,
      offset: 2,
      freshness: 'pw',
    });

    expect(mockBraveSearch.newsSearch).toHaveBeenCalledWith('ai', {
      count: 4,
      offset: 2,
      freshness: 'pw',
    });

    const text = getFirstTextContent(result);
    expect(text).toContain('1: Title: Newest story');
    expect(text).toContain('2: Title: Older story');
    expect(text.indexOf('Newest story')).toBeLessThan(text.indexOf('Older story'));
  });

  it('returns UI content and structured metadata with sorted items', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const tool = new BraveNewsSearchTool(log, mockBraveSearch as unknown as BraveSearch, true);

    mockBraveSearch.newsSearch.mockResolvedValue({
      type: 'news',
      query: { original: 'tech', more_results_available: true },
      results: [
        {
          type: 'news_result',
          title: 'Second',
          url: 'https://example.com/second',
          description: 'second',
          age: '2h ago',
          page_age: '2026-02-01T10:00:00Z',
          breaking: true,
          meta_url: {
            netloc: 'b.example.com',
            hostname: 'b.example.com',
            favicon: 'https://b.example.com/favicon.ico',
          },
          thumbnail: {
            src: 'https://img.example.com/second.jpg',
            height: 300,
            width: 400,
          },
        },
        {
          type: 'news_result',
          title: 'First',
          url: 'https://example.com/first',
          description: 'first',
          age: '1h ago',
          page_age: '2026-02-01T11:00:00Z',
          meta_url: {
            hostname: 'a.example.com',
          },
        },
      ],
    } as unknown as Awaited<ReturnType<BraveSearch['newsSearch']>>);

    const result = await tool.executeCore({
      query: 'tech',
      count: 10,
      offset: 0,
    });

    const text = getFirstTextContent(result);
    expect(text).toContain('Found 2 news articles for "tech".');
    expect(text).toContain('You CANNOT see the article titles');
    expect(text).toContain('click the + icon');
    const structured = getMetaStructuredContent<NewsStructuredContent>(result);
    expect(structured.returnedCount).toBe(2);
    expect(structured.moreResultsAvailable).toBe(true);
    expect(structured.items[0].title).toBe('First');
    expect(structured.items[0].source).toBe('a.example.com');
    expect(structured.items[1].source).toBe('b.example.com');
  });

  it('returns no-results response and UI metadata when empty', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const tool = new BraveNewsSearchTool(log, mockBraveSearch as unknown as BraveSearch, true);

    mockBraveSearch.newsSearch.mockResolvedValue({
      type: 'news',
      query: { original: 'none', more_results_available: false },
      results: [],
    } as unknown as Awaited<ReturnType<BraveSearch['newsSearch']>>);

    const result = await tool.executeCore({ query: 'none', count: 5, offset: 1 });

    expect(getFirstTextContent(result)).toBe('No news results found for "none"');
    const structured = getMetaStructuredContent<NewsStructuredContent>(result);
    expect(structured).toEqual({
      query: 'none',
      offset: 1,
      count: 5,
      pageSize: 5,
      returnedCount: 0,
      moreResultsAvailable: false,
      items: [],
    });
    expect(log).toHaveBeenCalledWith(
      'No news results found for "none"',
    );
  });

  it('returns structured error payload in UI mode when execute catches', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const tool = new BraveNewsSearchTool(log, mockBraveSearch as unknown as BraveSearch, true);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockBraveSearch.newsSearch.mockRejectedValue(new Error('upstream failure'));
    const result = await tool.execute({ query: 'boom', count: 3 });

    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: `Error in ${TOOL_NAMES.news}: upstream failure` }],
      _meta: {
        structuredContent: {
          query: 'boom',
          count: 3,
          pageSize: 3,
          returnedCount: 0,
          moreResultsAvailable: false,
          items: [],
          error: 'upstream failure',
        },
      },
    });
  });

  it('handles invalid pageAge by treating it as missing (pushes to end)', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const tool = new BraveNewsSearchTool(log, mockBraveSearch as unknown as BraveSearch, false);

    mockBraveSearch.newsSearch.mockResolvedValue({
      type: 'news',
      query: { original: 'test' },
      results: [
        {
          type: 'news_result',
          title: 'Valid middle date',
          url: 'https://example.com/middle',
          description: 'middle',
          age: '2 days ago',
          page_age: '2026-01-15T10:00:00Z',
          meta_url: { netloc: 'middle.example.com' },
        },
        {
          type: 'news_result',
          title: 'Invalid date',
          url: 'https://example.com/invalid',
          description: 'invalid',
          age: 'unknown',
          page_age: 'not-a-valid-date',
          meta_url: { netloc: 'invalid.example.com' },
        },
        {
          type: 'news_result',
          title: 'Valid recent date',
          url: 'https://example.com/recent',
          description: 'recent',
          age: '1 hour ago',
          page_age: '2026-01-20T10:00:00Z',
          meta_url: { netloc: 'recent.example.com' },
        },
        {
          type: 'news_result',
          title: 'Empty pageAge',
          url: 'https://example.com/empty',
          description: 'empty',
          age: 'unknown',
          page_age: '',
          meta_url: { netloc: 'empty.example.com' },
        },
        {
          type: 'news_result',
          title: 'Valid old date',
          url: 'https://example.com/old',
          description: 'old',
          age: '1 week ago',
          page_age: '2026-01-10T10:00:00Z',
          meta_url: { netloc: 'old.example.com' },
        },
      ],
    } as unknown as Awaited<ReturnType<BraveSearch['newsSearch']>>);

    const result = await tool.executeCore({ query: 'test', count: 10, offset: 0 });
    const text = getFirstTextContent(result);

    // Verify ordering: recent > middle > old > (invalid and empty at end)
    const recentIdx = text.indexOf('Valid recent date');
    const middleIdx = text.indexOf('Valid middle date');
    const oldIdx = text.indexOf('Valid old date');
    const invalidIdx = text.indexOf('Invalid date');
    const emptyIdx = text.indexOf('Empty pageAge');

    // Valid dates should be ordered correctly (recent first)
    expect(recentIdx).toBeLessThan(middleIdx);
    expect(middleIdx).toBeLessThan(oldIdx);

    // Invalid and empty pageAge should come after all valid dates
    expect(oldIdx).toBeLessThan(invalidIdx);
    expect(oldIdx).toBeLessThan(emptyIdx);
  });
});
