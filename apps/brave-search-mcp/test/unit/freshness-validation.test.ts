import type { BraveSearch } from 'brave-search';
import { describe, expect, it } from 'vitest';
import { BraveNewsSearchTool } from '../../src/tools/BraveNewsSearchTool.js';
import { BraveVideoSearchTool } from '../../src/tools/BraveVideoSearchTool.js';
import { BraveWebSearchTool } from '../../src/tools/BraveWebSearchTool.js';

function createLogStub() {
  return () => {};
}

describe('freshness date validation', () => {
  describe('braveWebSearchTool', () => {
    const tool = new BraveWebSearchTool(createLogStub(), null as unknown as BraveSearch, false);

    it('accepts valid date ranges', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-01-01to2026-01-31',
      });
      expect(result.success).toBe(true);
    });

    it('accepts leap year date', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2024-02-01to2024-02-29',
      });
      expect(result.success).toBe(true);
    });

    it('accepts predefined enum values', () => {
      for (const value of ['pd', 'pw', 'pm', 'py']) {
        const result = tool.inputSchema.safeParse({
          query: 'test',
          freshness: value,
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid month (returns NaN) with exactly one error', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-13-01to2026-01-31',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].message).toContain('valid calendar dates');
      }
    });

    it('rejects date rollover: February 30 becomes March 2 with exactly one error', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-02-30to2026-03-31',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].message).toContain('valid calendar dates');
      }
    });

    it('rejects date rollover: April 31 becomes May 1', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-04-31to2026-05-31',
      });
      expect(result.success).toBe(false);
    });

    it('rejects date rollover: June 31 becomes July 1', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-06-31to2026-07-31',
      });
      expect(result.success).toBe(false);
    });

    it('rejects date rollover: September 31 becomes October 1', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-09-31to2026-10-31',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid day (32nd day of month)', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-01-32to2026-02-01',
      });
      expect(result.success).toBe(false);
    });

    it('rejects start date after end date with exactly one error', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-12-31to2026-01-01',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].message).toContain('start date must not be after end date');
      }
    });

    it('rejects malformed format with exactly one error', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026/01/01to2026/01/31',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].message).toContain('format');
      }
    });
  });

  describe('braveNewsSearchTool', () => {
    const tool = new BraveNewsSearchTool(createLogStub(), null as unknown as BraveSearch, false);

    it('accepts valid date ranges', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-01-01to2026-01-31',
      });
      expect(result.success).toBe(true);
    });

    it('rejects malformed format with exactly one error', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026/01/01to2026/01/31',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].message).toContain('format');
      }
    });

    it('rejects date rollover: February 30', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-02-30to2026-02-28',
      });
      expect(result.success).toBe(false);
    });

    it('rejects extreme invalid date', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-99-99to2026-99-99',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('braveVideoSearchTool', () => {
    const tool = new BraveVideoSearchTool(createLogStub(), null as unknown as BraveSearch, false);

    it('accepts valid date ranges', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-01-01to2026-01-31',
      });
      expect(result.success).toBe(true);
    });

    it('rejects malformed format with exactly one error', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026/01/01to2026/01/31',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].message).toContain('format');
      }
    });

    it('rejects date rollover: February 30', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-02-30to2026-02-28',
      });
      expect(result.success).toBe(false);
    });

    it('rejects extreme invalid date', () => {
      const result = tool.inputSchema.safeParse({
        query: 'test',
        freshness: '2026-99-99to2026-99-99',
      });
      expect(result.success).toBe(false);
    });
  });
});
