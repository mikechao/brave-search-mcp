import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BraveSearch } from 'brave-search';
import type { ToolLogger } from './tool-helpers.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { z } from 'zod';
import {
  buildStructuredToolResult,
  executeTool,
  getErrorMessage,
} from './tool-helpers.js';

const imageSearchInputSchema = z.object({
  searchTerm: z.string().describe('The term to search the internet for images of'),
  count: z.number().min(1).max(50).optional().default(10).describe('The number of images to search for, minimum 1, maximum 20'),
});

const imageSearchItemSchema = z.object({
  title: z.string(),
  pageUrl: z.string(),
  imageUrl: z.string(),
  source: z.string(),
  confidence: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const imageSearchOutputSchema = z.object({
  searchTerm: z.string(),
  count: z.number(),
  items: z.array(imageSearchItemSchema),
  error: z.string().optional(),
});

export type BraveImageSearchItem = z.infer<typeof imageSearchItemSchema>;
export type BraveImageSearchStructuredContent = z.infer<typeof imageSearchOutputSchema>;

export class BraveImageSearchTool {
  public readonly name = 'brave_image_search';
  public readonly description = 'A tool for searching the web for images using the Brave Search API.';
  public readonly inputSchema = imageSearchInputSchema;

  constructor(private logMessage: ToolLogger, private braveSearch: BraveSearch, private isUI: boolean = false) {}

  private buildErrorResult(input: z.infer<typeof imageSearchInputSchema>, error: unknown): CallToolResult {
    const message = getErrorMessage(error);
    return {
      ...buildStructuredToolResult(
        `Error in ${this.name}: ${message}`,
        this.isUI
          ? {
              searchTerm: input.searchTerm,
              count: 0,
              items: [],
              error: message,
            }
          : undefined,
      ),
      isError: true,
    };
  }

  public async execute(input: z.infer<typeof imageSearchInputSchema>): Promise<CallToolResult> {
    return executeTool({
      toolName: this.name,
      input,
      executeCore: value => this.executeCore(value),
      buildErrorResult: (value, error) => this.buildErrorResult(value, error),
    });
  }

  public async executeCore(input: z.infer<typeof imageSearchInputSchema>): Promise<CallToolResult> {
    const { searchTerm, count } = input;
    this.logMessage(`Searching for images of "${searchTerm}" with count ${count}`, 'debug');

    const imageResults = await this.braveSearch.imageSearch(searchTerm, {
      count,
      safesearch: SafeSearchLevel.Strict,
    });
    if (!imageResults.results || imageResults.results.length === 0) {
      this.logMessage(`No image results found for "${searchTerm}"`, 'info');
      const text = `No image results found for "${searchTerm}"`;
      return buildStructuredToolResult(
        text,
        this.isUI
          ? {
              searchTerm,
              count: 0,
              items: [],
            }
          : undefined,
      );
    }
    this.logMessage(`Found ${imageResults.results.length} images for "${searchTerm}"`, 'debug');
    const imageItems: BraveImageSearchItem[] = [];
    for (const result of imageResults.results) {
      // Use thumbnail.src (proxied through imgs.search.brave.com) for CSP compatibility
      const thumbnailSrc = result.thumbnail?.src;
      if (!thumbnailSrc)
        continue; // Skip results without thumbnails

      imageItems.push({
        title: result.title,
        pageUrl: result.url,
        imageUrl: thumbnailSrc,
        source: result.source,
        confidence: result.confidence,
        width: result.thumbnail?.width,
        height: result.thumbnail?.height,
      });
    }
    const contentText = this.isUI
      ? `Found ${imageItems.length} image results for "${searchTerm}". `
      + 'IMPORTANT: You CANNOT see the image titles, sources, URLs, metadata, or pixel contents. '
      + 'The user sees an image widget, but you have NO information about the individual results. '
      + 'Do NOT claim to recognize, describe, or analyze any image from this result set. '
      + 'Simply tell the user the images are displayed in the widget and wait for them to share details. '
      + 'Tell the user to click the + icon on any image to add it to the conversation, '
      + 'then you will be able to discuss that specific image.'
      : imageItems
          .map((item, index) => (
            `${index + 1}: Title: ${item.title}\n`
            + `URL: ${item.pageUrl}\n`
            + `Image URL: ${item.imageUrl}\n`
            + `Source: ${item.source}\n`
            + `Confidence: ${item.confidence ?? 'N/A'}\n`
            + `Width: ${item.width ?? 'N/A'}\n`
            + `Height: ${item.height ?? 'N/A'}`
          ))
          .join('\n\n');
    return buildStructuredToolResult(
      contentText,
      this.isUI
        ? {
            searchTerm,
            count: imageItems.length,
            items: imageItems,
          }
        : undefined,
    );
  }
}
