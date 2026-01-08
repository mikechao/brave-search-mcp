// Copyright (C) 2024 Erik Balfe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import axios from "axios";

const DEFAULT_POLLING_INTERVAL = 500;
const DEFAULT_MAX_POLL_ATTEMPTS = 20;

import {
  BraveSearchOptions,
  ImageSearchApiResponse,
  ImageSearchOptions,
  LocalDescriptionsSearchApiResponse,
  LocalPoiSearchApiResponse,
  NewsSearchApiResponse,
  NewsSearchOptions,
  PollingOptions,
  SummarizerOptions,
  SummarizerSearchApiResponse,
  WebSearchApiResponse,
} from "./types";

/**
 * An error class specific to BraveSearch API interactions.
 * It includes additional information about the response data that caused the error.
 */
class BraveSearchError extends Error {
  public responseData: any;

  /**
   * Initializes a new instance of the BraveSearchError class.
   * @param message The error message.
   * @param responseData The response data that caused the error.
   */
  constructor(message: string, responseData?: any) {
    super(message);
    this.name = "BraveSearchError";
    this.responseData = responseData;
  }
}

/**
 * The main class for interacting with the Brave Search API, holding API key for all the requests made with it.
 * It provides methods for web search, image search, local POI search, and summarization.
 */
class BraveSearch {
  private apiKey: string;
  private baseUrl = "https://api.search.brave.com/res/v1";
  private pollInterval: number;
  private maxPollAttempts: number;

  /**
   * Initializes a new instance of the BraveSearch class.
   * @param apiKey The API key for accessing the Brave Search API.
   * @param options
   */
  constructor(apiKey: string, options?: PollingOptions) {
    this.apiKey = apiKey;
    this.pollInterval = options?.pollInterval ?? DEFAULT_POLLING_INTERVAL;
    this.maxPollAttempts = options?.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
  }

  /**
   * Performs a web search using the provided query and options.
   * @param query The search query string.
   * @param options Optional settings to configure the search behavior.
   * @returns A promise that resolves to the search results.
   */
  async webSearch(
    query: string,
    options: BraveSearchOptions = {},
    signal?: AbortSignal,
  ): Promise<WebSearchApiResponse> {
    try {
      const response = await axios.get<WebSearchApiResponse>(
        `${this.baseUrl}/web/search`,
        {
          params: {
            q: query,
            ...this.formatOptions(options),
          },
          headers: this.getHeaders(),
          signal,
        },
      );
      return response.data;
    } catch (error) {
      const handledError = this.handleApiError(error);
      throw handledError;
    }
  }

  /**
   * Performs an image search using the provided query and options.
   * @param query The search query string.
   * @param options Optional settings to configure the search behavior.
   * @returns A promise that resolves to the image search results.
   */
  async imageSearch(
    query: string,
    options: ImageSearchOptions = {},
    signal?: AbortSignal,
  ): Promise<ImageSearchApiResponse> {
    try {
      const response = await axios.get<ImageSearchApiResponse>(
        `${this.baseUrl}/images/search`,
        {
          params: {
            q: query,
            ...this.formatOptions(options),
          },
          headers: this.getHeaders(),
          signal,
        }
      )
      return response.data;
    } catch (error) {
      const handledError = this.handleApiError(error);
      throw handledError;
    }
  }

  async newsSearch(
    query: string,
    options: NewsSearchOptions = {},
    signal?: AbortSignal,
  ) : Promise<NewsSearchApiResponse> {
    try {
      const response = await axios.get<NewsSearchApiResponse>(
        `${this.baseUrl}/news/search?`,
        {
          params: {
            q: query,
            ...this.formatOptions(options),
          },
          headers: this.getHeaders(),
          signal,
        },
      );
      return response.data;
    } catch (error) {
      const handledError = this.handleApiError(error);
      throw handledError;
    }
  }

  /**
   * Executes a web search for the provided query and polls for a summary
   * if the query is eligible for a summary and summarizer key is provided in the web search response.
   * The summary is usually ready within 2 seconds after the original web search response is received.
   * @param query The search query string.
   * @param options Optional settings to configure the search behavior.
   * @param summarizerOptions Optional settings specific to summarization.
   * @returns An object containing promises for the web search results and the summarized answer.
   */
  getSummarizedAnswer(
    query: string,
    options: Omit<BraveSearchOptions, "summary"> = {},
    summarizerOptions: SummarizerOptions = {},
    signal?: AbortSignal,
  ): {
    summary: Promise<SummarizerSearchApiResponse | undefined>;
    webSearch: Promise<WebSearchApiResponse>;
  } {
    try {
      const webSearchResponse = this.webSearch(query, options, signal);
      const summaryPromise = webSearchResponse.then(async (webSearchResponse) => {
        const summarizerKey = webSearchResponse.summarizer?.key;

        if (summarizerKey) {
          return await this.pollForSummary(summarizerKey, summarizerOptions, signal);
        }

        return undefined;
      });

      return { webSearch: webSearchResponse, summary: summaryPromise };
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Searches for local points of interest using the provided IDs and options.
   * @param ids The IDs of the local points of interest.
   * @returns A promise that resolves to the search results.
   */
  async localPoiSearch(ids: string[], signal?: AbortSignal): Promise<LocalPoiSearchApiResponse> {
    try {
      const response = await axios.get<LocalPoiSearchApiResponse>(
        `${this.baseUrl}/local/pois`,
        {
          params: {
            ids: ids.join(","),
          },
          headers: this.getHeaders(),
          signal,
        },
      );
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Retrieves descriptions for local points of interest using the provided IDs and options.
   * @param ids The IDs of the local points of interest.
   * @returns A promise that resolves to the search results.
   */
  async localDescriptionsSearch(
    ids: string[],
    signal?: AbortSignal,
  ): Promise<LocalDescriptionsSearchApiResponse> {
    try {
      const response = await axios.get<LocalDescriptionsSearchApiResponse>(
        `${this.baseUrl}/local/descriptions`,
        {
          params: {
            ids: ids.join(","),
          },
          headers: this.getHeaders(),
          signal,
        },
      );
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Polls for a summary response after a web search request. This method is suggested by the Brave Search API documentation
   * as the way to retrieve a summary after initiating a web search.
   *
   * @param key The key identifying the summary request.
   * @param options Optional settings specific to summarization.
   * @param signal Optional AbortSignal to cancel the request.
   * @returns A promise that resolves to the summary response if available, or undefined if the summary is not ready.
   * @throws {BraveSearchError} If the summary generation fails or if the summary is not available after maximum polling attempts.
   *
   * **Polling Behavior:**
   * - The method will make up to 20 attempts to fetch the summary by default.
   * - Each attempt is spaced 500ms apart.
   * - If the summary is not ready after 20 attempts, a BraveSearchError is thrown.
   *
   * **Configuration:**
   * - The number of attempts and the interval between attempts can be configured through the class constructor options.
   */
  private async pollForSummary(
    key: string,
    options: SummarizerOptions,
    signal?: AbortSignal,
  ): Promise<SummarizerSearchApiResponse | undefined> {
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      const summaryResponse = await this.summarizerSearch(key, options, signal);

      if (summaryResponse.status === "complete" && summaryResponse.summary) {
        return summaryResponse;
      } else if (summaryResponse.status === "failed") {
        throw new BraveSearchError("Summary generation failed");
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
    }

    throw new BraveSearchError("Summary not available after maximum polling attempts");
  }

  private async summarizerSearch(
    key: string,
    options: SummarizerOptions,
    signal?: AbortSignal,
  ): Promise<SummarizerSearchApiResponse> {
    try {
      const response = await axios.get<SummarizerSearchApiResponse>(
        `${this.baseUrl}/summarizer/search`,
        {
          params: {
            key,
            ...this.formatOptions(options),
          },
          headers: this.getHeaders(),
          signal,
        },
      );
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  private getHeaders() {
    return {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": this.apiKey,
    };
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

  private handleApiError(error: any): BraveSearchError {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      const responseData = error.response?.data;

      if (status === 429) {
        return new BraveSearchError(`Rate limit exceeded: ${message}`, responseData);
      } else if (status === 401) {
        return new BraveSearchError(`Authentication error: ${message}`, responseData);
      } else {
        return new BraveSearchError(`API error (${status}): ${message}`, responseData);
      }
    }
    return new BraveSearchError(`Unexpected error: ${error.message}`);
  }
}

export {
  BraveSearch,
  BraveSearchError,
  type BraveSearchOptions,
  type ImageSearchOptions,
  type LocalDescriptionsSearchApiResponse,
  type LocalPoiSearchApiResponse,
  type SummarizerOptions,
  type SummarizerSearchApiResponse,
  type WebSearchApiResponse,
  type ImageSearchApiResponse,
  type NewsSearchApiResponse,
  type NewsSearchOptions,
};
