import type { BraveSearch, LocalDescriptionsSearchApiResponse } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import type { BraveWebSearchTool } from './BraveWebSearchTool.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { z } from 'zod';
import { formatPoiResults } from '../utils.js';
import { BaseTool } from './BaseTool.js';

const localSearchInputSchema = z.object({
  query: z.string().describe('Local search query (e.g. \'pizza near Central Park\')'),
  count: z.number().min(1).max(20).default(10).optional().describe('The number of results to return, minimum 1, maximum 20'),
  offset: z.number().min(0).max(9).default(0).optional().describe('The zero-based offset for pagination, indicating the index of the first result to return. Maximum value is 9.'),
});

const localBusinessSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  address: z.string(),
  coordinates: z.tuple([z.number(), z.number()]).optional(), // [lat, lng]
  phone: z.string().optional(),
  email: z.string().optional(),
  priceRange: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  cuisine: z.array(z.string()).optional(),
  todayHours: z.string().optional(),
  weeklyHours: z.string().optional(),
  description: z.string().optional(),
});

export const localSearchOutputSchema = z.object({
  query: z.string(),
  count: z.number(),
  offset: z.number().optional(),
  items: z.array(localBusinessSchema),
  fallbackToWeb: z.boolean().optional(),
  error: z.string().optional(),
});

export type BraveLocalSearchStructuredContent = z.infer<typeof localSearchOutputSchema>;

export class BraveLocalSearchTool extends BaseTool<typeof localSearchInputSchema, any> {
  public readonly name = 'brave_local_search';
  public readonly description = 'Searches for local businesses and places using Brave\'s Local Search API. '
    + 'Best for queries related to physical locations, businesses, restaurants, services, etc. '
    + 'Returns detailed information including:\n'
    + '- Business names and addresses\n'
    + '- Ratings and review counts\n'
    + '- Phone numbers and opening hours\n'
    + 'Use this when the query implies \'near me\' or mentions specific locations. '
    + 'Automatically falls back to web search if no local results are found.';

  public readonly inputSchema = localSearchInputSchema;

  constructor(
    private braveMcpServer: BraveMcpServer,
    private braveSearch: BraveSearch,
    private webSearchTool: BraveWebSearchTool,
    private isUI: boolean = false,
  ) {
    super();
  }

  public async execute(input: z.infer<typeof localSearchInputSchema>) {
    try {
      return await this.executeCore(input);
    }
    catch (error) {
      console.error(`Error executing ${this.name}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      const result: {
        content: Array<{ type: 'text'; text: string }>;
        isError: true;
        _meta?: { structuredContent: BraveLocalSearchStructuredContent };
      } = {
        content: [{ type: 'text', text: `Error in ${this.name}: ${message}` }],
        isError: true,
      };
      if (this.isUI) {
        result._meta = {
          structuredContent: {
            query: input.query,
            count: 0,
            offset: input.offset ?? 0,
            items: [],
            error: message,
          },
        };
      }
      return result;
    }
  }

  public async executeCore(input: z.infer<typeof localSearchInputSchema>) {
    const { query, count, offset } = input;
    const results = await this.braveSearch.webSearch(query, {
      count,
      offset,
      safesearch: SafeSearchLevel.Strict,
      result_filter: 'locations',
    });

    // Check for fallback to web search
    if (!results.locations || results.locations?.results.length === 0) {
      this.braveMcpServer.log(`No location results found for "${query}" falling back to web search. Make sure your API Plan is at least "Pro"`);
      const webResult = await this.webSearchTool.executeCore({ query, count, offset: 0 });

      // If UI mode, add fallback flag
      if (this.isUI && webResult._meta?.structuredContent) {
        return {
          ...webResult,
          _meta: {
            structuredContent: {
              query,
              count: 0,
              offset: offset ?? 0,
              items: [],
              fallbackToWeb: true,
            },
          },
        };
      }
      return webResult;
    }

    // Brave Locations API returns all matching location IDs at once
    // We implement pagination client-side by slicing the IDs array
    const allIds = results.locations.results.map(result => result.id);
    const startIndex = (offset ?? 0) * (count ?? 10);
    const ids = allIds.slice(startIndex, startIndex + (count ?? 10));
    this.braveMcpServer.log(`Using ${ids.length} of ${allIds.length} location IDs for "${query}" (offset: ${offset ?? 0})`, 'debug');

    const localPoiSearchApiResponse = await this.braveSearch.localPoiSearch(ids);
    const poiResults = (localPoiSearchApiResponse.results || []).map((result, index) => {
      if (!result)
        return null;
      const id = ids[index];
      if (id && !(result as any).id)
        (result as any).id = id;
      return result;
    }).filter(Boolean);
    localPoiSearchApiResponse.results = poiResults as typeof localPoiSearchApiResponse.results;

    let localDescriptionsSearchApiResponse: LocalDescriptionsSearchApiResponse;
    try {
      localDescriptionsSearchApiResponse = await this.braveSearch.localDescriptionsSearch(ids);
    }
    catch (error) {
      this.braveMcpServer.log(`${error}`, 'error');
      localDescriptionsSearchApiResponse = {
        type: 'local_descriptions',
        results: [],
      };
    }

    // Build structured items for UI
    const localItems: Array<{
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
    }> = [];

    for (const poi of localPoiSearchApiResponse.results || []) {
      const desc = localDescriptionsSearchApiResponse.results.find(d => d.id === (poi as any).id);
      const todayHours = poi.opening_hours?.current_day
        ?.map(d => `${d.opens} - ${d.closes}`)
        .join(', ');

      // Format weekly hours
      const weeklyHours = poi.opening_hours?.days
        ?.map((daySlot, idx) => {
          const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const times = daySlot.map(d => `${d.opens}-${d.closes}`).join(', ');
          return times ? `${dayNames[idx]}: ${times}` : null;
        })
        .filter(Boolean)
        .join('\n');

      localItems.push({
        id: (poi as any).id,
        name: poi.title,
        address: poi.postal_address?.displayAddress || '',
        coordinates: poi.coordinates,
        phone: poi.contact?.telephone,
        email: poi.contact?.email,
        priceRange: poi.price_range,
        rating: poi.rating?.ratingValue,
        reviewCount: poi.rating?.reviewCount,
        cuisine: poi.serves_cuisine,
        todayHours,
        weeklyHours,
        description: desc?.description,
      });
    }

    // Generate text output
    const texts = formatPoiResults(localPoiSearchApiResponse, localDescriptionsSearchApiResponse);
    if (texts.length === 0) {
      const text = `No local results found for "${query}"`;
      const result = { content: [{ type: 'text' as const, text }] } as {
        content: Array<{ type: 'text'; text: string }>;
        _meta?: { structuredContent: BraveLocalSearchStructuredContent };
      };
      if (this.isUI) {
        result._meta = {
          structuredContent: {
            query,
            count: 0,
            offset: offset ?? 0,
            items: [],
          },
        };
      }
      return result;
    }

    // Generate combined text for non-UI mode
    const combinedText = texts
      .map((text, index) => `${index + 1}: ${text}`)
      .join('\n\n');

    // In UI mode, return minimal text - widget controls model context
    // In non-UI mode, return full place details for the model
    const contentText = this.isUI
      ? `Found ${localItems.length} local places for "${query}". `
      + 'IMPORTANT: You CANNOT see the business names, addresses, or details. '
      + 'The user sees a widget with places displayed on a map, but you have NO information about them. '
      + 'Do NOT claim to see or describe any of the businesses. '
      + 'Simply tell the user the places are displayed in the widget and wait for them to share details. '
      + 'Tell the user to click the + icon on any place to add it to the conversation, '
      + 'then you will be able to see and discuss that place.'
      : combinedText;

    const result = { content: [{ type: 'text' as const, text: contentText }] } as {
      content: Array<{ type: 'text'; text: string }>;
      _meta?: { structuredContent: BraveLocalSearchStructuredContent };
    };

    if (this.isUI) {
      result._meta = {
        structuredContent: {
          query,
          offset: offset ?? 0,
          count: localItems.length,
          items: localItems,
        },
      };
    }

    return result;
  }
}
