import fs from 'node:fs';
import path from 'node:path';

const changesetDir = path.resolve(process.cwd(), '.changeset');

if (!fs.existsSync(changesetDir)) {
  process.exit(0);
}

const entries = fs.readdirSync(changesetDir, { withFileTypes: true });
const filesToRemove = entries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => name.endsWith('.md') && name !== 'README.md');

for (const file of filesToRemove) {
  fs.unlinkSync(path.join(changesetDir, file));
}

if (filesToRemove.length > 0) {
  console.log(`Removed ${filesToRemove.length} applied changeset file(s).`);
}
