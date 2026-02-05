import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../../src/server.js';
import { describe, expect, it, vi } from 'vitest';
import { BraveNewsSearchTool } from '../../src/tools/BraveNewsSearchTool.js';
import { createMockBraveSearch } from '../mocks/index.js';

function createServerStub() {
  return {
    log: vi.fn(),
  } as unknown as BraveMcpServer;
}

describe('braveNewsSearchTool', () => {
  it('forwards options, sorts by pageAge, and formats non-UI text', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveNewsSearchTool(server, mockBraveSearch as unknown as BraveSearch, false);

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

    const text = result.content[0].text;
    expect(text).toContain('1: Title: Newest story');
    expect(text).toContain('2: Title: Older story');
    expect(text.indexOf('Newest story')).toBeLessThan(text.indexOf('Older story'));
  });

  it('returns UI content and structured metadata with sorted items', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveNewsSearchTool(server, mockBraveSearch as unknown as BraveSearch, true);

    mockBraveSearch.newsSearch.mockResolvedValue({
      type: 'news',
      query: { original: 'tech' },
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

    expect(result.content[0].text).toContain('Found 2 news articles for "tech".');
    expect(result.content[0].text).toContain('You CANNOT see the article titles');
    expect(result.content[0].text).toContain('click the + icon');
    expect(result._meta?.structuredContent.returnedCount).toBe(2);
    expect(result._meta?.structuredContent.items[0].title).toBe('First');
    expect(result._meta?.structuredContent.items[0].source).toBe('a.example.com');
    expect(result._meta?.structuredContent.items[1].source).toBe('b.example.com');
  });

  it('returns no-results response and UI metadata when empty', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveNewsSearchTool(server, mockBraveSearch as unknown as BraveSearch, true);

    mockBraveSearch.newsSearch.mockResolvedValue({
      type: 'news',
      query: { original: 'none' },
      results: [],
    } as unknown as Awaited<ReturnType<BraveSearch['newsSearch']>>);

    const result = await tool.executeCore({ query: 'none', count: 5, offset: 1 });

    expect(result.content[0].text).toBe('No news results found for "none"');
    expect(result._meta?.structuredContent).toEqual({
      query: 'none',
      offset: 1,
      count: 5,
      pageSize: 5,
      returnedCount: 0,
      items: [],
    });
    expect((server as unknown as { log: ReturnType<typeof vi.fn> }).log).toHaveBeenCalledWith(
      'No news results found for "none"',
    );
  });

  it('returns structured error payload in UI mode when execute catches', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveNewsSearchTool(server, mockBraveSearch as unknown as BraveSearch, true);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockBraveSearch.newsSearch.mockRejectedValue(new Error('upstream failure'));
    const result = await tool.execute({ query: 'boom', count: 3 });

    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Error in brave_news_search: upstream failure' }],
      _meta: {
        structuredContent: {
          query: 'boom',
          count: 3,
          pageSize: 3,
          returnedCount: 0,
          items: [],
          error: 'upstream failure',
        },
      },
    });
  });
});
