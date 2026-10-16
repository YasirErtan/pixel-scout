import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'node_modules'].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Public source must not contain symbolic links');
    return entry.isDirectory() ? walk(full) : [path.relative(root, full).replaceAll('\\', '/')];
  });
}
let files;
if (fs.existsSync(path.join(root, '.git'))) {
  files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--deduplicate', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
} else files = walk(root);
const rules = [
  ['email address', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ['access credential', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._-]{20,})/],
  ['secret assignment', /(?:api[_-]?key|access[_-]?token|password|client[_-]?secret)\s*[:=]\s*["'][^"']{8,}["']/i],
  ['local home path', /(?:[A-Z]:[\\/]+Users[\\/]+|\/(?:Users|home)\/)[a-z0-9._-]+/i],
];
let problems = 0;
for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) continue;
  if (/(^|\/)(?:\.env(?:\..*)?|\.vercel|\.openai|\.codex|\.agents|\.antigravity|credentials[^/]*|[^/]+\.(?:pem|key|p12|pfx))($|\/)/i.test(file) && file !== '.env.example') {
    console.error(`${file}: private file must not be published`); problems++;
  }
  if (/\.jpe?g$/i.test(file)) {
    const bytes = fs.readFileSync(path.join(root, file));
    let offset = 2;
    while (offset + 4 < bytes.length && bytes[offset] === 255) {
      const marker = bytes[offset + 1];
      if (marker === 218 || marker === 217) break;
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if ([225, 237, 254].includes(marker) && rules[0][1].test(bytes.subarray(offset + 4, offset + 2 + length).toString('latin1'))) {
        console.error(`${file}: possible email address in JPEG metadata (value withheld)`); problems++;
      }
      offset += 2 + length;
    }
  }
  if (!/\.(?:json|md|js|mjs|cjs|html|css|txt|yml|yaml|svg|py)$/.test(file) && !['LICENSE', '.gitignore', '.vercelignore'].includes(file)) continue;
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [label, pattern] of rules) {
    if (pattern.test(content)) { console.error(`${file}: possible ${label}; inspect locally (value withheld)`); problems++; }
  }
}
if (problems) process.exitCode = 1;
else console.log(`Public-file scan passed (${files.length} files). No credentials or email matches detected; manual review still required.`);
