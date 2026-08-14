import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';

const SECTIONS_YAML = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'sections.yaml');
const CONTENT_BASE = './content-zh';

/**
 * Build a slug -> section map.
 *
 * Sources:
 *   - 'fs': scan CONTENT_BASE by directory.
 *   - 'sections-yaml': read sections.yaml entries.
 *   - 'collection-entries': parse Astro collection entries with ids like 'section/slug'.
 *
 * Options:
 *   - entries: array of collection entries (required for 'collection-entries').
 *   - strictCollisions: throw on duplicate slugs (default true).
 *   - strictEmpty: throw when the resulting map is empty (default true).
 *   - unionFs: for 'sections-yaml', also scan CONTENT_BASE and add any slugs not in yaml (default false).
 *   - silent: skip the sections.yaml diff report (default false).
 */
export function buildSlugMap({
  source,
  entries,
  strictCollisions = true,
  strictEmpty = true,
  unionFs = false,
  silent = false,
} = {}) {
  if (!source) {
    throw new TypeError('buildSlugMap: source is required');
  }

  let map;
  switch (source) {
    case 'collection-entries':
      if (!Array.isArray(entries)) {
        throw new TypeError('buildSlugMap collection-entries expects an array of entries');
      }
      map = buildFromEntries(entries, strictCollisions);
      break;
    case 'fs':
      map = buildFromFs(strictCollisions);
      break;
    case 'sections-yaml':
      map = buildFromSectionsYaml(strictCollisions, unionFs);
      break;
    default:
      throw new TypeError(`unknown buildSlugMap source: ${source}`);
  }

  if (strictEmpty && map.size === 0) {
    throw new Error(`buildSlugMap(${source}) produced an empty slug map`);
  }

  if (!silent) {
    logDiff(map);
  }

  return map;
}

function buildFromEntries(entries, strictCollisions) {
  const map = new Map();
  const collisions = new Map();

  for (const entry of entries) {
    const id = entry?.id;
    if (typeof id !== 'string') {
      throw new TypeError(`entry missing id: ${JSON.stringify(entry)}`);
    }
    const [section, slug] = id.split('/');
    if (!section || !slug) {
      throw new TypeError(`unexpected entry id: ${id}`);
    }
    recordSlug(map, collisions, slug, section, strictCollisions);
  }

  maybeThrowCollisions(collisions, strictCollisions);
  return map;
}

function buildFromFs(strictCollisions) {
  const map = new Map();
  const collisions = new Map();

  for (const entry of readdirSync(CONTENT_BASE, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'pages') continue;
    const section = entry.name;
    const sectionPath = join(CONTENT_BASE, section);

    for (const file of readdirSync(sectionPath)) {
      if (!file.endsWith('.md')) continue;
      const slug = file.slice(0, -3);
      recordSlug(map, collisions, slug, section, strictCollisions);
    }
  }

  maybeThrowCollisions(collisions, strictCollisions);
  return map;
}

function buildFromSectionsYaml(strictCollisions, unionFs) {
  const sections = yaml.load(readFileSync(SECTIONS_YAML, 'utf8')) || { sections: [] };
  const map = new Map();
  const collisions = new Map();

  for (const sec of sections.sections || []) {
    for (const slug of sec.entries || []) {
      recordSlug(map, collisions, slug, sec.dir, strictCollisions);
    }
  }

  maybeThrowCollisions(collisions, strictCollisions);

  if (unionFs) {
    try {
      for (const entry of readdirSync(CONTENT_BASE, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === 'pages') continue;
        const section = entry.name;
        const sectionPath = join(CONTENT_BASE, section);
        for (const file of readdirSync(sectionPath)) {
          if (!file.endsWith('.md')) continue;
          const slug = file.slice(0, -3);
          if (!map.has(slug)) map.set(slug, section);
        }
      }
    } catch {
      // upstream read failure is handled downstream.
    }
  }

  return map;
}

function recordSlug(map, collisions, slug, section, strictCollisions) {
  if (map.has(slug)) {
    if (strictCollisions) {
      if (!collisions.has(slug)) collisions.set(slug, [map.get(slug)]);
      collisions.get(slug).push(section);
    }
  } else {
    map.set(slug, section);
  }
}

function maybeThrowCollisions(collisions, strictCollisions) {
  if (strictCollisions && collisions.size > 0) {
    const [slug, sections] = collisions.entries().next().value;
    throw new Error(`slug collision: ${slug} (sections: ${[...new Set(sections)].join(', ')})`);
  }
}

function logDiff(map) {
  let sections;
  try {
    sections = yaml.load(readFileSync(SECTIONS_YAML, 'utf8'));
  } catch (err) {
    console.warn(`[slug-map] could not read sections.yaml: ${err.message}`);
    return;
  }

  const knownAbsent = new Set(sections.known_absent || []);
  const yamlSlugs = new Set();
  for (const sec of sections.sections || []) {
    for (const slug of sec.entries || []) {
      yamlSlugs.add(slug);
    }
  }

  const articleSlugs = new Set(map.keys());
  const expectedSlugs = new Set([...yamlSlugs].filter((s) => !knownAbsent.has(s)));
  const missing = [...expectedSlugs].filter((s) => !articleSlugs.has(s)).sort();
  const extra = [...articleSlugs].filter((s) => !yamlSlugs.has(s)).sort();

  console.log(
    `[slug-map] articles: ${articleSlugs.size}; sections.yaml entries: ${yamlSlugs.size}; missing: ${missing.length}; extra: ${extra.length}`,
  );
  if (missing.length) {
    console.warn(`[slug-map] missing from collection: ${missing.join(', ')}`);
  }
  if (extra.length) {
    console.warn(`[slug-map] not in sections.yaml: ${extra.join(', ')}`);
  }
}

/** Derive section directories from a slug->section map. */
export function getSectionDirs(slugMap) {
  return new Set(slugMap.values());
}
