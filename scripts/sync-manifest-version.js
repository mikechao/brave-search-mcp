import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

manifest.version = pkg.version;

fs.writeFileSync('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
