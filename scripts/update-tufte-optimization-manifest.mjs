#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import yaml from 'js-yaml';
import { validateLearningPathData } from '../src/lib/learning-paths.mjs';
import {
  buildInitialTufteManifest,
  mergeTufteOptimizationManifest,
  validateTufteOptimizationManifest,
} from './lib/tufte-optimization-manifest.mjs';

const OUTPUT = 'docs/qa/tufte-optimization/manifest.yaml';
const args = new Set(process.argv.slice(2));

if (!args.has('--write') || args.size !== 1) {
  console.error('用法: node scripts/update-tufte-optimization-manifest.mjs --write');
  process.exitCode = 2;
} else {
  const outline = yaml.load(readFileSync('sections.yaml', 'utf8'));
  const learningSource = yaml.load(readFileSync('learning-paths.yaml', 'utf8'));
  const learningPaths = validateLearningPathData({
    data: learningSource,
    sections: outline.sections,
    knownAbsent: outline.known_absent,
  });
  const initial = buildInitialTufteManifest({
    sections: outline.sections,
    knownAbsent: outline.known_absent,
    learningPaths,
  });
  const current = existsSync(OUTPUT) ? yaml.load(readFileSync(OUTPUT, 'utf8')) : null;
  const manifest = mergeTufteOptimizationManifest({ current, initial });
  validateTufteOptimizationManifest({
    manifest,
    sections: outline.sections,
    knownAbsent: outline.known_absent,
    learningPaths,
  });
  const header = [
    '# Tufte 逐篇优化台账。sections.yaml 与 learning-paths.yaml 决定库存和学习角色。',
    '# 执行开始后只更新审查字段；不要复制标题、章节顺序或正文事实。',
    '',
  ].join('\n');
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${header}${yaml.dump(manifest, { lineWidth: -1, noRefs: true })}`);
  console.log(`[tufte-manifest] 写入 ${manifest.entries.length} 篇: ${OUTPUT}`);
}
