import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../../src/server.js';
import type { BraveWebSearchTool } from '../../src/tools/BraveWebSearchTool.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { describe, expect, it, vi } from 'vitest';
import { BraveLocalSearchTool } from '../../src/tools/BraveLocalSearchTool.js';
import { createMockBraveSearch } from '../mocks/index.js';

function createServerStub() {
  return {
    log: vi.fn(),
  } as unknown as BraveMcpServer;
}

function createWebSearchToolStub() {
  return {
    executeCore: vi.fn(),
  } as unknown as BraveWebSearchTool;
}

describe('braveLocalSearchTool', () => {
  it('falls back to web search when no locations are returned (non-UI)', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const webSearchTool = createWebSearchToolStub();
    const tool = new BraveLocalSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      webSearchTool,
      false,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'pizza near me' },
      locations: { results: [] },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    const fallbackResult = { content: [{ type: 'text' as const, text: 'web fallback result' }] };
    (webSearchTool as unknown as { executeCore: ReturnType<typeof vi.fn> }).executeCore.mockResolvedValue(fallbackResult);

    const result = await tool.executeCore({
      query: 'pizza near me',
      count: 4,
      offset: 3,
    });

    expect(mockBraveSearch.webSearch).toHaveBeenCalledWith('pizza near me', {
      count: 4,
      offset: 3,
      safesearch: SafeSearchLevel.Strict,
      result_filter: 'locations',
    });
    expect((webSearchTool as unknown as { executeCore: ReturnType<typeof vi.fn> }).executeCore).toHaveBeenCalledWith({
      query: 'pizza near me',
      count: 4,
      offset: 0,
    });
    expect(result).toBe(fallbackResult);
    expect((server as unknown as { log: ReturnType<typeof vi.fn> }).log).toHaveBeenCalledWith(
      'No location results found for "pizza near me" falling back to web search. Make sure your API Plan is at least "Pro"',
    );
  });

  it('adds fallbackToWeb structured content in UI mode', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const webSearchTool = createWebSearchToolStub();
    const tool = new BraveLocalSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      webSearchTool,
      true,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'brunch' },
      locations: { results: [] },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    (webSearchTool as unknown as { executeCore: ReturnType<typeof vi.fn> }).executeCore.mockResolvedValue({
      content: [{ type: 'text' as const, text: 'fallback content' }],
      _meta: {
        structuredContent: {
          query: 'brunch',
          count: 10,
          items: [],
        },
      },
    });

    const result = await tool.executeCore({
      query: 'brunch',
      count: 2,
      offset: 2,
    });

    expect(result.content[0].text).toBe('fallback content');
    expect(result._meta?.structuredContent).toEqual({
      query: 'brunch',
      count: 2,
      pageSize: 2,
      returnedCount: 0,
      offset: 2,
      items: [],
      fallbackToWeb: true,
    });
  });

  it('paginates location IDs, injects missing ids, and returns structured UI local items', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const webSearchTool = createWebSearchToolStub();
    const tool = new BraveLocalSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      webSearchTool,
      true,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'coffee seattle' },
      locations: {
        results: [{ id: 'loc-1' }, { id: 'loc-2' }, { id: 'loc-3' }],
      },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    mockBraveSearch.localPoiSearch.mockResolvedValue({
      type: 'local_pois',
      results: [
        {
          type: 'location_result',
          title: 'Cafe Prime',
          url: 'https://example.com/cafe-prime',
          description: 'Cafe',
          family_friendly: true,
          provider_url: 'https://maps.example.com/cafe-prime',
          postal_address: { displayAddress: '123 Pike St, Seattle, WA' },
          coordinates: [47.61, -122.33],
          contact: { telephone: '555-111-2222', email: 'hello@cafe.example' },
          price_range: '$$',
          rating: { ratingValue: 4.8, reviewCount: 210 },
          serves_cuisine: ['Coffee', 'Bakery'],
          opening_hours: {
            current_day: [{ opens: '08:00', closes: '17:00', full_name: 'Monday', abbr_name: 'Mon' }],
            days: [[{ opens: '08:00', closes: '17:00', full_name: 'Monday', abbr_name: 'Mon' }]],
          },
        },
      ],
    } as unknown as Awaited<ReturnType<BraveSearch['localPoiSearch']>>);

    mockBraveSearch.localDescriptionsSearch.mockResolvedValue({
      type: 'local_descriptions',
      results: [
        { type: 'local_description', id: 'loc-2', description: 'Great espresso and pastries.' },
      ],
    } as unknown as Awaited<ReturnType<BraveSearch['localDescriptionsSearch']>>);

    const result = await tool.executeCore({
      query: 'coffee seattle',
      count: 1,
      offset: 1,
    });

    expect(mockBraveSearch.localPoiSearch).toHaveBeenCalledWith(['loc-2']);
    expect(mockBraveSearch.localDescriptionsSearch).toHaveBeenCalledWith(['loc-2']);
    expect(result.content[0].text).toContain('Found 1 local places for "coffee seattle".');
    expect(result.content[0].text).toContain('You CANNOT see the business names');
    expect(result._meta?.structuredContent.items[0]).toEqual({
      id: 'loc-2',
      name: 'Cafe Prime',
      address: '123 Pike St, Seattle, WA',
      coordinates: [47.61, -122.33],
      phone: '555-111-2222',
      email: 'hello@cafe.example',
      priceRange: '$$',
      rating: 4.8,
      reviewCount: 210,
      cuisine: ['Coffee', 'Bakery'],
      todayHours: '08:00 - 17:00',
      weeklyHours: 'Mon: 08:00-17:00',
      description: 'Great espresso and pastries.',
    });
    expect((server as unknown as { log: ReturnType<typeof vi.fn> }).log).toHaveBeenCalledWith(
      'Using 1 of 3 location IDs for "coffee seattle" (offset: 1)',
      'debug',
    );
  });

  it('handles local description lookup failures and still returns POI text', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const webSearchTool = createWebSearchToolStub();
    const tool = new BraveLocalSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      webSearchTool,
      false,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'library' },
      locations: { results: [{ id: 'loc-x' }] },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    mockBraveSearch.localPoiSearch.mockResolvedValue({
      type: 'local_pois',
      results: [
        {
          type: 'location_result',
          id: 'loc-x',
          title: 'City Library',
          url: 'https://example.com/library',
          description: 'Library',
          family_friendly: true,
          provider_url: 'https://maps.example.com/library',
          postal_address: { displayAddress: '1 Main St' },
        },
      ],
    } as unknown as Awaited<ReturnType<BraveSearch['localPoiSearch']>>);

    mockBraveSearch.localDescriptionsSearch.mockRejectedValue(new Error('descriptions unavailable'));

    const result = await tool.executeCore({ query: 'library', count: 3, offset: 0 });

    expect(result.content[0].text).toContain('1: Name: City Library');
    expect(result.content[0].text).toContain('Description: No description found');
    expect((server as unknown as { log: ReturnType<typeof vi.fn> }).log).toHaveBeenCalledWith(
      'Error: descriptions unavailable',
      'error',
    );
  });

  it('returns no-local-results state when POI payload is empty', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const webSearchTool = createWebSearchToolStub();
    const tool = new BraveLocalSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      webSearchTool,
      true,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'museum' },
      locations: { results: [{ id: 'loc-m' }] },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    mockBraveSearch.localPoiSearch.mockResolvedValue({
      type: 'local_pois',
      results: [],
    } as unknown as Awaited<ReturnType<BraveSearch['localPoiSearch']>>);

    mockBraveSearch.localDescriptionsSearch.mockResolvedValue({
      type: 'local_descriptions',
      results: [],
    } as unknown as Awaited<ReturnType<BraveSearch['localDescriptionsSearch']>>);

    const result = await tool.executeCore({ query: 'museum', count: 5, offset: 1 });

    expect(result.content[0].text).toBe('No local results found for "museum"');
    expect(result._meta?.structuredContent).toEqual({
      query: 'museum',
      count: 5,
      pageSize: 5,
      returnedCount: 0,
      offset: 1,
      items: [],
    });
  });

  it('returns structured error payload in UI mode when execute catches', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const webSearchTool = createWebSearchToolStub();
    const tool = new BraveLocalSearchTool(
      server,
      mockBraveSearch as unknown as BraveSearch,
      webSearchTool,
      true,
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockBraveSearch.webSearch.mockRejectedValue(new Error('local upstream failed'));
    const result = await tool.execute({ query: 'failure', count: 2, offset: 4 });

    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Error in brave_local_search: local upstream failed' }],
      _meta: {
        structuredContent: {
          query: 'failure',
          count: 2,
          pageSize: 2,
          returnedCount: 0,
          offset: 4,
          items: [],
          error: 'local upstream failed',
        },
      },
    });
  });
});
