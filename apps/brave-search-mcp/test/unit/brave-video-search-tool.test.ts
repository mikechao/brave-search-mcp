import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../../src/server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { describe, expect, it, vi } from 'vitest';
import { BraveVideoSearchTool } from '../../src/tools/BraveVideoSearchTool.js';
import { createMockBraveSearch } from '../mocks/index.js';
import { getFirstTextContent, getMetaStructuredContent } from './tool-result-helpers.js';

interface VideoStructuredContent {
  query: string;
  count: number;
  pageSize?: number;
  returnedCount?: number;
  offset?: number;
  items: Array<{
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
  }>;
  error?: string;
}

function createServerStub() {
  return {
    log: vi.fn(),
  } as unknown as BraveMcpServer;
}

describe('braveVideoSearchTool', () => {
  it('forwards strict safesearch and formats non-UI output', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveVideoSearchTool(server, mockBraveSearch as unknown as BraveSearch, false);

    mockBraveSearch.videoSearch.mockResolvedValue({
      type: 'video',
      query: { original: 'ts tutorials' },
      results: [
        {
          type: 'video_result',
          title: 'Advanced TypeScript',
          url: 'https://youtube.com/watch?v=ABCDEFGHIJK',
          description: 'Deep dive',
          age: '3 days ago',
          meta_url: { favicon: 'https://youtube.com/favicon.ico' },
          thumbnail: { src: 'https://img.youtube.com/a.jpg', width: 120, height: 90 },
          video: {
            duration: '10:30',
            views: '1200',
            creator: 'TS Channel',
            publisher: 'YouTube',
            thumbnail: { src: 'https://img.youtube.com/a-hq.jpg' },
            requires_subscription: true,
            tags: ['typescript', 'advanced'],
          },
        },
        {
          type: 'video_result',
          title: 'No Extras',
          url: 'https://example.com/video/no-extras',
          description: 'Plain video',
          age: '1 day ago',
          meta_url: {},
          thumbnail: { src: 'https://example.com/no-extras.jpg' },
          video: {
            duration: '05:00',
            views: 42,
            creator: 'Plain Creator',
            publisher: 'Example',
            thumbnail: { src: 'https://example.com/no-extras-thumb.jpg' },
            requires_subscription: false,
          },
        },
      ],
    } as unknown as Awaited<ReturnType<BraveSearch['videoSearch']>>);

    const result = await tool.executeCore({
      query: 'ts tutorials',
      count: 6,
      offset: 1,
      freshness: 'pm',
    });

    expect(mockBraveSearch.videoSearch).toHaveBeenCalledWith('ts tutorials', {
      count: 6,
      offset: 1,
      safesearch: SafeSearchLevel.Strict,
      freshness: 'pm',
    });

    const text = getFirstTextContent(result);
    expect(text).toContain('1: Title: Advanced TypeScript');
    expect(text).toContain('Requires subscription');
    expect(text).toContain('Tags: typescript, advanced');
    expect(text).toContain('2: Title: No Extras');
    expect(text).toContain('Creator: Plain Creator');
  });

  it('returns UI metadata with embed extraction for youtube and vimeo', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveVideoSearchTool(server, mockBraveSearch as unknown as BraveSearch, true);

    mockBraveSearch.videoSearch.mockResolvedValue({
      type: 'video',
      query: { original: 'music videos' },
      results: [
        {
          type: 'video_result',
          title: 'YT clip',
          url: 'https://youtu.be/ABCDEFGHIJK',
          description: 'clip',
          age: '1 hour ago',
          meta_url: { favicon: 'https://youtube.com/favicon.ico' },
          thumbnail: { src: 'https://img.youtube.com/clip.jpg' },
          video: {
            duration: '02:00',
            views: '900',
            creator: 'Creator A',
            publisher: 'YouTube',
            thumbnail: { src: 'https://img.youtube.com/clip-hq.jpg' },
          },
        },
        {
          type: 'video_result',
          title: 'Vimeo clip',
          url: 'https://vimeo.com/123456789',
          description: 'vimeo',
          age: '2 hours ago',
          meta_url: { favicon: 'https://vimeo.com/favicon.ico' },
          thumbnail: { src: 'https://img.vimeo.com/clip.jpg' },
          video: {
            duration: '03:00',
            views: '500',
            creator: 'Creator B',
            publisher: 'Vimeo',
            thumbnail: { src: 'https://img.vimeo.com/clip-hq.jpg' },
          },
        },
      ],
    } as unknown as Awaited<ReturnType<BraveSearch['videoSearch']>>);

    const result = await tool.executeCore({ query: 'music videos', count: 10, offset: 0 });

    const text = getFirstTextContent(result);
    expect(text).toContain('Found 2 videos for "music videos".');
    expect(text).toContain('You CANNOT see the video titles');
    expect(text).toContain('click the + icon');
    const structured = getMetaStructuredContent<VideoStructuredContent>(result);
    expect(structured.returnedCount).toBe(2);
    expect(structured.items[0]).toMatchObject({
      title: 'YT clip',
      embedType: 'youtube',
      embedId: 'ABCDEFGHIJK',
    });
    expect(structured.items[1]).toMatchObject({
      title: 'Vimeo clip',
      embedType: 'vimeo',
      embedId: '123456789',
    });
  });

  it('returns no-results response and UI metadata when empty', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveVideoSearchTool(server, mockBraveSearch as unknown as BraveSearch, true);

    mockBraveSearch.videoSearch.mockResolvedValue({
      type: 'video',
      query: { original: 'none' },
      results: [],
    } as unknown as Awaited<ReturnType<BraveSearch['videoSearch']>>);

    const result = await tool.executeCore({ query: 'none', count: 4, offset: 2 });

    expect(getFirstTextContent(result)).toBe('No video results found for "none"');
    const structured = getMetaStructuredContent<VideoStructuredContent>(result);
    expect(structured).toEqual({
      query: 'none',
      offset: 2,
      count: 4,
      pageSize: 4,
      returnedCount: 0,
      items: [],
    });
    expect((server as unknown as { log: ReturnType<typeof vi.fn> }).log).toHaveBeenCalledWith(
      'No video results found for "none"',
    );
  });

  it('returns structured error payload in UI mode when execute catches', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveVideoSearchTool(server, mockBraveSearch as unknown as BraveSearch, true);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockBraveSearch.videoSearch.mockRejectedValue(new Error('video upstream failed'));
    const result = await tool.execute({ query: 'fail', count: 2 });

    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Error in brave_video_search: video upstream failed' }],
      _meta: {
        structuredContent: {
          query: 'fail',
          count: 2,
          pageSize: 2,
          returnedCount: 0,
          items: [],
          error: 'video upstream failed',
        },
      },
    });
  });
});
