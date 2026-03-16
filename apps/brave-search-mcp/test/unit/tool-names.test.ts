import { describe, expect, it } from 'vitest';
import { ALL_TOOL_NAMES, TOOL_NAMES, toolNameForVariant } from '../../src/tool-catalog.js';
import { TOOL_NAMES as uiToolNames } from '../../ui/src/lib/shared/tool-names.js';

describe('tool catalog', () => {
  it('keeps the UI helper aligned with the canonical tool catalog', () => {
    expect(uiToolNames).toEqual(TOOL_NAMES);
  });

  it('maps each widget variant from the canonical tool catalog', () => {
    expect(toolNameForVariant('web')).toBe(TOOL_NAMES.web);
    expect(toolNameForVariant('image')).toBe(TOOL_NAMES.image);
    expect(toolNameForVariant('news')).toBe(TOOL_NAMES.news);
    expect(toolNameForVariant('local')).toBe(TOOL_NAMES.local);
    expect(toolNameForVariant('video')).toBe(TOOL_NAMES.video);
  });

  it('keeps the llmContext tool in the full canonical list', () => {
    expect(ALL_TOOL_NAMES).toContain(TOOL_NAMES.llmContext);
  });
});
