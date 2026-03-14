import { describe, expect, it } from 'vitest';
import { ALL_TOOL_NAMES, TOOL_NAMES } from '../../src/tool-names.js';
import { toolNameForVariant, TOOL_NAMES as uiToolNames } from '../../ui/src/lib/shared/tool-names.js';

describe('tool names wrappers', () => {
  it('keeps the UI and server tool name wrappers aligned', () => {
    expect(uiToolNames).toEqual(TOOL_NAMES);
  });

  it('maps each widget variant to the canonical tool name', () => {
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
