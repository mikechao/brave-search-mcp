import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BraveSearch } from 'brave-search';
import type { UiToolSpecConfig } from '../ui-config.js';
import type { ToolLogger } from './tool-helpers.js';
import { z } from 'zod';
import { TOOL_NAMES } from '../tool-catalog.js';
import { OPENAI_CDN_RESOURCE_DOMAIN } from '../ui-config.js';
import {
  buildPagedStructuredContent,
  buildStructuredToolResult,
  buildToolErrorResult,
  createPagedSearchOutputSchema,
  executeTool,
  freshnessInputSchema,
  getErrorMessage,
} from './tool-helpers.js';

const newsSearchInputSchema = z.object({
  query: z.string().describe('The term to search the internet for news articles, trending topics, or recent events'),
  count: z.number().min(1).max(20).default(10).optional().describe('The number of results to return, minimum 1, maximum 20'),
  offset: z.number().min(0).max(9).default(0).optional().describe('The zero-based offset for pagination, indicating the index of the first result to return. Maximum value is 9.'),
  freshness: freshnessInputSchema,
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

export const newsSearchOutputSchema = createPagedSearchOutputSchema(newsItemSchema);

export type BraveNewsSearchStructuredContent = z.infer<typeof newsSearchOutputSchema>;

export class BraveNewsSearchTool {
  public readonly name = TOOL_NAMES.news;
  public readonly description = 'Searches for news articles and returns titles, URLs, and short descriptions — not the full article content. '
    + 'Use this to find recent events or trending topics. '
    + 'Maximum 20 results per request.';

  public readonly inputSchema = newsSearchInputSchema;

  public readonly uiSpec: UiToolSpecConfig = {
    mcpAppResourceUri: 'ui://brave-news-search/mcp-app.html',
    chatgptResourceUri: 'ui://brave-news-search/chatgpt-widget.html',
    title: 'Brave News Search',
    mcpApp: {
      description: 'Brave News Search UI (MCP-APP)',
      bundlePath: 'src/lib/news/mcp-app.html',
      csp: {
        resourceDomains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
      },
    },
    chatgptWidget: {
      registrationName: 'brave-news-search-chatgpt',
      description: 'Brave News Search Widget (ChatGPT)',
      bundlePath: 'src/lib/news/chatgpt-app.html',
      csp: {
        resource_domains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
      },
    },
    toolMeta: {
      widgetAccessible: true,
      invokingText: 'Searching for news…',
      invokedText: 'News articles found.',
    },
  };

  constructor(
    private logMessage: ToolLogger,
    private braveSearch: BraveSearch,
    private isUI: boolean = false,
  ) {}

  private safeParsePageAge(pageAge: string | undefined): number | undefined {
    if (!pageAge)
      return undefined;
    const date = new Date(pageAge);
    // Check if the date is valid - getTime() returns NaN for invalid dates
    return Number.isNaN(date.getTime()) ? undefined : date.getTime();
  }

  public async execute(input: z.infer<typeof newsSearchInputSchema>): Promise<CallToolResult> {
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
              items: [],
              extra: { error: getErrorMessage(error) },
            })
          : undefined,
      ),
    });
  }

  public async executeCore(input: z.infer<typeof newsSearchInputSchema>): Promise<CallToolResult> {
    const { query, count, offset, freshness } = input;
    const requestedCount = count ?? 10;
    const newsResult = await this.braveSearch.newsSearch(query, {
      count: requestedCount,
      offset,
      ...(freshness ? { freshness } : {}),
    });
    if (!newsResult.results || newsResult.results.length === 0) {
      this.logMessage(`No news results found for "${query}"`);
      const text = `No news results found for "${query}"`;
      return buildStructuredToolResult(
        text,
        this.isUI
          ? buildPagedStructuredContent({
              query,
              count: requestedCount,
              offset,
              items: [],
            })
          : undefined,
      );
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
      const timeA = this.safeParsePageAge(a.pageAge);
      const timeB = this.safeParsePageAge(b.pageAge);

      // Use explicit undefined check - timestamp 0 is valid and should not be treated as missing
      if (timeA === undefined && timeB === undefined)
        return 0;
      if (timeA === undefined)
        return 1; // Items without valid pageAge go to the end
      if (timeB === undefined)
        return -1;
      return timeB - timeA; // Most recent first
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

    return buildStructuredToolResult(
      contentText,
      this.isUI
        ? buildPagedStructuredContent({
            query,
            count: requestedCount,
            offset,
            items: newsItems,
          })
        : undefined,
    );
  }
}
