import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dockerfilePath = fileURLToPath(new URL('../../Dockerfile', import.meta.url));
const dockerfile = readFileSync(dockerfilePath, 'utf8');

describe('dockerfile', () => {
  it('uses frozen lockfile for workspace install', () => {
    expect(dockerfile).toMatch(
      /^RUN --mount=type=cache,target=\/root\/\.local\/share\/pnpm\/store pnpm install --frozen-lockfile$/m,
    );
    expect(dockerfile).not.toContain('--no-frozen-lockfile');
  });
});
