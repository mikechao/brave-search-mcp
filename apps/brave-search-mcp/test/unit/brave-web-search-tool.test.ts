import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../../src/server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { describe, expect, it, vi } from 'vitest';
import { BraveWebSearchTool } from '../../src/tools/BraveWebSearchTool.js';
import { createMockBraveSearch } from '../mocks/index.js';

function createServerStub() {
  return {
    log: vi.fn(),
  } as unknown as BraveMcpServer;
}

describe('braveWebSearchTool', () => {
  it('forwards strict safesearch and formats non-UI results', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveWebSearchTool(server, mockBraveSearch as unknown as BraveSearch, false);

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'typescript patterns' },
      web: {
        type: 'search',
        results: [
          {
            type: 'search_result',
            subtype: 'generic',
            title: 'Result A',
            url: 'https://example.com/a',
            description: 'Alpha result',
            family_friendly: true,
            meta_url: {
              netloc: 'example.com',
              hostname: 'example.com',
              favicon: 'https://example.com/favicon.ico',
            },
          },
          {
            type: 'search_result',
            subtype: 'generic',
            title: 'Result B',
            url: 'https://example.com/b',
            description: 'Beta result',
            family_friendly: true,
            meta_url: {
              hostname: 'docs.example.com',
            },
          },
        ],
      },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    const result = await tool.executeCore({
      query: 'typescript patterns',
      count: 6,
      offset: 1,
      freshness: 'pm',
    });

    expect(mockBraveSearch.webSearch).toHaveBeenCalledWith('typescript patterns', {
      count: 6,
      offset: 1,
      safesearch: SafeSearchLevel.Strict,
      freshness: 'pm',
    });
    expect(result.content[0].text).toContain('1: Title: Result A');
    expect(result.content[0].text).toContain('2: Title: Result B');
    expect(result.content[0].text).toContain('URL: https://example.com/a');
    expect(result.content[0].text).toContain('Description: Beta result');
  });

  it('returns UI guidance text and structured metadata', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveWebSearchTool(server, mockBraveSearch as unknown as BraveSearch, true);

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'open source' },
      web: {
        type: 'search',
        results: [
          {
            type: 'search_result',
            subtype: 'generic',
            title: 'OSS Home',
            url: 'https://oss.example.com',
            description: 'Open source portal',
            family_friendly: true,
            age: '1 day ago',
            meta_url: {
              netloc: 'oss.example.com',
              favicon: 'https://oss.example.com/favicon.ico',
            },
            thumbnail: {
              src: 'https://oss.example.com/thumb.jpg',
              width: 120,
              height: 80,
            },
          },
        ],
      },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    const result = await tool.executeCore({ query: 'open source', count: 10, offset: 0 });

    expect(result.content[0].text).toContain('Found 1 web results for "open source".');
    expect(result.content[0].text).toContain('You CANNOT see the result titles');
    expect(result.content[0].text).toContain('click the + icon');
    expect(result._meta?.structuredContent).toEqual({
      query: 'open source',
      offset: 0,
      count: 10,
      pageSize: 10,
      returnedCount: 1,
      items: [
        {
          title: 'OSS Home',
          url: 'https://oss.example.com',
          description: 'Open source portal',
          domain: 'oss.example.com',
          favicon: 'https://oss.example.com/favicon.ico',
          age: '1 day ago',
          thumbnail: {
            src: 'https://oss.example.com/thumb.jpg',
            height: 80,
            width: 120,
          },
        },
      ],
    });
  });

  it('returns no-results response and logs in UI mode', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveWebSearchTool(server, mockBraveSearch as unknown as BraveSearch, true);

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'none' },
      web: {
        type: 'search',
        results: [],
      },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    const result = await tool.executeCore({ query: 'none', count: 5, offset: 2 });

    expect(result.content[0].text).toBe('No results found for "none"');
    expect(result._meta?.structuredContent).toEqual({
      query: 'none',
      offset: 2,
      count: 5,
      pageSize: 5,
      returnedCount: 0,
      items: [],
    });
    expect((server as unknown as { log: ReturnType<typeof vi.fn> }).log).toHaveBeenCalledWith(
      'No results found for "none"',
      'info',
    );
  });

  it('returns structured error payload in UI mode when execute catches', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveWebSearchTool(server, mockBraveSearch as unknown as BraveSearch, true);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockBraveSearch.webSearch.mockRejectedValue(new Error('web upstream failed'));
    const result = await tool.execute({ query: 'failure', count: 3 });

    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Error in brave_web_search: web upstream failed' }],
      _meta: {
        structuredContent: {
          query: 'failure',
          count: 3,
          pageSize: 3,
          returnedCount: 0,
          items: [],
          error: 'web upstream failed',
        },
      },
    });
  });
});
