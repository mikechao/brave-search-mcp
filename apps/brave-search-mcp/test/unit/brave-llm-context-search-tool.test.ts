import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../../src/server.js';
import { describe, expect, it, vi } from 'vitest';
import { BraveLLMContextSearchTool } from '../../src/tools/BraveLLMContextSearchTool.js';
import { createMockBraveSearch } from '../mocks/index.js';
import { getFirstTextContent } from './tool-result-helpers.js';

function createServerStub() {
  return {
    log: vi.fn(),
  } as unknown as BraveMcpServer;
}

describe('braveLLMContextSearchTool', () => {
  it('uses compact mode by default and clamps request limits', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveLLMContextSearchTool(server, mockBraveSearch as unknown as BraveSearch, false);

    mockBraveSearch.llmContextSearch.mockResolvedValue({
      grounding: {
        generic: [
          {
            title: 'Banana science',
            url: 'https://example.com/banana',
            snippets: ['Bananas turn yellow as chlorophyll breaks down.'],
          },
        ],
      },
      sources: {
        'https://example.com/banana': {
          title: 'Banana science',
          hostname: 'example.com',
          age: ['Monday, January 01, 2024'],
        },
      },
    } as Awaited<ReturnType<BraveSearch['llmContextSearch']>>);

    const result = await tool.executeCore({
      query: 'why are bananas yellow',
      count: 30,
      maximumNumberOfUrls: 30,
      maximumNumberOfTokens: 12000,
      maximumNumberOfSnippets: 80,
      maximumNumberOfTokensPerUrl: 4096,
      maximumNumberOfSnippetsPerUrl: 10,
    });

    expect(mockBraveSearch.llmContextSearch).toHaveBeenCalledWith('why are bananas yellow', {
      count: 8,
      maximum_number_of_urls: 8,
      maximum_number_of_tokens: 2048,
      maximum_number_of_snippets: 16,
      maximum_number_of_tokens_per_url: 512,
      maximum_number_of_snippets_per_url: 2,
      context_threshold_mode: 'strict',
    });

    const text = getFirstTextContent(result);
    const parsedLine = JSON.parse(text);
    expect(parsedLine).toEqual({
      title: 'Banana science',
      url: 'https://example.com/banana',
      age: 'Monday, January 01, 2024',
      snippets: ['Bananas turn yellow as chlorophyll breaks down.'],
    });
  });

  it('filters noisy snippets, deduplicates, and truncates in compact mode', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveLLMContextSearchTool(server, mockBraveSearch as unknown as BraveSearch, false);

    mockBraveSearch.llmContextSearch.mockResolvedValue({
      grounding: {
        generic: [
          {
            title: 'Banana ripening',
            url: 'https://example.com/ripening',
            snippets: [
              '{"@graph": [{"@type":"Organization","name":"Example"}]}',
              'Table of Contents (click to expand)',
              '*[Image: Banana ripeness]* Bananas turn yellow when chlorophyll degrades and yellow pigments become visible.',
              'Bananas turn yellow when chlorophyll degrades and yellow pigments become visible.',
              'Bananas turn yellow when chlorophyll degrades and yellow pigments become visible as ethylene changes fruit chemistry over time and starches convert to sugars.',
            ],
          },
        ],
      },
      sources: {},
    } as Awaited<ReturnType<BraveSearch['llmContextSearch']>>);

    const result = await tool.executeCore({
      query: 'why bananas turn yellow',
      maxSnippetChars: 90,
      maximumNumberOfSnippetsPerUrl: 8,
    });

    const text = getFirstTextContent(result);
    const parsed = JSON.parse(text);
    expect(parsed.snippets.length).toBeGreaterThan(0);
    expect(parsed.snippets.length).toBeLessThanOrEqual(2);
    for (const snippet of parsed.snippets as string[]) {
      expect(snippet.length).toBeLessThanOrEqual(90);
      expect(snippet.toLowerCase()).not.toContain('@graph');
      expect(snippet.toLowerCase()).not.toContain('table of contents');
    }
  });

  it('enforces compact output budget', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveLLMContextSearchTool(server, mockBraveSearch as unknown as BraveSearch, false);

    mockBraveSearch.llmContextSearch.mockResolvedValue({
      grounding: {
        generic: [
          {
            title: 'A',
            url: 'https://example.com/a',
            snippets: ['Bananas become yellow as chlorophyll breaks down.'],
          },
          {
            title: 'B',
            url: 'https://example.com/b',
            snippets: ['Ethylene helps drive ripening and color transition in bananas.'],
          },
        ],
      },
      sources: {},
    } as Awaited<ReturnType<BraveSearch['llmContextSearch']>>);

    const result = await tool.executeCore({
      query: 'banana ripening',
      maxOutputChars: 140,
    });

    const text = getFirstTextContent(result);
    expect(text.length).toBeLessThanOrEqual(140);
    expect(text.split('\n')).toHaveLength(1);
  });

  it('supports full mode with raw snippet payloads', async () => {
    const mockBraveSearch = createMockBraveSearch();
    const server = createServerStub();
    const tool = new BraveLLMContextSearchTool(server, mockBraveSearch as unknown as BraveSearch, false);

    mockBraveSearch.llmContextSearch.mockResolvedValue({
      grounding: {
        generic: [
          {
            title: 'Raw source',
            url: 'https://example.com/raw',
            snippets: ['{"foo":"bar"}', 'plain text snippet'],
          },
        ],
      },
      sources: {},
    } as Awaited<ReturnType<BraveSearch['llmContextSearch']>>);

    const result = await tool.executeCore({
      query: 'banana',
      responseMode: 'full',
    });

    const text = getFirstTextContent(result);
    const parsed = JSON.parse(text);
    expect(parsed.snippets[0]).toEqual({ foo: 'bar' });
    expect(parsed.snippets[1]).toBe('plain text snippet');
  });
});
