#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORBIDDEN_PATHS } from './check-public-release.mjs';

export function forbiddenHistoryPaths(objectLines) {
  const paths = new Set();
  for (const line of objectLines) {
    const separator = line.indexOf(' ');
    if (separator < 0) continue;
    const path = line.slice(separator + 1);
    if (FORBIDDEN_PATHS.some((pattern) => pattern.test(path))) paths.add(path);
  }
  return [...paths].sort();
}

export function checkPublicHistory(repoDir = process.cwd()) {
  const output = execFileSync(
    'git',
    ['-C', resolve(repoDir), 'rev-list', '--objects', '--branches', '--tags', '--remotes'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return forbiddenHistoryPaths(output.split('\n'));
}

function main() {
  const repoDir = process.argv[2] || process.cwd();
  const forbidden = checkPublicHistory(repoDir);
  if (forbidden.length > 0) {
    throw new Error(`Public history gate failed: ${forbidden.length} forbidden path(s)\n${forbidden.join('\n')}`);
  }
  console.log('Public history gate passed: no forbidden paths in reachable refs');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
