import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dockerfilePath = fileURLToPath(new URL('../../Dockerfile', import.meta.url));
const rootPackageJsonPath = fileURLToPath(new URL('../../../../package.json', import.meta.url));
const dockerfile = readFileSync(dockerfilePath, 'utf8');
const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf8')) as {
  packageManager?: string;
};

function getPinnedPnpmVersion(packageManager: string): string {
  const match = packageManager.match(/^pnpm@([^+]+)(?:\+.*)?$/);
  if (!match) {
    throw new Error(`Expected a pnpm packageManager string, received: ${packageManager}`);
  }
  return match[1];
}
describe('dockerfile', () => {
  it('uses frozen lockfile for workspace install', () => {
    expect(dockerfile).toMatch(
      /^RUN --mount=type=cache,target=\/root\/\.local\/share\/pnpm\/store pnpm install --frozen-lockfile$/m,
    );
    expect(dockerfile).not.toContain('--no-frozen-lockfile');
  });

  it('pins the bootstrap pnpm version to the repository package manager', () => {
    expect(rootPackageJson.packageManager).toBeTypeOf('string');
    if (typeof rootPackageJson.packageManager !== 'string') {
      throw new TypeError('Expected the root package.json to define a packageManager string');
    }

    const pinnedVersion = getPinnedPnpmVersion(rootPackageJson.packageManager);
    expect(dockerfile).toContain(`RUN npm install -g pnpm@${pinnedVersion}`);
  });
});
