import type { WidgetToolVariant } from '../../src/tool-catalog.js';
import { TOOL_NAMES as aliasToolNames } from '@tool-catalog';
import { describe, expect, it } from 'vitest';
import { TOOL_NAMES } from '../../src/tool-catalog.js';

const widgetVariants: WidgetToolVariant[] = ['web', 'image', 'news', 'local', 'video'];
const allToolNames = Object.values(TOOL_NAMES);

describe('tool catalog', () => {
  it('resolves the alias to the canonical tool catalog', () => {
    expect(aliasToolNames).toEqual(TOOL_NAMES);
  });

  it('maps widget variants directly through the canonical tool catalog', () => {
    expect(widgetVariants.map(variant => TOOL_NAMES[variant])).toEqual([
      TOOL_NAMES.web,
      TOOL_NAMES.image,
      TOOL_NAMES.news,
      TOOL_NAMES.local,
      TOOL_NAMES.video,
    ]);
  });

  it('keeps the llmContext tool in the full canonical list', () => {
    expect(allToolNames).toContain(TOOL_NAMES.llmContext);
  });
});
