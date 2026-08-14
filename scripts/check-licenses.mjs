#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KNOWN_LICENSE_IDS = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'ISC',
  'LGPL-3.0-or-later',
  'MIT',
  'MPL-2.0',
  'Python-2.0',
]);

function licenseIds(expression) {
  return String(expression)
    .replace(/[()]/g, ' ')
    .split(/\s+(?:AND|OR|WITH)\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function checkLicenseMetadata({ packageJson, lock, notices }) {
  const errors = [];
  const attention = [];

  for (const name of Object.keys(packageJson.dependencies || {})) {
    if (!notices.includes(`\`${name}\``)) {
      errors.push(`direct dependency not documented in THIRD_PARTY_NOTICES.md: ${name}`);
    }
  }

  for (const [path, metadata] of Object.entries(lock.packages || {})) {
    if (!path) continue;
    const name = path.replace(/^node_modules\//, '');
    if (!metadata.license) {
      errors.push(`package missing license metadata: ${name}`);
      continue;
    }
    const unknown = licenseIds(metadata.license).filter((id) => !KNOWN_LICENSE_IDS.has(id));
    if (unknown.length > 0) {
      errors.push(`package has unrecognized license metadata: ${name} (${metadata.license})`);
    }
    if (/\b(?:MPL|LGPL)-/.test(metadata.license)) {
      attention.push(`${name}: ${metadata.license}`);
    }
  }

  return { errors, attention };
}

function main() {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const notices = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
  const result = checkLicenseMetadata({ packageJson, lock, notices });
  for (const entry of result.attention) console.warn(`license attention: ${entry}`);
  if (result.errors.length > 0) throw new Error(result.errors.join('\n'));
  console.log(`License gate passed: ${Object.keys(lock.packages || {}).length - 1} packages checked; ${result.attention.length} attention entries reported`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
