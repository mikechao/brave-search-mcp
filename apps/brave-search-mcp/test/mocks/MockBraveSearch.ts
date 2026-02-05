import type {
  ImageSearchApiResponse,
  LocalDescriptionsSearchApiResponse,
  LocalPoiSearchApiResponse,
  NewsSearchApiResponse,
  VideoSearchApiResponse,
  WebSearchApiResponse,
} from 'brave-search';
import { vi } from 'vitest';

/**
 * Mock implementation of BraveSearch for testing.
 * All methods are vi.fn() spies that return configurable mock data.
 */
export class MockBraveSearch {
  webSearch = vi.fn();
  imageSearch = vi.fn();
  newsSearch = vi.fn();
  videoSearch = vi.fn();
  localPoiSearch = vi.fn();
  localDescriptionsSearch = vi.fn();
  getSummarizedAnswer = vi.fn();

  /**
   * Resets all mock functions to their initial state.
   * Call this in beforeEach() to ensure test isolation.
   */
  reset(): void {
    this.webSearch.mockReset();
    this.imageSearch.mockReset();
    this.newsSearch.mockReset();
    this.videoSearch.mockReset();
    this.localPoiSearch.mockReset();
    this.localDescriptionsSearch.mockReset();
    this.getSummarizedAnswer.mockReset();
  }
}

/**
 * Factory function to create a MockBraveSearch with common default responses.
 * Customize the returned mock as needed for specific tests.
 */
export function createMockBraveSearch(): MockBraveSearch {
  const mock = new MockBraveSearch();

  // Set up default mock responses
  mock.webSearch.mockResolvedValue({
    query: { original: 'test query' },
    web: {
      results: [
        {
          title: 'Test Result 1',
          url: 'https://example.com/1',
          description: 'This is the first test result',
        },
        {
          title: 'Test Result 2',
          url: 'https://example.com/2',
          description: 'This is the second test result',
        },
      ],
    },
  } as WebSearchApiResponse);

  mock.imageSearch.mockResolvedValue({
    query: { original: 'test image query' },
    results: [
      {
        title: 'Test Image 1',
        url: 'https://example.com/image1.jpg',
        thumbnail: { src: 'https://example.com/thumb1.jpg' },
      },
    ],
  } as ImageSearchApiResponse);

  mock.newsSearch.mockResolvedValue({
    query: { original: 'test news query' },
    results: [
      {
        title: 'Test News Article',
        url: 'https://news.example.com/article1',
        description: 'Breaking news for testing',
        age: '2 hours ago',
      },
    ],
  } as NewsSearchApiResponse);

  mock.videoSearch.mockResolvedValue({
    query: { original: 'test video query' },
    results: [
      {
        title: 'Test Video',
        url: 'https://youtube.com/watch?v=test123',
        description: 'A test video',
        thumbnail: { src: 'https://i.ytimg.com/vi/test123/default.jpg' },
      },
    ],
  } as VideoSearchApiResponse);

  mock.localPoiSearch.mockResolvedValue({
    type: 'local_pois',
    results: [],
  } as LocalPoiSearchApiResponse);

  mock.localDescriptionsSearch.mockResolvedValue({
    type: 'local_descriptions',
    results: [],
  } as LocalDescriptionsSearchApiResponse);

  return mock;
}
