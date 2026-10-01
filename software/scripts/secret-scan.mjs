#!/usr/bin/env node
/**
 * Lightweight secret scan for CI.
 * Fails if high-signal credential patterns appear outside allowlisted paths.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ALLOW_DIR_NAMES = new Set(['node_modules', '.git', '.expo', 'dist', 'coverage']);
const ALLOW_FILE_SUBSTR = [
  'scripts/secret-scan',
  'secret-scan.test',
  'fixtures/secret-scan-positive',
];

const PATTERNS = [
  { name: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'generic-api-key-assignment', re: /(?:api[_-]?key|secret[_-]?key|private[_-]?key)\s*[:=]\s*['"][A-Za-z0-9\/+=_-]{20,}['"]/gi },
  { name: 'slack-token', re: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
  { name: 'github-pat', re: /ghp_[A-Za-z0-9]{36}/g },
  { name: 'openai-key', re: /sk-[A-Za-z0-9]{20,}/g },
];

function walk(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ALLOW_DIR_NAMES.has(ent.name)) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|env|sh|sql)$/i.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function isAllowlisted(rel) {
  return ALLOW_FILE_SUBSTR.some((s) => rel.includes(s));
}

const files = walk(ROOT);
const findings = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  if (isAllowlisted(rel)) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) {
      findings.push({ file: rel, name });
    }
  }
}

if (findings.length) {
  console.error('secret-scan FAILED:');
  for (const f of findings) console.error(`  ${f.file}: ${f.name}`);
  process.exit(1);
}

console.log(`secret-scan OK (${files.length} files scanned)`);
