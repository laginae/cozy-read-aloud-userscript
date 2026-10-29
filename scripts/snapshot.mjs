import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const upstream = path.resolve('../cozy-read-aloud-web');
const selected = new Set(['src/documents.js', 'src/speech-queue.js', 'src/pdf-selection.js', 'src/import-lifecycle.js', 'src/follow.js', 'public/pdf-text-layer.css', 'public/assets/cozy-cat.png', 'LICENSE']);
const files = execFileSync('git', ['ls-files', '-z'], { cwd: upstream, encoding: 'utf8' }).split('\0').filter(file => file && (file.startsWith('vendor/') || selected.has(file)));
const records = [];
for (const file of files) {
  const target = file.startsWith('vendor/') ? file : `vendor/web/${file}`;
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(upstream, file), target);
  records.push({ source: file, target, sha256: createHash('sha256').update(await readFile(target)).digest('hex') });
}
await writeFile('vendor/SOURCES.json', JSON.stringify({ repository: 'https://github.com/laginae/cozy-read-aloud-web', commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }).trim(), files: records }, null, 2) + '\n');
console.log(`Copied ${records.length} tracked public source files; no vault files.`);
