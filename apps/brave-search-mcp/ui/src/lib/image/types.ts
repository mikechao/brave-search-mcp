/**
 * Type definitions for Image Search Widget
 */

export interface ImageItem {
    title: string;
    pageUrl: string;
    imageUrl: string;
    source: string;
    confidence?: string;
    width?: number;
    height?: number;
}

export interface ImageSearchData {
    searchTerm: string;
    count: number;
    items: ImageItem[];
    error?: string;
}
