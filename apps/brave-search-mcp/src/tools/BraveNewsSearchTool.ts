import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const newsSearchInputSchema = z.object({
  query: z.string().describe('The term to search the internet for news articles, trending topics, or recent events'),
  count: z.number().min(1).max(20).default(10).optional().describe('The number of results to return, minimum 1, maximum 20'),
  offset: z.number().min(0).max(9).default(0).optional().describe('The zero-based offset for pagination, indicating the index of the first result to return. Maximum value is 9.'),
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

const newsItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string(),
  source: z.string().optional().default('Unknown'),
  age: z.string(),
  pageAge: z.string().optional(),
  breaking: z.boolean().optional().default(false),
  thumbnail: z.object({
    src: z.string(),
    height: z.number().optional(),
    width: z.number().optional(),
  }).optional(),
  favicon: z.string().optional(),
});

export const newsSearchOutputSchema = z.object({
  query: z.string(),
  count: z.number(),
  pageSize: z.number().optional(),
  returnedCount: z.number().optional(),
  offset: z.number().optional(),
  items: z.array(newsItemSchema),
  error: z.string().optional(),
});

export type BraveNewsSearchStructuredContent = z.infer<typeof newsSearchOutputSchema>;

export class BraveNewsSearchTool extends BaseTool<typeof newsSearchInputSchema, any> {
  public readonly name = 'brave_news_search';
  public readonly description = 'Searches for news articles using the Brave Search API. '
    + 'Use this for recent events, trending topics, or specific news stories. '
    + 'Returns a list of articles with titles, URLs, and descriptions. '
    + 'Maximum 20 results per request.';

  public readonly inputSchema = newsSearchInputSchema;

  constructor(
    private braveMcpServer: BraveMcpServer,
    private braveSearch: BraveSearch,
    private isUI: boolean = false,
  ) {
    super();
  }

  public async execute(input: z.infer<typeof newsSearchInputSchema>) {
    try {
      return await this.executeCore(input);
    }
    catch (error) {
      console.error(`Error executing ${this.name}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      const result: {
        content: Array<{ type: 'text'; text: string }>;
        isError: true;
        _meta?: { structuredContent: BraveNewsSearchStructuredContent };
      } = {
        content: [{ type: 'text', text: `Error in ${this.name}: ${message}` }],
        isError: true,
      };

      if (this.isUI) {
        const pageSize = input.count ?? 10;
        result._meta = {
          structuredContent: {
            query: input.query,
            count: pageSize,
            pageSize,
            returnedCount: 0,
            items: [],
            error: message,
          },
        };
      }

      return result;
    }
  }

  public async executeCore(input: z.infer<typeof newsSearchInputSchema>) {
    const { query, count, offset, freshness } = input;
    const requestedCount = count ?? 10;
    const newsResult = await this.braveSearch.newsSearch(query, {
      count: requestedCount,
      offset,
      ...(freshness ? { freshness } : {}),
    });
    if (!newsResult.results || newsResult.results.length === 0) {
      this.braveMcpServer.log(`No news results found for "${query}"`);
      const text = `No news results found for "${query}"`;
      const result = { content: [{ type: 'text' as const, text }] } as {
        content: Array<{ type: 'text'; text: string }>;
        _meta?: { structuredContent: BraveNewsSearchStructuredContent };
      };
      if (this.isUI) {
        result._meta = {
          structuredContent: {
            query,
            offset,
            count: requestedCount,
            pageSize: requestedCount,
            returnedCount: 0,
            items: [],
          },
        };
      }
      return result;
    }

    // Build structured news items
    const newsItems: Array<{
      title: string;
      url: string;
      description: string;
      source: string;
      age: string;
      pageAge?: string;
      breaking: boolean;
      thumbnail?: { src: string; height?: number; width?: number };
      favicon?: string;
    }> = [];

    for (const result of newsResult.results) {
      // Extract source from meta_url.netloc (e.g., "nytimes.com", "techcrunch.com")
      const source = result.meta_url?.netloc ?? result.meta_url?.hostname ?? 'Unknown';
      newsItems.push({
        title: result.title,
        url: result.url,
        description: result.description,
        source,
        age: result.age,
        pageAge: result.page_age, // ISO date string for sorting
        breaking: result.breaking ?? false,
        thumbnail: result.thumbnail
          ? {
              src: result.thumbnail.src,
              height: result.thumbnail.height,
              width: result.thumbnail.width,
            }
          : undefined,
        favicon: result.meta_url?.favicon,
      });
    }

    // Sort by pageAge (most recent first)
    newsItems.sort((a, b) => {
      if (!a.pageAge && !b.pageAge)
        return 0;
      if (!a.pageAge)
        return 1; // Items without pageAge go to the end
      if (!b.pageAge)
        return -1;
      return new Date(b.pageAge).getTime() - new Date(a.pageAge).getTime();
    });

    // In UI mode, return minimal text - widget controls model context
    // In non-UI mode, return full article details for the model
    const contentText = this.isUI
      ? `Found ${newsItems.length} news articles for "${query}". `
      + 'IMPORTANT: You CANNOT see the article titles, sources, or content. '
      + 'The user sees a widget with the articles, but you have NO information about them. '
      + 'Do NOT claim to see headlines or describe what the articles are about. '
      + 'Simply tell the user the articles are displayed in the widget and wait for them to share details.'
      + 'Tell the user to click the + icon on any article to add it to the conversation, '
      + 'then you will be able to see and discuss that article.'
      : newsItems
          .map((item, index) => (
            `${index + 1}: Title: ${item.title}\nURL: ${item.url}\nAge: ${item.age}\nDescription: ${item.description}`
          ))
          .join('\n\n');

    const result = { content: [{ type: 'text' as const, text: contentText }] } as {
      content: Array<{ type: 'text'; text: string }>;
      _meta?: { structuredContent: BraveNewsSearchStructuredContent };
    };

    if (this.isUI) {
      result._meta = {
        structuredContent: {
          query,
          offset,
          count: requestedCount,
          pageSize: requestedCount,
          returnedCount: newsItems.length,
          items: newsItems,
        },
      };
    }

    return result;
  }
}
