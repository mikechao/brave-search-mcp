import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const videoSearchInputSchema = z.object({
  query: z.string().describe('The term to search the internet for videos of'),
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

export class BraveVideoSearchTool extends BaseTool<typeof videoSearchInputSchema, any> {
  public readonly name = 'brave_video_search';
  public readonly description = 'Searches for videos using the Brave Search API. '
    + 'Use this for video content, tutorials, or any media-related queries. '
    + 'Returns a list of videos with titles, URLs, and descriptions. '
    + 'Maximum 20 results per request.';

  public readonly inputSchema = videoSearchInputSchema;

  constructor(private braveMcpServer: BraveMcpServer, private braveSearch: BraveSearch) {
    super();
  }

  public async executeCore(input: z.infer<typeof videoSearchInputSchema>) {
    const { query, count, freshness } = input;
    const videoSearchResults = await this.braveSearch.videoSearch(query, {
      count,
      safesearch: SafeSearchLevel.Strict,
      ...(freshness ? { freshness } : {}),
    });
    if (!videoSearchResults.results || videoSearchResults.results.length === 0) {
      this.braveMcpServer.log(`No video results found for "${query}"`);
      const text = `No video results found for "${query}"`;
      return { content: [{ type: 'text' as const, text }] };
    }

    const content = videoSearchResults.results.map(video => {
      const subscriptionText = ('requires_subscription' in video.video)
        ? (video.video.requires_subscription ? 'Requires subscription' : 'No subscription')
        : null;
      const tagsText = ('tags' in video.video && video.video.tags)
        ? `Tags: ${video.video.tags.join(', ')}`
        : null;
      const extraLines = [subscriptionText, tagsText]
        .filter((value): value is string => Boolean(value))
        .join('\n');
      const text = `Title: ${video.title}\n`
        + `URL: ${video.url}\n`
        + `Description: ${video.description}\n`
        + `Age: ${video.age}\n`
        + `Duration: ${video.video.duration}\n`
        + `Views: ${video.video.views}\n`
        + `Creator: ${video.video.creator}`
        + (extraLines ? `\n${extraLines}` : '');
      return { type: 'text' as const, text };
    });
    return { content };
  }
}
