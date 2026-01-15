import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(app, 'utf8'));
const dep = pkg.dependencies && pkg.dependencies['brave-search'];

if (dep === 'workspace:*') {
  const sdk = JSON.parse(
    fs.readFileSync(path.resolve('..', '..', 'packages', 'brave-search', 'package.json'), 'utf8'),
  ).version;
  pkg.dependencies['brave-search'] = `^${sdk}`;
  fs.writeFileSync(app, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('Set brave-search dependency to', pkg.dependencies['brave-search']);
}
else {
  console.log('brave-search dependency is', dep || 'missing');
}
