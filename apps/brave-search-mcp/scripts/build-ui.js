#!/usr/bin/env node

/**
 * Build orchestrator for UI entrypoints.
 *
 * Purpose:
 * - Discover UI HTML entrypoints under `ui/src/lib/<route>/(mcp-app.html|chatgpt-app.html)`.
 * - Build each entrypoint with Vite using the existing `INPUT` contract from `ui/vite.config.ts`.
 *
 * Why this exists:
 * - Keeps `package.json` scripts small and avoids manual updates when new routes are added.
 * - Runs builds sequentially so logs stay readable and output behavior remains deterministic.
 *
 * Usage:
 * - `node scripts/build-ui.js`       Build all discovered entrypoints.
 * - `node scripts/build-ui.js --list` List discovered entrypoints without building.
 * - `node scripts/build-ui.js --help` Show documentation and exit.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const LIB_ROOT = path.resolve(process.cwd(), 'ui', 'src', 'lib');
const ENTRY_FILES = ['mcp-app.html', 'chatgpt-app.html'];
const VARIANT_ORDER = new Map([
  ['mcp-app.html', 0],
  ['chatgpt-app.html', 1],
]);

function printUsage() {
  console.log(`Build UI entrypoints for Brave Search MCP.

Usage:
  node scripts/build-ui.js [--list] [--help]

Options:
  --list   List discovered entrypoints and exit (no build).
  --help   Show this help text and exit.

Discovery:
  ui/src/lib/*/(mcp-app.html|chatgpt-app.html)

Ordering:
  Route name ascending, then variant order:
    1) mcp-app.html
    2) chatgpt-app.html

Failure behavior:
  - Exits non-zero on unknown flags, missing discovery root, no entrypoints, or first build failure.
  - Fails fast: later entrypoints are not built after the first error.
`);
}

function parseArgs(argv) {
  const knownFlags = new Set(['--help', '-h', '--list']);
  const filteredArgs = argv.filter(arg => arg !== '--');
  const unknownFlags = filteredArgs.filter(arg => arg.startsWith('-') && !knownFlags.has(arg));

  if (unknownFlags.length > 0) {
    throw new Error(`Unknown flag(s): ${unknownFlags.join(', ')}. Use --help for usage.`);
  }

  return {
    help: filteredArgs.includes('--help') || filteredArgs.includes('-h'),
    list: filteredArgs.includes('--list'),
  };
}

function discoverEntrypoints() {
  if (!fs.existsSync(LIB_ROOT)) {
    throw new Error(`Missing UI lib directory: ${LIB_ROOT}. Expected entries under ui/src/lib/<route>/*.html.`);
  }

  // We intentionally match one route directory deep to mirror ui/src/lib/*/<entry>.html.
  const routeDirs = fs.readdirSync(LIB_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const entrypoints = [];

  for (const route of routeDirs) {
    for (const filename of ENTRY_FILES) {
      const fullPath = path.join(LIB_ROOT, route, filename);
      if (!fs.existsSync(fullPath))
        continue;
      if (!fs.statSync(fullPath).isFile())
        continue;

      entrypoints.push({
        route,
        filename,
        input: `src/lib/${route}/${filename}`,
      });
    }
  }

  const sorted = entrypoints.sort((a, b) => {
    const routeCompare = a.route.localeCompare(b.route);
    if (routeCompare !== 0)
      return routeCompare;
    return (VARIANT_ORDER.get(a.filename) ?? Number.MAX_SAFE_INTEGER)
      - (VARIANT_ORDER.get(b.filename) ?? Number.MAX_SAFE_INTEGER);
  });

  if (sorted.length === 0) {
    throw new Error(
      `No UI entrypoints found under ${LIB_ROOT}. Add files named mcp-app.html or chatgpt-app.html in ui/src/lib/<route>/.`,
    );
  }

  return sorted;
}

function runBuild(entry, index, total) {
  console.log(`[build-ui] (${index}/${total}) Building ${entry.input}`);

  // Pass INPUT via env to preserve compatibility with ui/vite.config.ts.
  const result = spawnSync('pnpm', ['exec', 'vite', 'build', '--config', 'ui/vite.config.ts'], {
    stdio: 'inherit',
    env: { ...process.env, INPUT: entry.input },
  });

  // child_process can fail before the command runs (e.g. command resolution issues).
  if (result.error) {
    throw new Error(`Failed to start build for ${entry.input}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const code = result.status === null ? 'unknown' : String(result.status);
    const signal = result.signal ? ` (signal: ${result.signal})` : '';
    throw new Error(`Build failed for ${entry.input} with exit code ${code}${signal}.`);
  }
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  }
  catch (error) {
    console.error(`[build-ui] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  if (args.help) {
    printUsage();
    return;
  }

  let entrypoints;
  try {
    entrypoints = discoverEntrypoints();
  }
  catch (error) {
    console.error(`[build-ui] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[build-ui] Discovered ${entrypoints.length} UI entrypoint(s):`);
  for (const entry of entrypoints)
    console.log(`  - ${entry.input}`);

  if (args.list)
    return;

  for (const [index, entry] of entrypoints.entries()) {
    try {
      runBuild(entry, index + 1, entrypoints.length);
    }
    catch (error) {
      console.error(`[build-ui] ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`[build-ui] Completed ${entrypoints.length} UI build(s). Output written to dist/ui.`);
}

main();
