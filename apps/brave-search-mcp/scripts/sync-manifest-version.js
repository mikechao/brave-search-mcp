import fs from 'node:fs';

const packageUrl = new URL('../package.json', import.meta.url);
const manifestUrl = new URL('../manifest.json', import.meta.url);
const pkg = JSON.parse(fs.readFileSync(packageUrl, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'));

manifest.version = pkg.version;

fs.writeFileSync(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
