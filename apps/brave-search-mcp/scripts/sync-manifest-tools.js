import fs from 'node:fs';
import { MANIFEST_TOOL_ENTRIES } from '../src/tool-catalog.js';

const manifestUrl = new URL('../manifest.json', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'));

manifest.tools = MANIFEST_TOOL_ENTRIES;

fs.writeFileSync(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
