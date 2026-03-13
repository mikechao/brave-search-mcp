import { BraveSearch, BraveSearchError, SafeSearchLevel } from 'brave-search';
import { describe, expect, it } from 'vitest';

describe('brave-search package exports', () => {
  it('exposes the runtime classes and enums used by the app', () => {
    expect(BraveSearch).toBeTypeOf('function');
    expect(BraveSearchError).toBeTypeOf('function');
    expect(SafeSearchLevel.Strict).toBe('strict');
  });
});
