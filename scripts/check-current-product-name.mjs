import { Buffer } from 'node:buffer';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const roots = ['config', 'fixtures', 'public', 'scripts', 'src', 'tests'];
const rootFiles = [
  'README.md',
  'index.html',
  'package.json',
  'playwright.composed.config.ts',
  'playwright.config.ts',
  'vite.config.ts',
  'vitest.config.ts',
];
const latin = Buffer.from(String.fromCodePoint(115, 104, 97, 115, 104, 117), 'utf8');
const korean = Buffer.from(String.fromCodePoint(0xc0e4, 0xc288), 'utf8');
const failures = [];
let scanned = 0;

for (const root of roots) {
  await scan(path.resolve(root));
}
for (const file of rootFiles) {
  await scanFile(path.resolve(file));
}

if (failures.length > 0) {
  for (const failure of failures.sort()) {
    process.stderr.write(`Forbidden current product name: ${ascii(failure)}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`Current product name gate passed: ${String(scanned)} files scanned.\n`);
}

async function scan(absolutePath) {
  const entries = await readdir(absolutePath, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOENT') return [];
    throw error;
  });
  for (const entry of entries) {
    const child = path.join(absolutePath, entry.name);
    const relative = path.relative(process.cwd(), child);
    if (containsForbidden(Buffer.from(relative, 'utf8'))) failures.push(`${relative} (path)`);
    if (entry.isDirectory()) {
      await scan(child);
    } else if (entry.isFile()) {
      await scanFile(child);
    } else if (entry.isSymbolicLink()) {
      failures.push(`${relative} (symlink)`);
    }
  }
}

async function scanFile(absolutePath) {
  scanned += 1;
  const relative = path.relative(process.cwd(), absolutePath);
  const bytes = await readFile(absolutePath);
  if (containsForbidden(bytes)) failures.push(`${relative} (content)`);
}

function containsForbidden(bytes) {
  return includesBytes(asciiLower(bytes), latin) || includesBytes(bytes, korean);
}

function asciiLower(bytes) {
  const lowered = Buffer.from(bytes);
  for (let index = 0; index < lowered.length; index += 1) {
    const value = lowered[index];
    if (value !== undefined && value >= 65 && value <= 90) lowered[index] = value + 32;
  }
  return lowered;
}

function includesBytes(haystack, needle) {
  return haystack.indexOf(needle) !== -1;
}

function ascii(value) {
  return [...value].map((character) => {
    const code = character.codePointAt(0);
    return code !== undefined && code >= 32 && code <= 126
      ? character
      : `\\u${(code ?? 0).toString(16).padStart(4, '0')}`;
  }).join('');
}
