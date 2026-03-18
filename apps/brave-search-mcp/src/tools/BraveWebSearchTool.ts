import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BraveSearch } from 'brave-search';
import type { UiToolSpecConfig } from '../ui-config.js';
import type { ToolLogger } from './tool-helpers.js';
import { SafeSearchLevel } from 'brave-search';
import { z } from 'zod';
import { TOOL_NAMES } from '../tool-catalog.js';
import { OPENAI_CDN_RESOURCE_DOMAIN } from '../ui-config.js';
import {
  buildPagedStructuredContent,
  buildStructuredToolResult,
  buildToolErrorResult,
  executeTool,
  freshnessInputSchema,
  getErrorMessage,
  webSearchOutputSchema,
} from './tool-helpers.js';

const webSearchInputSchema = z.object({
  query: z.string().describe('The term to search the internet for'),
  count: z.number().min(1).max(20).default(10).optional().describe('The number of results to return, minimum 1, maximum 20'),
  offset: z.number().min(0).max(9).default(0).optional().describe('The zero-based offset for pagination, indicating the index of the first result to return. Maximum value is 9.'),
  freshness: freshnessInputSchema,
});

export type BraveWebSearchStructuredContent = z.infer<typeof webSearchOutputSchema>;

export { webSearchOutputSchema };

export class BraveWebSearchTool {
  public readonly name = TOOL_NAMES.web;
  public readonly description = 'Performs a web search and returns titles, URLs, and short descriptions — not the full content of the pages. '
    + 'Use this to discover sources or get an overview of what is available on a topic. '
    + 'Maximum 20 results per request.';

  public readonly inputSchema = webSearchInputSchema;

  public readonly uiSpec: UiToolSpecConfig = {
    mcpAppResourceUri: 'ui://brave-web-search/mcp-app.html',
    chatgptResourceUri: 'ui://brave-web-search/chatgpt-widget.html',
    title: 'Brave Web Search',
    mcpApp: {
      description: 'Brave Web Search UI (MCP-APP)',
      bundlePath: 'src/lib/web/mcp-app.html',
      csp: { resourceDomains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN] },
    },
    chatgptWidget: {
      registrationName: 'brave-web-search-chatgpt',
      description: 'Brave Web Search Widget (ChatGPT)',
      bundlePath: 'src/lib/web/chatgpt-app.html',
      csp: { resource_domains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN] },
    },
    toolMeta: {
      widgetAccessible: true,
      invokingText: 'Searching the web…',
      invokedText: 'Search complete.',
    },
  };

  constructor(
    private logMessage: ToolLogger,
    private braveSearch: BraveSearch,
    private isUI: boolean = false,
  ) {}

  public async execute(input: z.infer<typeof webSearchInputSchema>): Promise<CallToolResult> {
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
              moreResultsAvailable: false,
              extra: { error: getErrorMessage(error) },
            })
          : undefined,
      ),
    });
  }

  public async executeCore(input: z.infer<typeof webSearchInputSchema>): Promise<CallToolResult> {
    const { query, count, offset, freshness } = input;
    const requestedCount = count ?? 10;
    const results = await this.braveSearch.webSearch(query, {
      count: requestedCount,
      offset,
      safesearch: SafeSearchLevel.Strict,
      ...(freshness ? { freshness } : {}),
    });
    const moreResultsAvailable = results.query.more_results_available;

    if (!results.web || results.web?.results.length === 0) {
      this.logMessage(`No results found for "${query}"`, 'info');
      const text = `No results found for "${query}"`;
      return buildStructuredToolResult(
        text,
        this.isUI
          ? buildPagedStructuredContent({
              query,
              count: requestedCount,
              offset,
              items: [],
              moreResultsAvailable,
            })
          : undefined,
      );
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

    // In UI mode, return minimal text - widget controls model context
    // In non-UI mode, return full result details for the model
    const contentText = this.isUI
      ? `Found ${webItems.length} web results for "${query}". `
      + 'IMPORTANT: You CANNOT see the result titles, URLs, or descriptions. '
      + 'The user sees a widget with the results, but you have NO information about them. '
      + 'Do NOT claim to see details or describe what the results are about. '
      + 'Simply tell the user the results are displayed in the widget and wait for them to share details. '
      + 'Tell the user to click the + icon on any result to add it to the conversation, '
      + 'then you will be able to see and discuss that result.'
      : webItems
          .map((item, index) => (
            `${index + 1}: Title: ${item.title}\nURL: ${item.url}\nDescription: ${item.description}`
          ))
          .join('\n\n');

    return buildStructuredToolResult(
      contentText,
      this.isUI
        ? buildPagedStructuredContent({
            query,
            count: requestedCount,
            offset,
            moreResultsAvailable,
            items: webItems,
          })
        : undefined,
    );
  }
}
