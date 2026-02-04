/**
 * Type definitions for Video Search Widget
 */

export interface VideoItem {
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
}

export interface VideoSearchData {
  query: string;
  count: number;
  pageSize?: number;
  returnedCount?: number;
  offset?: number;
  items: VideoItem[];
  error?: string;
}

export interface ContextVideo {
  title: string;
  creator: string;
  duration: string;
  url: string;
}
