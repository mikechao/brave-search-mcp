import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BraveSearch, LocalDescriptionsSearchApiResponse, LocalPoiSearchApiResponse, OpeningHours } from 'brave-search';
import type { UiToolSpecConfig } from '../ui-config.js';
import type { LocalWebFallbackExecutor, ToolLogger } from './tool-helpers.js';
import { SafeSearchLevel } from 'brave-search';
import { z } from 'zod';
import { TOOL_NAMES } from '../tool-catalog.js';
import { OPENAI_CDN_RESOURCE_DOMAIN } from '../ui-config.js';
import {
  buildPagedStructuredContent,
  buildStructuredToolResult,
  buildToolErrorResult,
  createPagedSearchOutputSchema,
  executeTool,
  getErrorMessage,
  webResultSchema,
  webSearchOutputSchema,
} from './tool-helpers.js';

function formatOpeningHours(data: OpeningHours): string {
  const today = data.current_day.map((day) => {
    return `${day.full_name} ${day.opens} - ${day.closes}`;
  });
  const weekly = data.days.map((daySlot) => {
    return daySlot.map((day) => {
      return `${day.full_name} ${day.opens} - ${day.closes}`;
    });
  });
  return `Today: ${today.join(', ')}\nWeekly:\n${weekly.map(daySlots => daySlots.join(', ')).join('\n')}`;
}

export function formatPoiResults(poiData: LocalPoiSearchApiResponse, poiDesc: LocalDescriptionsSearchApiResponse) {
  return (poiData.results || []).map((poi) => {
    const description = poiDesc.results.find(locationDescription => locationDescription.id === poi.id);
    const coords = poi.coordinates;
    const coordsText = coords ? `Coordinates: ${coords[0]}, ${coords[1]}\n` : '';
    const address = poi.postal_address?.displayAddress ?? 'No address found';
    const ratingValue = poi.rating?.ratingValue ?? 0;
    const reviewCount = poi.rating?.reviewCount ?? 0;
    return `Name: ${poi.title}\n`
      + `${poi.serves_cuisine ? `Cuisine: ${poi.serves_cuisine.join(', ')}\n` : ''}`
      + `Address: ${address}\n${
        coordsText
      }Phone: ${poi.contact?.telephone || 'No phone number found'}\n`
      + `Email: ${poi.contact?.email || 'No email found'}\n`
      + `Price Range: ${poi.price_range || 'No price range found'}\n`
      + `Ratings: ${ratingValue} (${reviewCount}) reviews\n`
      + `Hours:\n ${(poi.opening_hours) ? formatOpeningHours(poi.opening_hours) : 'No opening hours found'}\n`
      + `Description: ${(description) ? description.description : 'No description found'}\n`;
  });
}

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

export const localSearchOutputSchema = createPagedSearchOutputSchema(localBusinessSchema, {
  webFallbackItems: z.array(webResultSchema).optional(),
  fallbackToWeb: z.boolean().optional(),
});

export type BraveLocalSearchStructuredContent = z.infer<typeof localSearchOutputSchema>;

export class BraveLocalSearchTool {
  public readonly name = TOOL_NAMES.local;
  public readonly description = 'Searches for local businesses and places using Brave\'s Local Search API. '
    + 'Best for queries related to physical locations, businesses, restaurants, services, etc. '
    + 'Returns detailed information including:\n'
    + '- Business names and addresses\n'
    + '- Ratings and review counts\n'
    + '- Phone numbers and opening hours\n'
    + 'Use this when the query implies \'near me\' or mentions specific locations. '
    + 'Automatically falls back to web search on the first page if no local results are found.';

  public readonly inputSchema = localSearchInputSchema;

  public readonly uiSpec: UiToolSpecConfig = {
    mcpAppResourceUri: 'ui://brave-local-search/mcp-app.html',
    chatgptResourceUri: 'ui://brave-local-search/chatgpt-widget.html',
    title: 'Brave Local Search',
    mcpApp: {
      description: 'Brave Local Search UI (MCP-APP)',
      bundlePath: 'src/lib/local/mcp-app.html',
      csp: {
        resourceDomains: [
          'https://tile.openstreetmap.org',
          'https://a.tile.openstreetmap.org',
          'https://b.tile.openstreetmap.org',
          'https://c.tile.openstreetmap.org',
          OPENAI_CDN_RESOURCE_DOMAIN,
        ],
      },
    },
    chatgptWidget: {
      registrationName: 'brave-local-search-chatgpt',
      description: 'Brave Local Search Widget (ChatGPT)',
      bundlePath: 'src/lib/local/chatgpt-app.html',
      csp: {
        resource_domains: [
          'https://tile.openstreetmap.org',
          'https://a.tile.openstreetmap.org',
          'https://b.tile.openstreetmap.org',
          'https://c.tile.openstreetmap.org',
          OPENAI_CDN_RESOURCE_DOMAIN,
        ],
      },
    },
    toolMeta: {
      widgetAccessible: true,
      invokingText: 'Searching local businesses…',
      invokedText: 'Places found.',
    },
  };

  constructor(
    private logMessage: ToolLogger,
    private braveSearch: BraveSearch,
    private executeWebFallback: LocalWebFallbackExecutor,
    private isUI: boolean = false,
  ) {}

  public async execute(input: z.infer<typeof localSearchInputSchema>): Promise<CallToolResult> {
    return executeTool({
      toolName: this.name,
      input,
      executeCore: value => this.executeCore(value),
      buildErrorResult: (value, error) => buildToolErrorResult(
        this.name,
        error,
        this.isUI
          ? buildPagedStructuredContent({
              query: value.query,
              count: value.count ?? 10,
              offset: value.offset ?? 0,
              items: [],
              extra: { error: getErrorMessage(error) },
            })
          : undefined,
      ),
    });
  }

  public async executeCore(input: z.infer<typeof localSearchInputSchema>): Promise<CallToolResult> {
    const { query, count, offset } = input;
    const requestedCount = count ?? 10;
    const requestedOffset = offset ?? 0;
    const results = await this.braveSearch.webSearch(query, {
      count: requestedCount,
      offset: requestedOffset,
      safesearch: SafeSearchLevel.Strict,
      result_filter: 'locations',
    });
    const locationResults = results.locations?.results ?? [];

    // Only the initial page falls back to web search when no local ids are available.
    if (locationResults.length === 0 && requestedOffset === 0) {
      this.logMessage(`No location results found for "${query}" falling back to web search. Make sure your API Plan is at least "Pro"`);
      const webResult = await this.executeWebFallback({ query, count, offset: 0 });

      // If UI mode, add fallback flag
      if (this.isUI) {
        const parsedWebResult = webSearchOutputSchema.safeParse(webResult._meta?.structuredContent);
        if (!parsedWebResult.success && webResult._meta?.structuredContent !== undefined) {
          this.logMessage(
            `Invalid web fallback structured content for "${query}": ${parsedWebResult.error.message}`,
            'warning',
          );
        }
        const webFallbackItems = parsedWebResult.success ? parsedWebResult.data.items : [];
        return {
          ...webResult,
          _meta: {
            structuredContent: buildPagedStructuredContent({
              query,
              count: requestedCount,
              offset: 0,
              items: [],
              returnedCount: webFallbackItems.length,
              extra: {
                webFallbackItems,
                fallbackToWeb: true,
              },
            }),
          },
        };
      }
      return webResult;
    }

    if (locationResults.length === 0) {
      const text = `No local results found for "${query}"`;
      return buildStructuredToolResult(
        text,
        this.isUI
          ? buildPagedStructuredContent({
              query,
              count: requestedCount,
              offset: requestedOffset,
              items: [],
            })
          : undefined,
      );
    }

    const ids = locationResults.map(result => result.id);
    this.logMessage(`Using ${ids.length} location IDs for "${query}" (offset: ${requestedOffset})`, 'debug');

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
      this.logMessage(`${error}`, 'error');
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
      return buildStructuredToolResult(
        text,
        this.isUI
          ? buildPagedStructuredContent({
              query,
              count: requestedCount,
              offset: offset ?? 0,
              items: [],
            })
          : undefined,
      );
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

    return buildStructuredToolResult(
      contentText,
      this.isUI
        ? buildPagedStructuredContent({
            query,
            count: requestedCount,
            offset: requestedOffset,
            items: localItems,
          })
        : undefined,
    );
  }
}
