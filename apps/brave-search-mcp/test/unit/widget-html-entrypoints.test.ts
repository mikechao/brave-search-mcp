// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DIST_UI_ROOT = path.resolve(process.cwd(), 'dist/ui/src/lib');
const entrypoint = {
  route: 'web',
  file: 'chatgpt-app.html',
  expectedText: 'Run brave_web_search to see results',
} as const;

const BODY_REGEX = /<body>([\s\S]*?)<\/body>/i;
const SCRIPT_REGEX = /<script type="module"[^>]*>([\s\S]*?)<\/script>/i;

function createMatchMedia() {
  return vi.fn().mockImplementation(() => ({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

async function mountBuiltEntrypoint(route: string, file: string) {
  const htmlPath = path.join(DIST_UI_ROOT, route, file);
  const html = await readFile(htmlPath, 'utf8');
  const bodyMatch = html.match(BODY_REGEX);
  const scriptMatch = html.match(SCRIPT_REGEX);

  if (!bodyMatch || !scriptMatch) {
    throw new Error(`Expected body and bundled script in ${htmlPath}`);
  }

  document.body.innerHTML = bodyMatch[1].replace(SCRIPT_REGEX, '').trim();
  runInContext(scriptMatch[1], createContext(window));
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('widget html entrypoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: createMatchMedia(),
    });
    Object.assign(window, {
      openai: {},
    });
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('mounts the built web chatgpt html entrypoint', async () => {
    await mountBuiltEntrypoint(entrypoint.route, entrypoint.file);

    const root = document.getElementById('root');
    expect(root).not.toBeNull();
    expect(root?.querySelector('.app')).not.toBeNull();
    expect(root?.textContent).toContain(entrypoint.expectedText);
  });
});
