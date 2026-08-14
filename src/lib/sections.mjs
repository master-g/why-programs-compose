import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const SECTIONS_YAML = join(process.cwd(), 'sections.yaml');

let cache = null;
let partsCache = null;
let knownAbsentCache = null;

export function getParts() {
  if (partsCache) return partsCache;
  const data = yaml.load(readFileSync(SECTIONS_YAML, 'utf8'));
  partsCache = (data.parts || []).slice().sort((a, b) => a.order - b.order);
  return partsCache;
}

export function getSections() {
  if (cache) return cache;
  const data = yaml.load(readFileSync(SECTIONS_YAML, 'utf8'));
  cache = (data.sections || []).slice().sort((a, b) => a.order - b.order);
  return cache;
}

export function getKnownAbsent() {
  if (knownAbsentCache) return knownAbsentCache;
  const data = yaml.load(readFileSync(SECTIONS_YAML, 'utf8'));
  knownAbsentCache = data.known_absent || [];
  return knownAbsentCache;
}

export function getSection(dir) {
  return getSections().find((s) => s.dir === dir) || null;
}

export function getSectionsMap() {
  return new Map(getSections().map((s) => [s.dir, s]));
}
