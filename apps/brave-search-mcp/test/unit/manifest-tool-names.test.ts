import { describe, expect, it } from 'vitest';
import manifestJson from '../../manifest.json' with { type: 'json' };
import { MANIFEST_TOOL_ENTRIES } from '../../src/tool-catalog.js';

describe('manifest tool names', () => {
  it('matches the canonical manifest tool entries', () => {
    expect(manifestJson.tools).toEqual(MANIFEST_TOOL_ENTRIES);
  });
});
