const fs = require('node:fs');
const path = require('node:path');
const files = ['README.md', 'docs/architecture.md', 'docs/original-product-spec.md'];
let count = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const href = match[1].split('#')[0];
    if (!href || /^[a-z]+:/i.test(href)) continue;
    if (!fs.existsSync(path.resolve(path.dirname(file), href))) throw new Error(`${file}: broken relative link ${href}`);
    count++;
  }
}
const original = require('node:child_process').execFileSync('git', ['show', 'HEAD:README.md'], { encoding: 'utf8' });
const spec = original.slice(original.indexOf('## 1. Product vision')).replace(/\r\n/g, '\n').replaceAll('](AGENTS.md)', '](../AGENTS.md)');
const archive = fs.readFileSync('docs/original-product-spec.md', 'utf8').replace(/\r\n/g, '\n');
if (!archive.endsWith(spec)) throw new Error('Original specification was not preserved');
console.log(`${count} local links resolve; original specification preserved`);
