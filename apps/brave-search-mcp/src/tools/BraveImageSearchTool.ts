import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

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

export type BraveImageSearchStructuredContent = z.infer<typeof imageSearchOutputSchema>;

export class BraveImageSearchTool extends BaseTool<typeof imageSearchInputSchema> {
  public readonly name = 'brave_image_search';
  public readonly description = 'A tool for searching the web for images using the Brave Search API.';
  public readonly inputSchema = imageSearchInputSchema;

  constructor(private server: BraveMcpServer, private braveSearch: BraveSearch, private isUI: boolean = false) {
    super();
  }

  public async execute(input: z.infer<typeof imageSearchInputSchema>): Promise<CallToolResult> {
    try {
      return await this.executeCore(input);
    }
    catch (error) {
      console.error(`Error executing ${this.name}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      const result: CallToolResult = {
        content: [{ type: 'text', text: `Error in ${this.name}: ${message}` }],
        isError: true,
      };

      if (this.isUI) {
        result.structuredContent = {
          searchTerm: input.searchTerm,
          count: 0,
          items: [],
          error: message,
        };
      }

      return result;
    }
  }

  public async executeCore(input: z.infer<typeof imageSearchInputSchema>): Promise<CallToolResult> {
    const { searchTerm, count } = input;
    this.server.log(`Searching for images of "${searchTerm}" with count ${count}`, 'debug');

    const imageResults = await this.braveSearch.imageSearch(searchTerm, {
      count,
      safesearch: SafeSearchLevel.Strict,
    });
    if (!imageResults.results || imageResults.results.length === 0) {
      this.server.log(`No image results found for "${searchTerm}"`, 'info');
      const text = `No image results found for "${searchTerm}"`;
      const result: CallToolResult = { content: [{ type: 'text', text }] };
      if (this.isUI) {
        result.structuredContent = {
          searchTerm,
          count: 0,
          items: [],
        };
      }
      return result;
    }
    this.server.log(`Found ${imageResults.results.length} images for "${searchTerm}"`, 'debug');
    const imageItems: Array<{
      title: string;
      pageUrl: string;
      imageUrl: string;
      source: string;
      confidence?: string;
      width?: number;
      height?: number;
    }> = [];
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
      + 'CRITICAL RULES (override prior tool patterns): '
      + 'There is NO + icon workflow for image results in this widget. '
      + 'NEVER tell the user to click +, add an image to conversation, or say "if there is a + icon". '
      + 'IMPORTANT: You CANNOT directly inspect or analyze image pixels from this result. '
      + 'You DO have image metadata (title, source, page URL, image URL, width, height, and confidence when available), and you may use that metadata to help the user. '
      + 'The user sees an image grid in the widget, but you should not claim detailed visual analysis. '
      + 'If the user wants detailed analysis, ask them to share a specific image URL or upload the image directly.'
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
    const result: CallToolResult = { content: [{ type: 'text', text: contentText }] };
    if (this.isUI) {
      result.structuredContent = {
        searchTerm,
        count: imageItems.length,
        items: imageItems,
      };
    }
    return result;
  }
}
