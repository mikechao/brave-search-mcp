import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';

const uiDir = path.resolve('dist', 'ui');
const reportDir = path.resolve('build-reports');
const reportJsonPath = path.join(reportDir, 'bundle-report.ui.json');
const reportTextPath = path.join(reportDir, 'bundle-report.ui.txt');

if (!fs.existsSync(uiDir)) {
  throw new Error(`Missing UI build output directory: ${uiDir}. Run the UI build steps before analyzing.`);
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function formatBytes(bytes) {
  if (bytes === 0)
    return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function parseUiPath(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  const routeMatch = normalized.match(/dist\/ui\/src\/lib\/([^/]+)\//);
  const route = routeMatch ? routeMatch[1] : 'unknown';

  let variant = 'other';
  if (normalized.endsWith('/mcp-app.html'))
    variant = 'mcp';
  else if (normalized.endsWith('/chatgpt-app.html'))
    variant = 'chatgpt';

  return { route, variant };
}

const files = listFiles(uiDir)
  .map((fullPath) => {
    const content = fs.readFileSync(fullPath);
    const rawBytes = content.length;
    const gzipBytes = zlib.gzipSync(content, { level: 9 }).length;
    const relativePath = path.relative(process.cwd(), fullPath);
    const extension = path.extname(fullPath).slice(1) || 'none';
    const { route, variant } = parseUiPath(relativePath);

    return {
      path: relativePath,
      extension,
      route,
      variant,
      rawBytes,
      gzipBytes,
    };
  })
  .sort((a, b) => b.rawBytes - a.rawBytes);

const totals = files.reduce(
  (acc, item) => ({
    rawBytes: acc.rawBytes + item.rawBytes,
    gzipBytes: acc.gzipBytes + item.gzipBytes,
  }),
  { rawBytes: 0, gzipBytes: 0 },
);

const byExtension = Object.entries(
  files.reduce((acc, item) => {
    const current = acc[item.extension] || { count: 0, rawBytes: 0, gzipBytes: 0 };
    acc[item.extension] = {
      count: current.count + 1,
      rawBytes: current.rawBytes + item.rawBytes,
      gzipBytes: current.gzipBytes + item.gzipBytes,
    };
    return acc;
  }, {}),
).sort((a, b) => b[1].rawBytes - a[1].rawBytes).map(([extension, summary]) => ({
  extension,
  ...summary,
}));

const byVariant = Object.entries(
  files.reduce((acc, item) => {
    const current = acc[item.variant] || { count: 0, rawBytes: 0, gzipBytes: 0 };
    acc[item.variant] = {
      count: current.count + 1,
      rawBytes: current.rawBytes + item.rawBytes,
      gzipBytes: current.gzipBytes + item.gzipBytes,
    };
    return acc;
  }, {}),
).sort((a, b) => b[1].rawBytes - a[1].rawBytes).map(([variant, summary]) => ({
  variant,
  ...summary,
}));

const routePairs = Object.entries(
  files.reduce((acc, item) => {
    const current = acc[item.route] || {};
    current[item.variant] = item;
    acc[item.route] = current;
    return acc;
  }, {}),
).map(([route, pair]) => {
  const mcp = pair.mcp || null;
  const chatgpt = pair.chatgpt || null;

  return {
    route,
    mcpRawBytes: mcp?.rawBytes ?? 0,
    chatgptRawBytes: chatgpt?.rawBytes ?? 0,
    deltaRawBytes: (mcp?.rawBytes ?? 0) - (chatgpt?.rawBytes ?? 0),
    mcpGzipBytes: mcp?.gzipBytes ?? 0,
    chatgptGzipBytes: chatgpt?.gzipBytes ?? 0,
    deltaGzipBytes: (mcp?.gzipBytes ?? 0) - (chatgpt?.gzipBytes ?? 0),
  };
}).sort((a, b) => b.deltaRawBytes - a.deltaRawBytes);

const report = {
  generatedAt: new Date().toISOString(),
  uiDir: path.relative(process.cwd(), uiDir),
  fileCount: files.length,
  totals,
  byExtension,
  byVariant,
  routePairs,
  files,
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  'Brave Search MCP UI bundle report',
  `Generated: ${report.generatedAt}`,
  `Directory: ${report.uiDir}`,
  `File count: ${report.fileCount}`,
  `Total size: ${formatBytes(report.totals.rawBytes)} (gzip ${formatBytes(report.totals.gzipBytes)})`,
  '',
  'Variant totals:',
];

for (const variant of byVariant) {
  const rawPercent = report.totals.rawBytes > 0 ? (variant.rawBytes / report.totals.rawBytes) * 100 : 0;
  const gzipPercent = report.totals.gzipBytes > 0 ? (variant.gzipBytes / report.totals.gzipBytes) * 100 : 0;
  lines.push(`- ${variant.variant}: ${formatBytes(variant.rawBytes)} (${formatPercent(rawPercent)}), gzip ${formatBytes(variant.gzipBytes)} (${formatPercent(gzipPercent)})`);
}

lines.push(
  '',
  'MCP vs ChatGPT per-route delta (mcp - chatgpt):',
);

for (const pair of routePairs) {
  lines.push(`- ${pair.route}: ${formatBytes(pair.deltaRawBytes)} raw, ${formatBytes(pair.deltaGzipBytes)} gzip`);
}

lines.push(
  '',
  'Top UI outputs by size:',
);

for (const [index, item] of files.entries()) {
  const rank = String(index + 1).padStart(2, '0');
  const rawPercent = report.totals.rawBytes > 0 ? (item.rawBytes / report.totals.rawBytes) * 100 : 0;
  lines.push(`${rank}. ${item.path} - ${formatBytes(item.rawBytes)} (${formatPercent(rawPercent)} of UI, gzip ${formatBytes(item.gzipBytes)})`);
}

fs.writeFileSync(reportTextPath, `${lines.join('\n')}\n`);

console.log(`UI analysis written to ${path.relative(process.cwd(), reportJsonPath)} and ${path.relative(process.cwd(), reportTextPath)}.`);
