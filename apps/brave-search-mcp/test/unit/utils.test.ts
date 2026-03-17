import { describe, expect, it } from 'vitest';
import { formatPoiResults, formatVideoResults } from '../../src/utils.js';

describe('utils', () => {
  describe('formatPoiResults', () => {
    it('formats POI results with matched descriptions and fallback fields', () => {
      const poiData = {
        type: 'local_pois',
        results: [
          {
            type: 'location_result',
            id: 'poi-1',
            title: 'Sunrise Cafe',
            url: 'https://example.com/sunrise-cafe',
            description: 'Cafe details',
            family_friendly: true,
            provider_url: 'https://maps.example.com/sunrise-cafe',
            coordinates: [37.7749, -122.4194],
            zoom_level: 12,
            postal_address: {
              type: 'PostalAddress',
              country: 'US',
              postalCode: '94103',
              streetAddress: '123 Market St',
              addressRegion: 'CA',
              addressLocality: 'San Francisco',
              displayAddress: '123 Market St, San Francisco, CA 94103',
            },
            contact: {
              telephone: '555-123-4567',
              email: 'hello@sunrise.example',
            },
            price_range: '$$',
            rating: {
              ratingValue: 4.7,
              bestRating: 5,
              reviewCount: 128,
            },
            serves_cuisine: ['Cafe', 'Bakery'],
            opening_hours: {
              current_day: [
                {
                  abbr_name: 'Mon',
                  full_name: 'Monday',
                  opens: '08:00',
                  closes: '17:00',
                },
              ],
              days: [
                [
                  {
                    abbr_name: 'Mon',
                    full_name: 'Monday',
                    opens: '08:00',
                    closes: '17:00',
                  },
                ],
              ],
            },
          },
          {
            type: 'location_result',
            id: 'poi-2',
            title: 'Mystery Spot',
            url: 'https://example.com/mystery-spot',
            description: 'No metadata',
            family_friendly: true,
            provider_url: 'https://maps.example.com/mystery-spot',
            postal_address: {
              type: 'PostalAddress',
              country: 'US',
              postalCode: '10001',
              streetAddress: '456 Unknown Rd',
              addressRegion: 'NY',
              addressLocality: 'New York',
              displayAddress: '456 Unknown Rd, New York, NY 10001',
            },
          },
        ],
      } as Parameters<typeof formatPoiResults>[0];

      const poiDescriptions = {
        type: 'local_descriptions',
        results: [
          {
            type: 'local_description',
            id: 'poi-1',
            description: 'Known for fresh pastries and coffee.',
          },
        ],
      } as Parameters<typeof formatPoiResults>[1];

      const formatted = formatPoiResults(poiData, poiDescriptions);

      expect(formatted).toHaveLength(2);

      expect(formatted[0]).toContain('Name: Sunrise Cafe');
      expect(formatted[0]).toContain('Cuisine: Cafe, Bakery');
      expect(formatted[0]).toContain('Address: 123 Market St, San Francisco, CA 94103');
      expect(formatted[0]).toContain('Coordinates: 37.7749, -122.4194');
      expect(formatted[0]).toContain('Phone: 555-123-4567');
      expect(formatted[0]).toContain('Email: hello@sunrise.example');
      expect(formatted[0]).toContain('Price Range: $$');
      expect(formatted[0]).toContain('Ratings: 4.7 (128) reviews');
      expect(formatted[0]).toContain('Today: Monday 08:00 - 17:00');
      expect(formatted[0]).toContain('Description: Known for fresh pastries and coffee.');

      expect(formatted[1]).toContain('Name: Mystery Spot');
      expect(formatted[1]).not.toContain('Coordinates:');
      expect(formatted[1]).toContain('Phone: No phone number found');
      expect(formatted[1]).toContain('Email: No email found');
      expect(formatted[1]).toContain('Price Range: No price range found');
      expect(formatted[1]).toContain('Hours:\n No opening hours found');
      expect(formatted[1]).toContain('Description: No description found');
    });

    it('formats opening hours correctly with multiple time slots per day', () => {
      const poiData = {
        type: 'local_pois',
        results: [
          {
            type: 'location_result',
            id: 'poi-multi-slots',
            title: 'Lunch Bistro',
            postal_address: {
              type: 'PostalAddress',
              displayAddress: '123 Main St',
            },
            opening_hours: {
              current_day: [
                {
                  abbr_name: 'Mon',
                  full_name: 'Monday',
                  opens: '09:00',
                  closes: '12:00',
                },
                {
                  abbr_name: 'Mon',
                  full_name: 'Monday',
                  opens: '13:00',
                  closes: '17:00',
                },
              ],
              days: [
                [
                  {
                    abbr_name: 'Mon',
                    full_name: 'Monday',
                    opens: '09:00',
                    closes: '12:00',
                  },
                  {
                    abbr_name: 'Mon',
                    full_name: 'Monday',
                    opens: '13:00',
                    closes: '17:00',
                  },
                ],
                [
                  {
                    abbr_name: 'Tue',
                    full_name: 'Tuesday',
                    opens: '10:00',
                    closes: '14:00',
                  },
                ],
              ],
            },
          },
        ],
      } as Parameters<typeof formatPoiResults>[0];

      const poiDescriptions = {
        type: 'local_descriptions',
        results: [],
      } as Parameters<typeof formatPoiResults>[1];

      const formatted = formatPoiResults(poiData, poiDescriptions);

      expect(formatted).toHaveLength(1);
      const hoursText = formatted[0];

      // Before the fix, the Today section contains array coercion artifacts:
      // "Today: Monday 09:00 - 12:00\n,Monday 13:00 - 17:00"
      // After the fix, clean inline format:
      // "Today: Monday 09:00 - 12:00, Monday 13:00 - 17:00"
      expect(hoursText).not.toContain('Monday 09:00 - 12:00\n,Monday 13:00 - 17:00');
      expect(hoursText).toContain('Today: Monday 09:00 - 12:00, Monday 13:00 - 17:00');

      // Weekly section should have one line per day with proper spacing
      // The template returns \nWeekly:\n followed by lines joined with \n
      expect(hoursText).toContain('Weekly:\nMonday 09:00 - 12:00, Monday 13:00 - 17:00\nTuesday 10:00 - 14:00');
      // No missing spaces after commas in multi-slot days
      expect(hoursText).not.toContain('Monday 09:00 - 12:00,Monday 13:00');
    });
  });

  describe('formatPoiResults edge cases', () => {
    it('handles missing postal_address gracefully', () => {
      const poiData = {
        type: 'local_pois',
        results: [{
          type: 'location_result',
          id: 'poi-no-address',
          title: 'No Address Place',
          // postal_address is intentionally missing
        }],
      } as Parameters<typeof formatPoiResults>[0];

      const poiDescriptions = {
        type: 'local_descriptions',
        results: [],
      } as Parameters<typeof formatPoiResults>[1];

      // Should not crash
      const formatted = formatPoiResults(poiData, poiDescriptions);
      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toContain('Address: No address found');
    });

    it('displays 0-star ratings correctly', () => {
      const poiData = {
        type: 'local_pois',
        results: [{
          type: 'location_result',
          id: 'poi-zero-rating',
          title: 'Zero Star Place',
          postal_address: { displayAddress: '123 Main St' },
          rating: { ratingValue: 0, reviewCount: 5 },
        }],
      } as Parameters<typeof formatPoiResults>[0];

      const poiDescriptions = {
        type: 'local_descriptions',
        results: [],
      } as Parameters<typeof formatPoiResults>[1];

      const formatted = formatPoiResults(poiData, poiDescriptions);
      expect(formatted[0]).toContain('Ratings: 0 (5) reviews');
      expect(formatted[0]).not.toContain('N/A');
    });

    it('handles undefined reviewCount gracefully', () => {
      const poiData = {
        type: 'local_pois',
        results: [{
          type: 'location_result',
          id: 'poi-no-reviews',
          title: 'No Reviews Place',
          postal_address: { displayAddress: '123 Main St' },
          rating: { ratingValue: 4.5 }, // reviewCount is missing
        }],
      } as Parameters<typeof formatPoiResults>[0];

      const poiDescriptions = {
        type: 'local_descriptions',
        results: [],
      } as Parameters<typeof formatPoiResults>[1];

      const formatted = formatPoiResults(poiData, poiDescriptions);
      expect(formatted[0]).toContain('Ratings: 4.5 (0) reviews');
      expect(formatted[0]).not.toContain('undefined');
    });
  });

  describe('formatVideoResults', () => {
    it('formats video results and handles optional fields', () => {
      const input = [
        {
          type: 'video_result',
          title: 'TypeScript Basics',
          url: 'https://example.com/videos/ts-basics',
          description: 'Learn TS',
          family_friendly: true,
          age: '2 days ago',
          meta_url: {
            scheme: 'https',
            netloc: 'example.com',
            hostname: 'example.com',
            favicon: 'https://example.com/favicon.ico',
            path: 'videos/ts-basics',
          },
          thumbnail: {
            src: 'https://example.com/thumb-ts.jpg',
          },
          video: {
            duration: '12:30',
            views: '1024',
            creator: 'Code Channel',
            publisher: 'Example Publisher',
            thumbnail: {
              src: 'https://example.com/video-thumb-ts.jpg',
            },
            requires_subscription: true,
            tags: ['tutorial', 'typescript'],
          },
        },
        {
          type: 'video_result',
          title: 'Vitest Walkthrough',
          url: 'https://example.com/videos/vitest',
          description: 'Testing intro',
          family_friendly: true,
          age: '1 day ago',
          meta_url: {
            scheme: 'https',
            netloc: 'example.com',
            hostname: 'example.com',
            favicon: 'https://example.com/favicon.ico',
            path: 'videos/vitest',
          },
          thumbnail: {
            src: 'https://example.com/thumb-vitest.jpg',
          },
          video: {
            duration: '08:45',
            views: '420',
            creator: 'Testing Channel',
            publisher: 'Example Publisher',
            thumbnail: {
              src: 'https://example.com/video-thumb-vitest.jpg',
            },
            requires_subscription: false,
          },
        },
      ] as Parameters<typeof formatVideoResults>[0];

      const formatted = formatVideoResults(input);

      expect(formatted).toContain('Title: TypeScript Basics');
      expect(formatted).toContain('Creator: Code Channel');
      expect(formatted).toContain('Requires subscription');
      expect(formatted).toContain('Tags: tutorial, typescript');
      expect(formatted).toContain('Title: Vitest Walkthrough');
      expect(formatted).toContain('Creator: Testing Channel');
      expect(formatted).toContain('No subscription');
      expect(formatted).toContain('\n---\n');
    });
  });
});
