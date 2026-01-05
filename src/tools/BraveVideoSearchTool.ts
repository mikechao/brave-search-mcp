import type { BraveSearch } from 'brave-search';
import type { BraveSearchOptions, Profile, Query, VideoData, VideoResult } from 'brave-search/dist/types.js';
import type { BraveMcpServer } from '../server.js';
import axios from 'axios';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { z } from 'zod';
import { formatVideoResults } from '../utils.js';
import { BaseTool } from './BaseTool.js';

// workaround for https://github.com/erik-balfe/brave-search/pull/4
// not being merged yet into brave-search
export interface BraveVideoData extends VideoData {
  /**
   * Whether the video requires a subscription.
   * @type {boolean}
   */
  requires_subscription?: boolean;
  /**
   * A list of tags relevant to the video.
   * @type {string[]}
   */
  tags?: string[];
  /**
   * A profile associated with the video.
   * @type {Profile}
   */
  author?: Profile;
}

export interface BraveVideoResult extends Omit<VideoResult, 'video'> {
  video: BraveVideoData;
}

export interface VideoSearchApiResponse {
  /**
   * The type of search API result. The value is always video.
   * @type {string}
   */
  type: 'video';
  /**
   * Video search query string.
   * @type {Query}
   */
  query: Query;
  /**
   * The list of video results for the given query.
   * @type {BraveVideoResult[]}
   */
  results: BraveVideoResult[];
}

export interface VideoSearchOptions extends Pick<BraveSearchOptions, 'country' | 'search_lang' | 'ui_lang' | 'count' | 'offset' | 'spellcheck' | 'safesearch' | 'freshness'> {
}
// end workaround

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

  private baseUrl = 'https://api.search.brave.com/res/v1';

  constructor(private braveMcpServer: BraveMcpServer, private braveSearch: BraveSearch, private apiKey: string) {
    super();
  }

  public async executeCore(input: z.infer<typeof videoSearchInputSchema>) {
    const { query, count, freshness } = input;
    const videoSearchResults = await this.videoSearch(query, {
      count,
      safesearch: SafeSearchLevel.Strict,
      ...(freshness ? { freshness } : {}),
    });
    if (!videoSearchResults.results || videoSearchResults.results.length === 0) {
      this.braveMcpServer.log(`No video results found for "${query}"`);
      const text = `No video results found for "${query}"`;
      return { content: [{ type: 'text' as const, text }] };
    }

    const text = formatVideoResults(videoSearchResults.results);
    return { content: [{ type: 'text' as const, text }] };
  }

  // workaround for https://github.com/erik-balfe/brave-search/pull/4
  // not being merged yet into brave-search
  private async videoSearch(
    query: string,
    options: VideoSearchOptions = {},
  ): Promise<VideoSearchApiResponse> {
    const response = await axios.get<VideoSearchApiResponse>(
      `${this.baseUrl}/videos/search?`,
      {
        params: {
          q: query,
          ...this.formatOptions(options),
        },
        headers: this.getHeaders(),
      },
    );
    return response.data;
  }

  private formatOptions(options: Record<string, any>): Record<string, string> {
    return Object.entries(options).reduce(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value.toString();
        }
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  private getHeaders() {
    return {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': this.apiKey,
    };
  }
  // end workaround
}
