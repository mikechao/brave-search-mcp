import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import imageToBase64 from 'image-to-base64';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const imageSearchInputSchema = z.object({
  searchTerm: z.string().describe('The term to search the internet for images of'),
  count: z.number().min(1).max(3).optional().default(1).describe('The number of images to search for, minimum 1, maximum 3'),
});

export class BraveImageSearchTool extends BaseTool<typeof imageSearchInputSchema, any> {
  public readonly name = 'brave_image_search';
  public readonly description = 'A tool for searching the web for images using the Brave Search API.';
  public readonly inputSchema = imageSearchInputSchema;
  public readonly imageByTitle = new Map<string, string>();

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
    this.server.log(`Found ${imageResults.results.length} images for "${searchTerm}"`, 'debug');
    const base64Strings = [];
    const titles = [];
    for (const result of imageResults.results) {
      const base64 = await imageToBase64(result.properties.url);
      this.server.log(`Image base64 length: ${base64.length}`, 'debug');
      titles.push(result.title);
      base64Strings.push(base64);
      this.imageByTitle.set(result.title, base64);
    }
    const results = [];
    for (const [index, title] of titles.entries()) {
      results.push({
        type: 'text',
        text: `${title}`,
      });
      results.push({
        type: 'image',
        data: base64Strings[index],
        mimeType: 'image/png',
      });
    }
    this.server.resourceChangedNotification();
    return { content: results };
  }
}
