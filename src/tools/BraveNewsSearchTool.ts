import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const newsSearchInputSchema = z.object({
  query: z.string().describe('The term to search the internet for news articles, trending topics, or recent events'),
  count: z.number().min(1).max(20).default(10).optional().describe('The number of results to return, minimum 1, maximum 20'),
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

export class BraveNewsSearchTool extends BaseTool<typeof newsSearchInputSchema, any> {
  public readonly name = 'brave_news_search';
  public readonly description = 'Searches for news articles using the Brave Search API. '
    + 'Use this for recent events, trending topics, or specific news stories. '
    + 'Returns a list of articles with titles, URLs, and descriptions. '
    + 'Maximum 20 results per request.';

  public readonly inputSchema = newsSearchInputSchema;

  constructor(private braveMcpServer: BraveMcpServer, private braveSearch: BraveSearch) {
    super();
  }

  public async executeCore(input: z.infer<typeof newsSearchInputSchema>) {
    const { query, count, freshness } = input;
    const newsResult = await this.braveSearch.newsSearch(query, {
      count,
      ...(freshness ? { freshness } : {}),
    });
    if (!newsResult.results || newsResult.results.length === 0) {
      this.braveMcpServer.log(`No news results found for "${query}"`);
      const text = `No news results found for "${query}"`;
      return { content: [{ type: 'text' as const, text }] };
    }

    const text = newsResult.results
      .map(result =>
        `Title: ${result.title}\n`
        + `URL: ${result.url}\n`
        + `Age: ${result.age}\n`
        + `Description: ${result.description}\n`,
      )
      .join('\n\n');
    return { content: [{ type: 'text' as const, text }] };
  }
}
