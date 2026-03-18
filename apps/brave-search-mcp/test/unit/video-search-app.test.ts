// @vitest-environment jsdom

import type { Root } from 'react-dom/client';
import type { VideoSearchAppProps } from '../../ui/src/lib/video/VideoSearchApp.js';
import type { DisplayMode } from '../../ui/src/widget-props.js';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VideoSearchApp from '../../ui/src/lib/video/VideoSearchApp.js';

function createRequestDisplayModeMock() {
  return vi.fn<(mode: DisplayMode) => Promise<DisplayMode | undefined>>(async () => 'pip');
}

function createProps(overrides: Partial<VideoSearchAppProps> = {}): VideoSearchAppProps {
  return {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: {
      structuredContent: {
        query: 'typescript videos',
        count: 1,
        items: [
          {
            title: 'TypeScript in Practice',
            url: 'https://example.com/video-1',
            description: 'Learn TypeScript',
            duration: '10:00',
            views: '1000',
            creator: 'Code Channel',
            age: '2 days ago',
            embedId: 'abc123xyz89',
            embedType: 'youtube',
          },
        ],
      },
    },
    hostContext: null,
    openLink: vi.fn(async () => ({ isError: false })),
    sendLog: vi.fn(async () => {}),
    displayMode: 'fullscreen',
    requestDisplayMode: createRequestDisplayModeMock(),
    availableDisplayModes: ['inline', 'fullscreen', 'pip'],
    ...overrides,
  };
}

describe('videoSearchApp', () => {
  let container: HTMLDivElement;
  let root: Root;
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  async function renderApp(props: VideoSearchAppProps) {
    await act(async () => {
      root.render(createElement(VideoSearchApp, props));
    });
  }

  async function clickVideoCard() {
    const card = container.querySelector('.video-card');
    if (!(card instanceof HTMLButtonElement))
      throw new TypeError('Expected .video-card button to exist');

    await act(async () => {
      card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  async function flushDeferredWork() {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    document.body.innerHTML = '';
  });

  it('falls back to the modal when a PiP request does not actually enter pip mode', async () => {
    const requestDisplayMode = createRequestDisplayModeMock();
    const props = createProps({
      displayMode: 'fullscreen',
      requestDisplayMode,
    });

    await renderApp(props);
    await clickVideoCard();
    await flushDeferredWork();
    await renderApp({
      ...props,
      displayMode: 'fullscreen',
    });
    await flushDeferredWork();

    expect(requestDisplayMode).toHaveBeenCalledWith('pip');
    expect(container.querySelector('.video-modal-backdrop')).not.toBeNull();
    expect(container.querySelector('.video-pip-container')).toBeNull();
  });

  it('renders the PiP view when displayMode becomes pip', async () => {
    const requestDisplayMode = createRequestDisplayModeMock();
    const props = createProps({
      displayMode: 'fullscreen',
      requestDisplayMode,
    });

    await renderApp(props);
    await clickVideoCard();
    await renderApp({
      ...props,
      displayMode: 'pip',
    });
    await flushDeferredWork();

    expect(requestDisplayMode).toHaveBeenCalledWith('pip');
    expect(container.querySelector('.video-pip-container')).not.toBeNull();
    expect(container.querySelector('.video-modal-backdrop')).toBeNull();
  });

  it('disables next pagination when Brave says no more results are available', async () => {
    const props = createProps({
      toolResult: {
        structuredContent: {
          query: 'typescript videos',
          count: 1,
          pageSize: 1,
          returnedCount: 1,
          offset: 0,
          moreResultsAvailable: false,
          items: [
            {
              title: 'TypeScript in Practice',
              url: 'https://example.com/video-1',
              description: 'Learn TypeScript',
              duration: '10:00',
              views: '1000',
              creator: 'Code Channel',
              age: '2 days ago',
              embedId: 'abc123xyz89',
              embedType: 'youtube',
            },
          ],
        },
      },
      onLoadPage: vi.fn(async () => {}),
    });

    await renderApp(props);

    const nextButton = container.querySelector('button[aria-label="Next page"]');
    if (!(nextButton instanceof HTMLButtonElement))
      throw new TypeError('Expected Next page button to exist');

    expect(nextButton.hasAttribute('disabled')).toBe(true);
  });
});
