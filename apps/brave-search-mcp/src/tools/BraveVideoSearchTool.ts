import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const videoSearchInputSchema = z.object({
  query: z.string().describe('The term to search the internet for videos of'),
  count: z.number().min(1).max(20).default(10).optional().describe('The number of results to return, minimum 1, maximum 20'),
  offset: z.number().min(0).max(9).default(0).optional().describe('The zero-based offset for pagination, indicating the index of the first result to return. Maximum value is 9.'),
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

const videoItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string(),
  thumbnail: z.object({
    src: z.string(),
    height: z.number().optional(),
    width: z.number().optional(),
  }).optional(),
  duration: z.string().optional().default(''),
  views: z.union([z.string(), z.number()]).optional().default('').transform(v => v ? String(v) : ''),
  creator: z.string().optional().default(''),
  age: z.string().optional().default(''),
  tags: z.array(z.string()).optional(),
  requiresSubscription: z.boolean().optional(),
  favicon: z.string().optional(),
  embedId: z.string().optional(), // YouTube/Vimeo video ID for embedding
  embedType: z.enum(['youtube', 'vimeo']).optional(),
});

export const videoSearchOutputSchema = z.object({
  query: z.string(),
  count: z.number(),
  items: z.array(videoItemSchema),
  error: z.string().optional(),
});

export type BraveVideoSearchStructuredContent = z.infer<typeof videoSearchOutputSchema>;

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match)
      return match[1];
  }
  return null;
}

/**
 * Extract Vimeo video ID from URL
 */
function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

export class BraveVideoSearchTool extends BaseTool<typeof videoSearchInputSchema, any> {
  public readonly name = 'brave_video_search';
  public readonly description = 'Searches for videos using the Brave Search API. '
    + 'Use this for video content, tutorials, or any media-related queries. '
    + 'Returns a list of videos with titles, URLs, and descriptions. '
    + 'Maximum 20 results per request.';

  public readonly inputSchema = videoSearchInputSchema;

  constructor(
    private braveMcpServer: BraveMcpServer,
    private braveSearch: BraveSearch,
    private isUI: boolean = false,
  ) {
    super();
  }

  public async execute(input: z.infer<typeof videoSearchInputSchema>) {
    try {
      return await this.executeCore(input);
    }
    catch (error) {
      console.error(`Error executing ${this.name}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      const result: {
        content: Array<{ type: 'text'; text: string }>;
        isError: true;
        structuredContent?: BraveVideoSearchStructuredContent;
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

  public async executeCore(input: z.infer<typeof videoSearchInputSchema>) {
    const { query, count, offset, freshness } = input;
    const videoSearchResults = await this.braveSearch.videoSearch(query, {
      count,
      offset,
      safesearch: SafeSearchLevel.Strict,
      ...(freshness ? { freshness } : {}),
    });

    if (!videoSearchResults.results || videoSearchResults.results.length === 0) {
      this.braveMcpServer.log(`No video results found for "${query}"`);
      const text = `No video results found for "${query}"`;
      const result = { content: [{ type: 'text' as const, text }] } as {
        content: Array<{ type: 'text'; text: string }>;
        structuredContent?: BraveVideoSearchStructuredContent;
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

    // Build structured video items
    const videoItems: Array<{
      title: string;
      url: string;
      description: string;
      thumbnail?: { src: string; height?: number; width?: number };
      duration: string;
      views: string;
      creator: string;
      age: string;
      tags?: string[];
      requiresSubscription?: boolean;
      favicon?: string;
      embedId?: string;
      embedType?: 'youtube' | 'vimeo';
    }> = [];

    for (const video of videoSearchResults.results) {
      // Detect embed type
      const youtubeId = extractYouTubeId(video.url);
      const vimeoId = youtubeId ? null : extractVimeoId(video.url);

      videoItems.push({
        title: video.title,
        url: video.url,
        description: video.description,
        thumbnail: video.thumbnail
          ? {
              src: video.thumbnail.src,
              height: video.thumbnail.height,
              width: video.thumbnail.width,
            }
          : undefined,
        duration: video.video.duration ?? '',
        views: String(video.video.views ?? ''),
        creator: video.video.creator ?? '',
        age: video.age ?? '',
        tags: video.video.tags,
        requiresSubscription: video.video.requires_subscription,
        favicon: video.meta_url?.favicon,
        embedId: youtubeId ?? vimeoId ?? undefined,
        embedType: youtubeId ? 'youtube' : vimeoId ? 'vimeo' : undefined,
      });
    }

    const items = videoItems.map((item) => {
      const subscriptionText = item.requiresSubscription ? 'Requires subscription' : null;
      const tagsText = item.tags?.length ? `Tags: ${item.tags.join(', ')}` : null;
      const extraLines = [subscriptionText, tagsText]
        .filter((value): value is string => Boolean(value))
        .join('\n');
      const text = `Title: ${item.title}\n`
        + `URL: ${item.url}\n`
        + `Description: ${item.description}\n`
        + `Age: ${item.age}\n`
        + `Duration: ${item.duration}\n`
        + `Views: ${item.views}\n`
        + `Creator: ${item.creator}${extraLines ? `\n${extraLines}` : ''}`;
      return text;
    });

    const combinedText = items
      .map((text, index) => `${index + 1}: ${text}`)
      .join('\n\n');

    const result = { content: [{ type: 'text' as const, text: combinedText }] } as {
      content: Array<{ type: 'text'; text: string }>;
      structuredContent?: BraveVideoSearchStructuredContent;
    };

    if (this.isUI) {
      result.structuredContent = {
        query,
        count: videoItems.length,
        items: videoItems,
      };
    }

    return result;
  }
}
