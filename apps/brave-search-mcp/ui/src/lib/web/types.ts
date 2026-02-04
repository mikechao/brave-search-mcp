/**
 * Type definitions for Web Search Widget
 */

export interface WebResultItem {
  title: string;
  url: string;
  description: string;
  domain: string;
  favicon?: string;
  age?: string;
  thumbnail?: { src: string; height?: number; width?: number };
}

export interface WebSearchData {
  query: string;
  count: number;
  pageSize?: number;
  returnedCount?: number;
  offset?: number;
  items: WebResultItem[];
  error?: string;
}

export interface ContextResult {
  title: string;
  url: string;
  description: string;
  domain: string;
}
