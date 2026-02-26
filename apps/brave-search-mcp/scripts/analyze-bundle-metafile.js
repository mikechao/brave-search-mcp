import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const distDir = path.resolve('dist');
const metafilePath = path.join(distDir, 'metafile-esm.json');
const reportDir = path.resolve('build-reports');
const reportJsonPath = path.join(reportDir, 'bundle-report.server.json');
const reportTextPath = path.join(reportDir, 'bundle-report.server.txt');
const archivedMetafilePath = path.join(reportDir, 'metafile-esm.json');
const topCount = 30;

if (!fs.existsSync(metafilePath)) {
  throw new Error(`Missing metafile: ${metafilePath}. Run tsup with --metafile before analyzing.`);
}

const metafile = JSON.parse(fs.readFileSync(metafilePath, 'utf8'));
const outputs = Object.entries(metafile.outputs || {});

if (outputs.length === 0) {
  throw new Error(`No outputs found in metafile: ${metafilePath}`);
}

const jsOutputs = outputs.filter(([file, meta]) => file.endsWith('.js') && meta && typeof meta === 'object');
const entryOutput = jsOutputs.find(([, meta]) => String(meta.entryPoint || '').endsWith('src/index.ts'));
const biggestJsOutput = [...jsOutputs].sort((a, b) => (b[1].bytes || 0) - (a[1].bytes || 0))[0];
const [outputFile, outputMeta] = entryOutput || biggestJsOutput || outputs[0];

if (!outputMeta || typeof outputMeta !== 'object') {
  throw new Error(`Invalid output metadata for: ${outputFile}`);
}

const inputEntries = Object.entries(outputMeta.inputs || {});
const contributors = inputEntries
  .map(([input, inputMeta]) => ({
    input,
    bytesInOutput: Number(inputMeta?.bytesInOutput || 0),
  }))
  .filter(item => item.bytesInOutput > 0)
  .sort((a, b) => b.bytesInOutput - a.bytesInOutput);

const outputBytes = Number(outputMeta.bytes || 0);
const denominator = outputBytes || 1;
const topContributors = contributors.slice(0, topCount);

const report = {
  generatedAt: new Date().toISOString(),
  metafile: path.relative(process.cwd(), archivedMetafilePath),
  outputFile,
  outputBytes,
  contributorsCount: contributors.length,
  topContributors: topContributors.map(item => ({
    path: item.input,
    bytesInOutput: item.bytesInOutput,
    percentOfOutput: Number(((item.bytesInOutput / denominator) * 100).toFixed(2)),
  })),
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);

const formatBytes = (bytes) => {
  if (bytes === 0)
    return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

const lines = [
  'Brave Search MCP bundle report',
  `Generated: ${report.generatedAt}`,
  `Metafile: ${report.metafile}`,
  `Output: ${outputFile} (${formatBytes(outputBytes)})`,
  '',
  `Top ${Math.min(topCount, topContributors.length)} contributors by bytes included in output:`,
];

for (const [index, item] of topContributors.entries()) {
  const rank = String(index + 1).padStart(2, '0');
  const percent = ((item.bytesInOutput / denominator) * 100).toFixed(2);
  lines.push(`${rank}. ${item.input} - ${formatBytes(item.bytesInOutput)} (${percent}%)`);
}

if (topContributors.length === 0) {
  lines.push('No contributor data was found in the metafile inputs.');
}

fs.writeFileSync(archivedMetafilePath, `${JSON.stringify(metafile, null, 2)}\n`);
fs.writeFileSync(reportTextPath, `${lines.join('\n')}\n`);
fs.unlinkSync(metafilePath);

console.log(`Bundle analysis written to ${path.relative(process.cwd(), reportJsonPath)}, ${path.relative(process.cwd(), reportTextPath)}, and ${path.relative(process.cwd(), archivedMetafilePath)}.`);
