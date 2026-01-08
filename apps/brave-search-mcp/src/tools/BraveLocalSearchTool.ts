import type { BraveSearch, LocalDescriptionsSearchApiResponse, LocalPoiSearchApiResponse } from 'brave-search';
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

  private baseUrl = 'https://api.search.brave.com/res/v1';

  constructor(private braveMcpServer: BraveMcpServer, private braveSearch: BraveSearch, private webSearchTool: BraveWebSearchTool, private apiKey: string) {
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

    const localPoiSearchApiResponse = await this.localPoiSearch(ids);
    // the call to localPoiSearch does not return the id of the pois
    // add them here, they should be in the same order as the ids
    // and the same order of id in localDescriptionsSearchApiResponse
    localPoiSearchApiResponse.results.forEach((result, index) => {
      (result as any).id = ids[index];
    });
    const localDescriptionsSearchApiResponse = await this.localDescriptionsSearch(ids);
    const text = formatPoiResults(localPoiSearchApiResponse, localDescriptionsSearchApiResponse);
    formattedText.push(text);
    const finalText = formattedText.join('\n\n');
    return { content: [{ type: 'text' as const, text: finalText }] };
  }

  // workaround for https://github.com/erik-balfe/brave-search/pull/3
  // not being merged yet into brave-search
  private async localPoiSearch(ids: string[]) {
    try {
      const qs = ids.map(id => `ids=${encodeURIComponent(id)}`).join('&');
      const url = `${this.baseUrl}/local/pois?${qs}`;
      this.braveMcpServer.log(`Fetching local POI data from ${url}`, 'debug');
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        redirect: 'follow',
      });
      if (!res.ok) {
        throw new Error(`Error fetching local POI data Status:${res.status} Status Text:${res.statusText} Headers:${JSON.stringify(res.headers)}`);
      }
      const data = (await res.json()) as LocalPoiSearchApiResponse;
      return data;
    }
    catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private async localDescriptionsSearch(ids: string[]) {
    try {
      const qs = ids.map(id => `ids=${encodeURIComponent(id)}`).join('&');
      const url = `${this.baseUrl}/local/descriptions?${qs}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        redirect: 'follow',
      });
      if (!res.ok) {
        const responseText = await res.text();
        this.braveMcpServer.log(`Error response body: ${responseText}`, 'error');
        this.braveMcpServer.log(`Response headers: ${JSON.stringify(Object.fromEntries(res.headers.entries()))}`, 'error');
        this.braveMcpServer.log(`Request URL: ${url}`, 'error');
        this.braveMcpServer.log(`Request headers: ${JSON.stringify(this.getHeaders())}`, 'error');
        if (res.status === 429) {
          this.braveMcpServer.log('429 Rate limit exceeded, consider adding delay between requests', 'error');
        }
        else if (res.status === 403) {
          this.braveMcpServer.log('403 Authentication error - check your API key', 'error');
        }
        else if (res.status === 500) {
          this.braveMcpServer.log('500 Internal server error - might be an issue with request format or API temporary issues', 'error');
        }
        // return an empty response instead of error so we can at least return the pois results
        return {
          type: 'local_descriptions',
          results: [],
        } as LocalDescriptionsSearchApiResponse;
      }
      const data = (await res.json()) as LocalDescriptionsSearchApiResponse;
      return data;
    }
    catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private handleError(error: any) {
    this.braveMcpServer.log(`${error}`, 'error');
  }

  private getHeaders() {
    return {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'X-Subscription-Token': this.apiKey,
      'User-Agent': 'BraveSearchMCP/1.0',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    };
  }
  // end workaround
}
