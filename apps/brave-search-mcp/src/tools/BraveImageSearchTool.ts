import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const imageSearchInputSchema = z.object({
  searchTerm: z.string().describe('The term to search the internet for images of'),
  count: z.number().min(1).max(20).optional().default(5).describe('The number of images to search for, minimum 1, maximum 20'),
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

export class BraveImageSearchTool extends BaseTool<typeof imageSearchInputSchema, any> {
  public readonly name = 'brave_image_search';
  public readonly description = 'A tool for searching the web for images using the Brave Search API.';
  public readonly inputSchema = imageSearchInputSchema;

  constructor(private server: BraveMcpServer, private braveSearch: BraveSearch, private isUI: boolean = false) {
    super();
  }

  public async execute(input: z.infer<typeof imageSearchInputSchema>) {
    try {
      return await this.executeCore(input);
    }
    catch (error) {
      console.error(`Error executing ${this.name}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      const result: {
        content: Array<{ type: 'text'; text: string }>;
        isError: true;
        structuredContent?: BraveImageSearchStructuredContent;
      } = {
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

  public async executeCore(input: z.infer<typeof imageSearchInputSchema>) {
    const { searchTerm, count } = input;
    this.server.log(`Searching for images of "${searchTerm}" with count ${count}`, 'debug');

    const imageResults = await this.braveSearch.imageSearch(searchTerm, {
      count,
      safesearch: SafeSearchLevel.Strict,
    });
    if (!imageResults.results || imageResults.results.length === 0) {
      this.server.log(`No image results found for "${searchTerm}"`, 'info');
      const text = `No image results found for "${searchTerm}"`;
      const result = { content: [{ type: 'text' as const, text }] } as {
        content: Array<{ type: 'text'; text: string }>;
        structuredContent?: BraveImageSearchStructuredContent;
      };
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
      const width = result.properties?.width ?? result.thumbnail?.width;
      const height = result.properties?.height ?? result.thumbnail?.height;
      imageItems.push({
        title: result.title,
        pageUrl: result.url,
        imageUrl: result.properties.url,
        source: result.source,
        confidence: result.confidence,
        width,
        height,
      });
    }
    const combinedText = imageItems
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
    const result = { content: [{ type: 'text' as const, text: combinedText }] } as {
      content: Array<{ type: 'text'; text: string }>;
      structuredContent?: BraveImageSearchStructuredContent;
    };
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
