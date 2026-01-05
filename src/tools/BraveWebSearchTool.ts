import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const webSearchInputSchema = z.object({
  query: z.string().describe('The term to search the internet for'),
  count: z.number().min(1).max(20).default(10).optional().describe('The number of results to return, minimum 1, maximum 20'),
  offset: z.number().min(0).default(0).optional().describe('The offset for pagination, minimum 0'),
  freshness: z.union([
    z.enum(['pd', 'pw', 'pm', 'py']),
    z.string().regex(/^\d{4}-\d{2}-\d{2}to\d{4}-\d{2}-\d{2}$/, 'Date range must be in format YYYY-MM-DDtoYYYY-MM-DD'),
  ])
    .optional()
    .describe(
      `Filters search results by when they were discovered.
The following values are supported:
- pd: Discovered within the last 24 hours.
- pw: Discovered within the last 7 Days.
- pm: Discovered within the last 31 Days.
- py: Discovered within the last 365 Days.
- YYYY-MM-DDtoYYYY-MM-DD: Custom date range (e.g., 2022-04-01to2022-07-30)`,
    ),
});

export class BraveWebSearchTool extends BaseTool<typeof webSearchInputSchema, any> {
  public readonly name = 'brave_web_search';
  public readonly description = 'Performs a web search using the Brave Search API, ideal for general queries, and online content. '
    + 'Use this for broad information gathering, recent events, or when you need diverse web sources. '
    + 'Maximum 20 results per request ';

  public readonly inputSchema = webSearchInputSchema;

  constructor(private braveMcpServer: BraveMcpServer, private braveSearch: BraveSearch) {
    super();
  }

  public async executeCore(input: z.infer<typeof webSearchInputSchema>) {
    const { query, count, offset, freshness } = input;
    const results = await this.braveSearch.webSearch(query, {
      count,
      offset,
      safesearch: SafeSearchLevel.Strict,
      ...(freshness ? { freshness } : {}),
    });
    if (!results.web || results.web?.results.length === 0) {
      this.braveMcpServer.log(`No results found for "${query}"`);
      const text = `No results found for "${query}"`;
      return { content: [{ type: 'text' as const, text }] };
    }
    const text = results.web.results.map(result => `Title: ${result.title}\nURL: ${result.url}\nDescription: ${result.description}`).join('\n\n');
    return { content: [{ type: 'text' as const, text }] };
  }
}
