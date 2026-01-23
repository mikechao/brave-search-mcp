/**
 * Type definitions for News Search Widget
 */

export interface NewsItem {
  title: string;
  url: string;
  description: string;
  source: string;
  age: string;
  breaking: boolean;
  thumbnail?: {
    src: string;
    height?: number;
    width?: number;
  };
  favicon?: string;
}

export interface NewsSearchData {
  query: string;
  count: number;
  offset?: number;
  items: NewsItem[];
  error?: string;
}

export interface ContextArticle {
  title: string;
  source: string;
  age: string;
  url: string;
}
