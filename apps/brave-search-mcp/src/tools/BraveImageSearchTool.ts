import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const imageSearchInputSchema = z.object({
  searchTerm: z.string().describe('The term to search the internet for images of'),
  count: z.number().min(1).max(20).optional().default(5).describe('The number of images to search for, minimum 1, maximum 20'),
});

export class BraveImageSearchTool extends BaseTool<typeof imageSearchInputSchema, any> {
  public readonly name = 'brave_image_search';
  public readonly description = 'A tool for searching the web for images using the Brave Search API.';
  public readonly inputSchema = imageSearchInputSchema;

  constructor(private server: BraveMcpServer, private braveSearch: BraveSearch) {
    super();
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
      return { content: [{ type: 'text' as const, text }] };
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
    const results = [];
    for (const item of imageItems) {
      results.push({
        type: 'text',
        text: `Title: ${item.title}\n`
          + `URL: ${item.pageUrl}\n`
          + `Image URL: ${item.imageUrl}\n`
          + `Source: ${item.source}\n`
          + `Confidence: ${item.confidence ?? 'N/A'}\n`
          + `Width: ${item.width ?? 'N/A'}\n`
          + `Height: ${item.height ?? 'N/A'}`,
      });
    }
    return { content: results };
  }
}
