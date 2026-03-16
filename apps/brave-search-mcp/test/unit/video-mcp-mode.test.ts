import type { VideoSearchAppProps } from '../../ui/src/lib/video/VideoSearchApp.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOL_NAMES } from '../../src/tool-catalog.js';

const mockState = vi.hoisted(() => {
  const updateModelContextMock = vi.fn().mockResolvedValue(undefined);
  const callServerToolMock = vi.fn().mockResolvedValue({
    _meta: {
      structuredContent: {
        query: 'typescript videos',
        count: 10,
        pageSize: 10,
        returnedCount: 1,
        offset: 1,
        items: [
          {
            title: 'Page 2 video',
            url: 'https://example.com/video-2',
            description: 'Second page result',
            duration: '5:00',
            views: '2000',
            creator: 'Example Creator',
            age: '1 day ago',
          },
        ],
      },
    },
  });

  return {
    capturedProps: null as VideoSearchAppProps | null,
    updateModelContextMock,
    callServerToolMock,
    useMcpAppReturn: {
      app: {
        updateModelContext: updateModelContextMock,
      },
      error: null,
      toolInputs: { query: 'typescript videos' },
      toolInputsPartial: null,
      toolResult: {
        _meta: {
          structuredContent: {
            query: 'typescript videos',
            count: 10,
            pageSize: 10,
            returnedCount: 2,
            offset: 0,
            items: [
              {
                title: 'Video One',
                url: 'https://example.com/video-1',
                description: 'First result',
                duration: '10:00',
                views: '1000',
                creator: 'Code Channel',
                age: '2 days ago',
              },
              {
                title: 'Video Two',
                url: 'https://example.com/video-2',
                description: 'Second result',
                duration: '8:00',
                views: '900',
                creator: 'Build Channel',
                age: '3 days ago',
              },
            ],
          },
        },
      },
      hostContext: {
        availableDisplayModes: ['inline', 'fullscreen', 'pip'],
      },
      callServerTool: callServerToolMock,
      sendMessage: vi.fn(),
      openLink: vi.fn(async () => ({ isError: false })),
      sendLog: vi.fn(async () => {}),
      requestDisplayMode: vi.fn(async () => 'inline'),
    },
  };
});

vi.mock('../../ui/src/hooks/useMcpApp.js', () => {
  return {
    useMcpApp: vi.fn(() => mockState.useMcpAppReturn),
  };
});

vi.mock('../../ui/src/lib/video/VideoSearchApp.js', () => {
  return {
    default: (props: VideoSearchAppProps) => {
      mockState.capturedProps = props;
      return null;
    },
  };
});

async function importVideoMcpMode() {
  const module = await import('../../ui/src/lib/video/video-mcp-mode.js');
  return module.default;
}

describe('videoMcpMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockState.capturedProps = null;
    mockState.callServerToolMock.mockResolvedValue({
      _meta: {
        structuredContent: {
          query: 'typescript videos',
          count: 10,
          pageSize: 10,
          returnedCount: 1,
          offset: 1,
          items: [
            {
              title: 'Page 2 video',
              url: 'https://example.com/video-2',
              description: 'Second page result',
              duration: '5:00',
              views: '2000',
              creator: 'Example Creator',
              age: '1 day ago',
            },
          ],
        },
      },
    });
    mockState.updateModelContextMock.mockResolvedValue(undefined);
    mockState.useMcpAppReturn = {
      ...mockState.useMcpAppReturn,
      app: {
        updateModelContext: mockState.updateModelContextMock,
      },
      error: null,
      toolInputs: { query: 'typescript videos' },
      toolInputsPartial: null,
      toolResult: {
        _meta: {
          structuredContent: {
            query: 'typescript videos',
            count: 10,
            pageSize: 10,
            returnedCount: 2,
            offset: 0,
            items: [
              {
                title: 'Video One',
                url: 'https://example.com/video-1',
                description: 'First result',
                duration: '10:00',
                views: '1000',
                creator: 'Code Channel',
                age: '2 days ago',
              },
            ],
          },
        },
      },
      hostContext: {
        availableDisplayModes: ['inline', 'fullscreen', 'pip'],
      },
    };
  });

  it('passes pagination and context callbacks to VideoSearchApp in MCP mode', async () => {
    const VideoMcpMode = await importVideoMcpMode();

    renderToStaticMarkup(createElement(VideoMcpMode));

    expect(mockState.capturedProps).toBeTruthy();
    expect(mockState.capturedProps?.availableDisplayModes).toEqual(['inline', 'fullscreen', 'pip']);
    expect(mockState.capturedProps?.displayMode).toBe('inline');
    expect(mockState.capturedProps?.isInitialLoading).toBe(false);
    expect(mockState.capturedProps?.loadingQuery).toBe('typescript videos');
    expect(mockState.capturedProps?.contextVideos).toEqual([]);
    expect(mockState.capturedProps?.isLoading).toBe(false);
    expect(mockState.capturedProps?.onLoadPage).toBeTypeOf('function');
    expect(mockState.capturedProps?.onContextChange).toBeTypeOf('function');
  });

  it(`loads another page through ${TOOL_NAMES.video}`, async () => {
    const VideoMcpMode = await importVideoMcpMode();

    renderToStaticMarkup(createElement(VideoMcpMode));

    const onLoadPage = mockState.capturedProps?.onLoadPage;
    expect(onLoadPage).toBeTypeOf('function');
    if (!onLoadPage) {
      throw new TypeError('Expected onLoadPage callback');
    }

    await onLoadPage(1);

    expect(mockState.callServerToolMock).toHaveBeenCalledWith({
      name: TOOL_NAMES.video,
      arguments: {
        query: 'typescript videos',
        count: 10,
        offset: 1,
      },
    });
  });

  it('updates model context when selected videos change', async () => {
    const VideoMcpMode = await importVideoMcpMode();

    renderToStaticMarkup(createElement(VideoMcpMode));

    const onContextChange = mockState.capturedProps?.onContextChange;
    expect(onContextChange).toBeTypeOf('function');
    if (!onContextChange) {
      throw new TypeError('Expected onContextChange callback');
    }

    onContextChange([
      {
        title: 'Video One',
        creator: 'Code Channel',
        duration: '10:00',
        url: 'https://example.com/video-1',
      },
    ]);

    expect(mockState.updateModelContextMock).toHaveBeenCalledWith({
      content: [
        {
          type: 'text',
          text: '1: Title: Video One\nURL: https://example.com/video-1\nDuration: 10:00\nCreator: Code Channel',
        },
      ],
    });
  });
});
