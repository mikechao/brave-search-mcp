/**
 * Type definitions for Local Search Widget
 */

export interface LocalBusinessItem {
  id?: string;
  name: string;
  address: string;
  coordinates?: [number, number]; // [lat, lng]
  phone?: string;
  email?: string;
  priceRange?: string;
  rating?: number;
  reviewCount?: number;
  cuisine?: string[];
  todayHours?: string;
  weeklyHours?: string;
  description?: string;
}

export interface LocalSearchData {
  query: string;
  count: number;
  items: LocalBusinessItem[];
  fallbackToWeb?: boolean;
  error?: string;
}
