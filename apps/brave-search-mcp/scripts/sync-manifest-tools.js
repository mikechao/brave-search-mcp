import fs from 'node:fs';
import { MANIFEST_TOOL_ENTRIES } from '../src/tool-catalog.js';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

manifest.tools = MANIFEST_TOOL_ENTRIES;

fs.writeFileSync('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
