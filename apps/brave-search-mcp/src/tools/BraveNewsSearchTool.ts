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

const newsItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string(),
  source: z.string().optional().default('Unknown'),
  age: z.string(),
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
        structuredContent?: BraveNewsSearchStructuredContent;
      } = {
        content: [{ type: 'text', text: `Error in ${this.name}: ${message}` }],
        isError: true,
      };

      if (this.isUI) {
        result.structuredContent = {
          query: input.query,
          count: 0,
          items: [],
          error: message,
        };
      }

      return result;
    }
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
      const result = { content: [{ type: 'text' as const, text }] } as {
        content: Array<{ type: 'text'; text: string }>;
        structuredContent?: BraveNewsSearchStructuredContent;
      };
      if (this.isUI) {
        result.structuredContent = {
          query,
          count: 0,
          items: [],
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
      breaking: boolean;
      thumbnail?: { src: string; height?: number; width?: number };
      favicon?: string;
    }> = [];

    for (const result of newsResult.results) {
      newsItems.push({
        title: result.title,
        url: result.url,
        description: result.description,
        source: result.source ?? 'Unknown',
        age: result.age,
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

    const combinedText = newsItems
      .map((item, index) => (
        `${index + 1}: Title: ${item.title}\nURL: ${item.url}\nAge: ${item.age}\nDescription: ${item.description}`
      ))
      .join('\n\n');

    const result = { content: [{ type: 'text' as const, text: combinedText }] } as {
      content: Array<{ type: 'text'; text: string }>;
      structuredContent?: BraveNewsSearchStructuredContent;
    };

    if (this.isUI) {
      result.structuredContent = {
        query,
        count: newsItems.length,
        items: newsItems,
      };
    }

    return result;
  }
}

