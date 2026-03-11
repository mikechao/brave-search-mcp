import { describe, expect, it } from 'vitest';

const modeModules = [
  '../../ui/src/lib/image/image-chatgpt-mode.js',
  '../../ui/src/lib/image/image-mcp-mode.js',
  '../../ui/src/lib/local/local-chatgpt-mode.js',
  '../../ui/src/lib/local/local-mcp-mode.js',
  '../../ui/src/lib/news/news-chatgpt-mode.js',
  '../../ui/src/lib/news/news-mcp-mode.js',
  '../../ui/src/lib/video/video-chatgpt-mode.js',
  '../../ui/src/lib/video/video-mcp-mode.js',
  '../../ui/src/lib/web/web-chatgpt-mode.js',
  '../../ui/src/lib/web/web-mcp-mode.js',
] as const;

describe('widget mode modules', () => {
  it.each(modeModules)('imports %s without DOM side effects', async (modulePath) => {
    const module = await import(modulePath);

    expect(module.default).toBeTypeOf('function');
  });
});
