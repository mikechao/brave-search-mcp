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
});

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

  constructor(private braveMcpServer: BraveMcpServer, private braveSearch: BraveSearch, private webSearchTool: BraveWebSearchTool) {
    super();
  }

  public async executeCore(input: z.infer<typeof localSearchInputSchema>) {
    const { query, count } = input;
    const results = await this.braveSearch.webSearch(query, {
      count,
      safesearch: SafeSearchLevel.Strict,
      result_filter: 'locations',
    });
    // it looks like the count parameter is only good for web search results
    if (!results.locations || results.locations?.results.length === 0) {
      this.braveMcpServer.log(`No location results found for "${query}" falling back to web search. Make sure your API Plan is at least "Pro"`);
      return this.webSearchTool.executeCore({ query, count, offset: 0 });
    }
    const allIds = results.locations.results.map(result => result.id);
    // count is restricted to 20 in the schema, and the location api supports up to 20 at a time
    // so we can just use the count parameter to limit the number of ids, take the first "count" ids
    const ids = allIds.slice(0, count);
    this.braveMcpServer.log(`Using ${ids.length} of ${allIds.length} location IDs for "${query}"`, 'debug');
    const formattedText = [];

    const localPoiSearchApiResponse = await this.braveSearch.localPoiSearch(ids);
    // the call to localPoiSearch does not return the id of the pois
    // add them here, they should be in the same order as the ids
    // and the same order of id in localDescriptionsSearchApiResponse
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
    const texts = formatPoiResults(localPoiSearchApiResponse, localDescriptionsSearchApiResponse);
    formattedText.push(...texts);
    if (formattedText.length === 0) {
      const text = `No local results found for "${query}"`;
      return { content: [{ type: 'text' as const, text }] };
    }
    const combinedText = formattedText
      .map((text, index) => `${index + 1}: ${text}`)
      .join('\n\n');
    return { content: [{ type: 'text' as const, text: combinedText }] };
  }
}
