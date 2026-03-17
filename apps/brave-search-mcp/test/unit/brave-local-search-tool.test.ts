import type { BraveSearch } from 'brave-search';
import { SafeSearchLevel } from 'brave-search';
import { describe, expect, it, vi } from 'vitest';
import { TOOL_NAMES } from '../../src/tool-catalog.js';
import { BraveLocalSearchTool, formatPoiResults } from '../../src/tools/BraveLocalSearchTool.js';
import { createMockBraveSearch } from '../mocks/index.js';
import { getFirstTextContent, getMetaStructuredContent } from './tool-result-helpers.js';

interface LocalStructuredContent {
  query: string;
  count: number;
  pageSize?: number;
  returnedCount?: number;
  offset?: number;
  items: Array<{
    id?: string;
    name: string;
    address: string;
    coordinates?: [number, number];
    phone?: string;
    email?: string;
    priceRange?: string;
    rating?: number;
    reviewCount?: number;
    cuisine?: string[];
    todayHours?: string;
    weeklyHours?: string;
    description?: string;
  }>;
  webFallbackItems?: Array<{
    title: string;
    url: string;
    description: string;
    domain: string;
    favicon?: string;
    age?: string;
    thumbnail?: { src: string; height?: number; width?: number };
  }>;
  fallbackToWeb?: boolean;
  error?: string;
}

function createLogStub() {
  return vi.fn();
}

function createWebFallbackStub() {
  return vi.fn();
}

describe('braveLocalSearchTool', () => {
  it('falls back to web search when no locations are returned (non-UI)', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
      false,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'pizza near me' },
      locations: { results: [] },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    const fallbackResult = { content: [{ type: 'text' as const, text: 'web fallback result' }] };
    executeWebFallback.mockResolvedValue(fallbackResult);

    const result = await tool.executeCore({
      query: 'pizza near me',
      count: 4,
      offset: 0,
    });

    expect(mockBraveSearch.webSearch).toHaveBeenCalledWith('pizza near me', {
      count: 4,
      offset: 0,
      safesearch: SafeSearchLevel.Strict,
      result_filter: 'locations',
    });
    expect(executeWebFallback).toHaveBeenCalledWith({
      query: 'pizza near me',
      count: 4,
      offset: 0,
    });
    expect(result).toBe(fallbackResult);
    expect(log).toHaveBeenCalledWith(
      'No location results found for "pizza near me" falling back to web search. Make sure your API Plan is at least "Pro"',
    );
  });

  it('adds fallbackToWeb structured content in UI mode', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
      true,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'brunch' },
      locations: { results: [] },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    executeWebFallback.mockResolvedValue({
      content: [{ type: 'text' as const, text: 'fallback content' }],
      _meta: {
        structuredContent: {
          query: 'brunch',
          count: 2,
          pageSize: 2,
          returnedCount: 1,
          offset: 0,
          items: [
            {
              title: 'Brunch Guide',
              url: 'https://example.com/brunch',
              description: 'Best brunch spots',
              domain: 'example.com',
              favicon: 'https://example.com/favicon.ico',
            },
          ],
        },
      },
    });

    const result = await tool.executeCore({
      query: 'brunch',
      count: 2,
      offset: 0,
    });

    expect(getFirstTextContent(result)).toBe('fallback content');
    const structured = getMetaStructuredContent<LocalStructuredContent>(result);
    expect(structured).toEqual({
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
          favicon: 'https://example.com/favicon.ico',
        },
      ],
      fallbackToWeb: true,
    });
  });

  it('preserves empty fallback web payloads in UI mode', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
      true,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'late night food' },
      locations: { results: [] },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    executeWebFallback.mockResolvedValue({
      content: [{ type: 'text' as const, text: 'No results found for "late night food"' }],
      _meta: {
        structuredContent: {
          query: 'late night food',
          count: 3,
          pageSize: 3,
          returnedCount: 0,
          offset: 0,
          items: [],
        },
      },
    });

    const result = await tool.executeCore({
      query: 'late night food',
      count: 3,
      offset: 0,
    });

    expect(getFirstTextContent(result)).toBe('No results found for "late night food"');
    const structured = getMetaStructuredContent<LocalStructuredContent>(result);
    expect(structured).toEqual({
      query: 'late night food',
      count: 3,
      pageSize: 3,
      returnedCount: 0,
      offset: 0,
      items: [],
      webFallbackItems: [],
      fallbackToWeb: true,
    });
  });

  it('degrades gracefully when fallback web metadata is malformed', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
      true,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'dim sum' },
      locations: { results: [] },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    executeWebFallback.mockResolvedValue({
      content: [{ type: 'text' as const, text: 'fallback content' }],
      _meta: {
        structuredContent: {
          unexpected: true,
        },
      },
    });

    const result = await tool.executeCore({
      query: 'dim sum',
      count: 5,
      offset: 0,
    });

    expect(getFirstTextContent(result)).toBe('fallback content');
    const structured = getMetaStructuredContent<LocalStructuredContent>(result);
    expect(structured).toEqual({
      query: 'dim sum',
      count: 5,
      pageSize: 5,
      returnedCount: 0,
      offset: 0,
      items: [],
      webFallbackItems: [],
      fallbackToWeb: true,
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Invalid web fallback structured content for "dim sum"'),
      'warning',
    );
  });

  it('paginates location IDs, injects missing ids, and returns structured UI local items', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
      true,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'coffee seattle' },
      locations: {
        results: [{ id: 'loc-2' }],
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

    expect(mockBraveSearch.webSearch).toHaveBeenCalledWith('coffee seattle', {
      count: 1,
      offset: 1,
      safesearch: SafeSearchLevel.Strict,
      result_filter: 'locations',
    });
    expect(mockBraveSearch.localPoiSearch).toHaveBeenCalledWith(['loc-2']);
    expect(mockBraveSearch.localDescriptionsSearch).toHaveBeenCalledWith(['loc-2']);
    const text = getFirstTextContent(result);
    expect(text).toContain('Found 1 local places for "coffee seattle".');
    expect(text).toContain('You CANNOT see the business names');
    const structured = getMetaStructuredContent<LocalStructuredContent>(result);
    expect(structured.items[0]).toEqual({
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
    expect(log).toHaveBeenCalledWith(
      'Using 1 location IDs for "coffee seattle" (offset: 1)',
      'debug',
    );
  });

  it('does not paginate location ids twice when loading page 2', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
      true,
    );

    mockBraveSearch.webSearch.mockImplementation(async (_query: string, options?: { offset?: number }) => ({
      type: 'search',
      query: { original: 'coffee seattle' },
      locations: {
        results: options?.offset === 1
          ? [{ id: 'loc-3' }, { id: 'loc-4' }]
          : [{ id: 'loc-1' }, { id: 'loc-2' }, { id: 'loc-3' }, { id: 'loc-4' }],
      },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>));

    mockBraveSearch.localPoiSearch.mockImplementation(async (ids: string[]) => ({
      type: 'local_pois',
      results: ids.map((id) => {
        if (id === 'loc-3') {
          return {
            type: 'location_result',
            title: 'Cafe Three',
            url: 'https://example.com/cafe-three',
            description: 'Cafe',
            family_friendly: true,
            provider_url: 'https://maps.example.com/cafe-three',
            postal_address: { displayAddress: '300 Pine St, Seattle, WA' },
            coordinates: [47.612, -122.338],
            contact: { telephone: '555-333-0000', email: 'three@cafe.example' },
            price_range: '$$',
            rating: { ratingValue: 4.6, reviewCount: 130 },
            serves_cuisine: ['Coffee', 'Pastries'],
            opening_hours: {
              current_day: [{ opens: '07:00', closes: '16:00', full_name: 'Monday', abbr_name: 'Mon' }],
              days: [[{ opens: '07:00', closes: '16:00', full_name: 'Monday', abbr_name: 'Mon' }]],
            },
          };
        }

        return {
          type: 'location_result',
          title: 'Cafe Four',
          url: 'https://example.com/cafe-four',
          description: 'Cafe',
          family_friendly: true,
          provider_url: 'https://maps.example.com/cafe-four',
          postal_address: { displayAddress: '400 Pine St, Seattle, WA' },
          coordinates: [47.613, -122.339],
          contact: { telephone: '555-444-0000', email: 'four@cafe.example' },
          price_range: '$$$',
          rating: { ratingValue: 4.9, reviewCount: 90 },
          serves_cuisine: ['Coffee', 'Brunch'],
          opening_hours: {
            current_day: [{ opens: '08:00', closes: '17:00', full_name: 'Monday', abbr_name: 'Mon' }],
            days: [[{ opens: '08:00', closes: '17:00', full_name: 'Monday', abbr_name: 'Mon' }]],
          },
        };
      }),
    } as unknown as Awaited<ReturnType<BraveSearch['localPoiSearch']>>));

    mockBraveSearch.localDescriptionsSearch.mockImplementation(async (ids: string[]) => ({
      type: 'local_descriptions',
      results: ids.map(id => ({
        type: 'local_description',
        id,
        description: id === 'loc-3' ? 'Known for espresso drinks.' : 'Known for brunch specials.',
      })),
    } as unknown as Awaited<ReturnType<BraveSearch['localDescriptionsSearch']>>));

    const result = await tool.executeCore({
      query: 'coffee seattle',
      count: 2,
      offset: 1,
    });

    expect(mockBraveSearch.webSearch).toHaveBeenCalledWith('coffee seattle', {
      count: 2,
      offset: 1,
      safesearch: SafeSearchLevel.Strict,
      result_filter: 'locations',
    });
    expect(mockBraveSearch.localPoiSearch).toHaveBeenCalledWith(['loc-3', 'loc-4']);
    expect(mockBraveSearch.localDescriptionsSearch).toHaveBeenCalledWith(['loc-3', 'loc-4']);

    const text = getFirstTextContent(result);
    expect(text).toContain('Found 2 local places for "coffee seattle".');
    expect(text).toContain('You CANNOT see the business names');

    const structured = getMetaStructuredContent<LocalStructuredContent>(result);
    expect(structured).toEqual({
      query: 'coffee seattle',
      count: 2,
      pageSize: 2,
      returnedCount: 2,
      offset: 1,
      items: [
        {
          id: 'loc-3',
          name: 'Cafe Three',
          address: '300 Pine St, Seattle, WA',
          coordinates: [47.612, -122.338],
          phone: '555-333-0000',
          email: 'three@cafe.example',
          priceRange: '$$',
          rating: 4.6,
          reviewCount: 130,
          cuisine: ['Coffee', 'Pastries'],
          todayHours: '07:00 - 16:00',
          weeklyHours: 'Mon: 07:00-16:00',
          description: 'Known for espresso drinks.',
        },
        {
          id: 'loc-4',
          name: 'Cafe Four',
          address: '400 Pine St, Seattle, WA',
          coordinates: [47.613, -122.339],
          phone: '555-444-0000',
          email: 'four@cafe.example',
          priceRange: '$$$',
          rating: 4.9,
          reviewCount: 90,
          cuisine: ['Coffee', 'Brunch'],
          todayHours: '08:00 - 17:00',
          weeklyHours: 'Mon: 08:00-17:00',
          description: 'Known for brunch specials.',
        },
      ],
    });
    expect(log).toHaveBeenCalledWith(
      'Using 2 location IDs for "coffee seattle" (offset: 1)',
      'debug',
    );
  });

  it('returns an empty local page instead of web fallback when a later page has no location ids', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
      true,
    );

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'coffee seattle' },
      locations: { results: [] },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

    const result = await tool.executeCore({
      query: 'coffee seattle',
      count: 2,
      offset: 1,
    });

    expect(mockBraveSearch.webSearch).toHaveBeenCalledWith('coffee seattle', {
      count: 2,
      offset: 1,
      safesearch: SafeSearchLevel.Strict,
      result_filter: 'locations',
    });
    expect(executeWebFallback).not.toHaveBeenCalled();
    expect(mockBraveSearch.localPoiSearch).not.toHaveBeenCalled();
    expect(mockBraveSearch.localDescriptionsSearch).not.toHaveBeenCalled();
    expect(getFirstTextContent(result)).toBe('No local results found for "coffee seattle"');
    const structured = getMetaStructuredContent<LocalStructuredContent>(result);
    expect(structured).toEqual({
      query: 'coffee seattle',
      count: 2,
      pageSize: 2,
      returnedCount: 0,
      offset: 1,
      items: [],
    });
  });

  it('handles local description lookup failures and still returns POI text', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
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

    const text = getFirstTextContent(result);
    expect(text).toContain('1: Name: City Library');
    expect(text).toContain('Description: No description found');
    expect(log).toHaveBeenCalledWith(
      'Error: descriptions unavailable',
      'error',
    );
  });

  it('returns no-local-results state when POI payload is empty', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
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

    expect(getFirstTextContent(result)).toBe('No local results found for "museum"');
    const structured = getMetaStructuredContent<LocalStructuredContent>(result);
    expect(structured).toEqual({
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
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
      true,
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockBraveSearch.webSearch.mockRejectedValue(new Error('local upstream failed'));
    const result = await tool.execute({ query: 'failure', count: 2, offset: 4 });

    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: `Error in ${TOOL_NAMES.local}: local upstream failed` }],
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

  it(`returns a ${TOOL_NAMES.local} error when the web fallback throws`, async () => {
    const mockBraveSearch = createMockBraveSearch();
    const log = createLogStub();
    const executeWebFallback = createWebFallbackStub();
    const tool = new BraveLocalSearchTool(
      log,
      mockBraveSearch as unknown as BraveSearch,
      executeWebFallback,
      true,
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockBraveSearch.webSearch.mockResolvedValue({
      type: 'search',
      query: { original: 'pizza near me' },
      locations: { results: [] },
    } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);
    executeWebFallback.mockRejectedValue(new Error('web fallback failed'));

    const result = await tool.execute({ query: 'pizza near me', count: 3, offset: 0 });

    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: `Error in ${TOOL_NAMES.local}: web fallback failed` }],
      _meta: {
        structuredContent: {
          query: 'pizza near me',
          count: 3,
          pageSize: 3,
          returnedCount: 0,
          offset: 0,
          items: [],
          error: 'web fallback failed',
        },
      },
    });

    consoleSpy.mockRestore();
  });
});

describe('formatPoiResults', () => {
  it('formats POI results with matched descriptions and fallback fields', () => {
    const poiData = {
      type: 'local_pois',
      results: [
        {
          type: 'location_result',
          id: 'poi-1',
          title: 'Sunrise Cafe',
          url: 'https://example.com/sunrise-cafe',
          description: 'Cafe details',
          family_friendly: true,
          provider_url: 'https://maps.example.com/sunrise-cafe',
          coordinates: [37.7749, -122.4194],
          zoom_level: 12,
          postal_address: {
            type: 'PostalAddress',
            country: 'US',
            postalCode: '94103',
            streetAddress: '123 Market St',
            addressRegion: 'CA',
            addressLocality: 'San Francisco',
            displayAddress: '123 Market St, San Francisco, CA 94103',
          },
          contact: {
            telephone: '555-123-4567',
            email: 'hello@sunrise.example',
          },
          price_range: '$$',
          rating: {
            ratingValue: 4.7,
            bestRating: 5,
            reviewCount: 128,
          },
          serves_cuisine: ['Cafe', 'Bakery'],
          opening_hours: {
            current_day: [
              {
                abbr_name: 'Mon',
                full_name: 'Monday',
                opens: '08:00',
                closes: '17:00',
              },
            ],
            days: [
              [
                {
                  abbr_name: 'Mon',
                  full_name: 'Monday',
                  opens: '08:00',
                  closes: '17:00',
                },
              ],
            ],
          },
        },
        {
          type: 'location_result',
          id: 'poi-2',
          title: 'Mystery Spot',
          url: 'https://example.com/mystery-spot',
          description: 'No metadata',
          family_friendly: true,
          provider_url: 'https://maps.example.com/mystery-spot',
          postal_address: {
            type: 'PostalAddress',
            country: 'US',
            postalCode: '10001',
            streetAddress: '456 Unknown Rd',
            addressRegion: 'NY',
            addressLocality: 'New York',
            displayAddress: '456 Unknown Rd, New York, NY 10001',
          },
        },
      ],
    } as Parameters<typeof formatPoiResults>[0];

    const poiDescriptions = {
      type: 'local_descriptions',
      results: [
        {
          type: 'local_description',
          id: 'poi-1',
          description: 'Known for fresh pastries and coffee.',
        },
      ],
    } as Parameters<typeof formatPoiResults>[1];

    const formatted = formatPoiResults(poiData, poiDescriptions);

    expect(formatted).toHaveLength(2);

    expect(formatted[0]).toContain('Name: Sunrise Cafe');
    expect(formatted[0]).toContain('Cuisine: Cafe, Bakery');
    expect(formatted[0]).toContain('Address: 123 Market St, San Francisco, CA 94103');
    expect(formatted[0]).toContain('Coordinates: 37.7749, -122.4194');
    expect(formatted[0]).toContain('Phone: 555-123-4567');
    expect(formatted[0]).toContain('Email: hello@sunrise.example');
    expect(formatted[0]).toContain('Price Range: $$');
    expect(formatted[0]).toContain('Ratings: 4.7 (128) reviews');
    expect(formatted[0]).toContain('Today: Monday 08:00 - 17:00');
    expect(formatted[0]).toContain('Description: Known for fresh pastries and coffee.');

    expect(formatted[1]).toContain('Name: Mystery Spot');
    expect(formatted[1]).not.toContain('Coordinates:');
    expect(formatted[1]).toContain('Phone: No phone number found');
    expect(formatted[1]).toContain('Email: No email found');
    expect(formatted[1]).toContain('Price Range: No price range found');
    expect(formatted[1]).toContain('Hours:\n No opening hours found');
    expect(formatted[1]).toContain('Description: No description found');
  });

  it('formats opening hours correctly with multiple time slots per day', () => {
    const poiData = {
      type: 'local_pois',
      results: [
        {
          type: 'location_result',
          id: 'poi-multi-slots',
          title: 'Lunch Bistro',
          postal_address: {
            type: 'PostalAddress',
            displayAddress: '123 Main St',
          },
          opening_hours: {
            current_day: [
              {
                abbr_name: 'Mon',
                full_name: 'Monday',
                opens: '09:00',
                closes: '12:00',
              },
              {
                abbr_name: 'Mon',
                full_name: 'Monday',
                opens: '13:00',
                closes: '17:00',
              },
            ],
            days: [
              [
                {
                  abbr_name: 'Mon',
                  full_name: 'Monday',
                  opens: '09:00',
                  closes: '12:00',
                },
                {
                  abbr_name: 'Mon',
                  full_name: 'Monday',
                  opens: '13:00',
                  closes: '17:00',
                },
              ],
              [
                {
                  abbr_name: 'Tue',
                  full_name: 'Tuesday',
                  opens: '10:00',
                  closes: '14:00',
                },
              ],
            ],
          },
        },
      ],
    } as Parameters<typeof formatPoiResults>[0];

    const poiDescriptions = {
      type: 'local_descriptions',
      results: [],
    } as Parameters<typeof formatPoiResults>[1];

    const formatted = formatPoiResults(poiData, poiDescriptions);

    expect(formatted).toHaveLength(1);
    const hoursText = formatted[0];

    // Before the fix, the Today section contains array coercion artifacts:
    // "Today: Monday 09:00 - 12:00\n,Monday 13:00 - 17:00"
    // After the fix, clean inline format:
    // "Today: Monday 09:00 - 12:00, Monday 13:00 - 17:00"
    expect(hoursText).not.toContain('Monday 09:00 - 12:00\n,Monday 13:00 - 17:00');
    expect(hoursText).toContain('Today: Monday 09:00 - 12:00, Monday 13:00 - 17:00');

    // Weekly section should have one line per day with proper spacing
    // The template returns \nWeekly:\n followed by lines joined with \n
    expect(hoursText).toContain('Weekly:\nMonday 09:00 - 12:00, Monday 13:00 - 17:00\nTuesday 10:00 - 14:00');
    // No missing spaces after commas in multi-slot days
    expect(hoursText).not.toContain('Monday 09:00 - 12:00,Monday 13:00');
  });
});

describe('formatPoiResults edge cases', () => {
  it('handles missing postal_address gracefully', () => {
    const poiData = {
      type: 'local_pois',
      results: [{
        type: 'location_result',
        id: 'poi-no-address',
        title: 'No Address Place',
        // postal_address is intentionally missing
      }],
    } as Parameters<typeof formatPoiResults>[0];

    const poiDescriptions = {
      type: 'local_descriptions',
      results: [],
    } as Parameters<typeof formatPoiResults>[1];

    // Should not crash
    const formatted = formatPoiResults(poiData, poiDescriptions);
    expect(formatted).toHaveLength(1);
    expect(formatted[0]).toContain('Address: No address found');
  });

  it('displays 0-star ratings correctly', () => {
    const poiData = {
      type: 'local_pois',
      results: [{
        type: 'location_result',
        id: 'poi-zero-rating',
        title: 'Zero Star Place',
        postal_address: { displayAddress: '123 Main St' },
        rating: { ratingValue: 0, reviewCount: 5 },
      }],
    } as Parameters<typeof formatPoiResults>[0];

    const poiDescriptions = {
      type: 'local_descriptions',
      results: [],
    } as Parameters<typeof formatPoiResults>[1];

    const formatted = formatPoiResults(poiData, poiDescriptions);
    expect(formatted[0]).toContain('Ratings: 0 (5) reviews');
    expect(formatted[0]).not.toContain('N/A');
  });

  it('handles undefined reviewCount gracefully', () => {
    const poiData = {
      type: 'local_pois',
      results: [{
        type: 'location_result',
        id: 'poi-no-reviews',
        title: 'No Reviews Place',
        postal_address: { displayAddress: '123 Main St' },
        rating: { ratingValue: 4.5 }, // reviewCount is missing
      }],
    } as Parameters<typeof formatPoiResults>[0];

    const poiDescriptions = {
      type: 'local_descriptions',
      results: [],
    } as Parameters<typeof formatPoiResults>[1];

    const formatted = formatPoiResults(poiData, poiDescriptions);
    expect(formatted[0]).toContain('Ratings: 4.5 (0) reviews');
    expect(formatted[0]).not.toContain('undefined');
  });
});
