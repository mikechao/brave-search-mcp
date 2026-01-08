#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(repoRoot, 'apps', 'brave-search-mcp', 'README.md');
const targetPath = path.join(repoRoot, 'README.md');

async function readFileOrEmpty(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

async function main() {
  const [sourceContents, targetContents] = await Promise.all([
    fs.readFile(sourcePath, 'utf8'),
    readFileOrEmpty(targetPath),
  ]);

  if (sourceContents !== targetContents) {
    await fs.writeFile(targetPath, sourceContents);
    process.stdout.write(
      'Synced README.md from apps/brave-search-mcp/README.md\n',
    );
  }
}

main().catch((error) => {
  console.error('README sync failed:', error);
  process.exitCode = 1;
});
