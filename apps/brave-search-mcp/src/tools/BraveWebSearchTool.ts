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

const webResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string(),
  domain: z.string().optional().default(''),
  favicon: z.string().optional(),
  age: z.string().optional(),
  thumbnail: z.object({
    src: z.string(),
    height: z.number().optional(),
    width: z.number().optional(),
  }).optional(),
});

export const webSearchOutputSchema = z.object({
  query: z.string(),
  count: z.number(),
  items: z.array(webResultSchema),
  error: z.string().optional(),
});

export type BraveWebSearchStructuredContent = z.infer<typeof webSearchOutputSchema>;

export class BraveWebSearchTool extends BaseTool<typeof webSearchInputSchema, any> {
  public readonly name = 'brave_web_search';
  public readonly description = 'Performs a web search using the Brave Search API, ideal for general queries, and online content. '
    + 'Use this for broad information gathering, recent events, or when you need diverse web sources. '
    + 'Maximum 20 results per request ';

  public readonly inputSchema = webSearchInputSchema;

  constructor(
    private braveMcpServer: BraveMcpServer,
    private braveSearch: BraveSearch,
    private isUI: boolean = false,
  ) {
    super();
  }

  public async execute(input: z.infer<typeof webSearchInputSchema>) {
    try {
      return await this.executeCore(input);
    }
    catch (error) {
      console.error(`Error executing ${this.name}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      const result: {
        content: Array<{ type: 'text'; text: string }>;
        isError: true;
        structuredContent?: BraveWebSearchStructuredContent;
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

  public async executeCore(input: z.infer<typeof webSearchInputSchema>) {
    const { query, count, offset, freshness } = input;
    const results = await this.braveSearch.webSearch(query, {
      count,
      offset,
      safesearch: SafeSearchLevel.Strict,
      ...(freshness ? { freshness } : {}),
    });

    if (!results.web || results.web?.results.length === 0) {
      this.braveMcpServer.log(`No results found for "${query}"`, 'info');
      const text = `No results found for "${query}"`;
      const result = { content: [{ type: 'text' as const, text }] } as {
        content: Array<{ type: 'text'; text: string }>;
        structuredContent?: BraveWebSearchStructuredContent;
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

    // Build structured items
    const webItems: Array<{
      title: string;
      url: string;
      description: string;
      domain: string;
      favicon?: string;
      age?: string;
      thumbnail?: { src: string; height?: number; width?: number };
    }> = [];

    for (const webResult of results.web.results) {
      webItems.push({
        title: webResult.title,
        url: webResult.url,
        description: webResult.description,
        domain: webResult.meta_url?.netloc ?? webResult.meta_url?.hostname ?? '',
        favicon: webResult.meta_url?.favicon,
        age: webResult.age,
        thumbnail: webResult.thumbnail
          ? {
            src: webResult.thumbnail.src,
            height: webResult.thumbnail.height,
            width: webResult.thumbnail.width,
          }
          : undefined,
      });
    }

    const combinedText = webItems
      .map((item, index) => (
        `${index + 1}: Title: ${item.title}\nURL: ${item.url}\nDescription: ${item.description}`
      ))
      .join('\n\n');

    const result = { content: [{ type: 'text' as const, text: combinedText }] } as {
      content: Array<{ type: 'text'; text: string }>;
      structuredContent?: BraveWebSearchStructuredContent;
    };

    if (this.isUI) {
      result.structuredContent = {
        query,
        count: webItems.length,
        items: webItems,
      };
    }

    return result;
  }
}
