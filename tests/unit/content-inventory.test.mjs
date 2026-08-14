import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import yaml from 'js-yaml';

const ROOT = new URL('../..', import.meta.url).pathname;
const CONTENT_ROOT = join(ROOT, 'content-zh');
const outline = yaml.load(readFileSync(join(ROOT, 'sections.yaml'), 'utf8'));

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

function entryInventory() {
  return outline.sections.flatMap((section) =>
    section.entries.map((slug) => ({
      slug,
      dir: section.dir,
      part: section.part,
    })),
  );
}

function unescapedPipeCount(line) {
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== '|') continue;
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && line[cursor] === '\\'; cursor -= 1) backslashes += 1;
    if (backslashes % 2 === 0) count += 1;
  }
  return count;
}

describe('content inventory', () => {
  it('keeps outline entries, generated articles, and known_absent in exact agreement', () => {
    const inventory = entryInventory();
    const expected = new Map();
    for (const entry of inventory) {
      assert.equal(expected.has(entry.slug), false, `duplicate outline slug: ${entry.slug}`);
      expected.set(entry.slug, entry);
    }

    const knownAbsent = new Set(outline.known_absent);
    assert.equal(knownAbsent.size, outline.known_absent.length, 'known_absent contains duplicates');

    const present = new Set();
    for (const path of markdownFiles(CONTENT_ROOT)) {
      const id = relative(CONTENT_ROOT, path).split(sep).join('/').replace(/\.md$/, '');
      const [dir, slug, ...rest] = id.split('/');
      assert.deepEqual(rest, [], `article must have section/slug.md shape: ${id}`);
      assert.equal(expected.get(slug)?.dir, dir, `article is outside its outline section: ${id}`);
      assert.equal(present.has(slug), false, `duplicate generated slug: ${slug}`);
      present.add(slug);
    }

    const missing = [...expected.keys()].filter((slug) => !present.has(slug)).sort();
    assert.deepEqual(missing, [...knownAbsent].sort());
  });

  it('enforces article structure and the exercise rule', () => {
    for (const path of markdownFiles(CONTENT_ROOT)) {
      const slug = path.slice(path.lastIndexOf('/') + 1, -3);
      const source = readFileSync(path, 'utf8');
      const headings = [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim());

      const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
      assert.match(frontmatter, /^title:\s*.+$/m, `${slug}: missing title frontmatter`);
      assert.equal(headings.at(-1), '相关词条', `${slug}: final h2 must be 相关词条`);
      // 本项目契约:每词条倒数第二节是 ## 练习,C++ 一律不出现。
      assert.equal(headings.at(-2), '练习', `${slug}: second-to-last h2 must be 练习`);
      assert.doesNotMatch(source, /^```(cpp|c\+\+|cxx)\s*$/m, `${slug}: C++ code fences are banned`);
    }
  });

  it('keeps every Markdown table rectangular', () => {
    const delimiter = /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/;
    const mismatches = [];

    for (const path of markdownFiles(CONTENT_ROOT)) {
      const slug = path.slice(path.lastIndexOf('/') + 1, -3);
      const lines = readFileSync(path, 'utf8').split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        if (!delimiter.test(lines[index])) continue;
        const expected = unescapedPipeCount(lines[index]);
        let start = index;
        let end = index;
        while (start > 0 && /^\s*\|.*\|\s*$/.test(lines[start - 1])) start -= 1;
        while (end + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[end + 1])) end += 1;
        for (let row = start; row <= end; row += 1) {
          const actual = unescapedPipeCount(lines[row]);
          if (actual !== expected) mismatches.push(`${slug}:${row + 1}: expected ${expected} pipes, got ${actual}`);
        }
        index = end;
      }
    }
    assert.deepEqual(mismatches, []);
  });
});

describe('glossary inventory', () => {
  it('keeps one convention per English term and resolves every article link', () => {
    const source = readFileSync(join(ROOT, 'glossary/glossary.md'), 'utf8');
    const rows = source.split('\n').filter((line) => {
      if (!line.startsWith('|')) return false;
      const firstCell = line.slice(1, line.indexOf('|', 1)).trim();
      return firstCell !== '英文' && !/^:?-+:?$/.test(firstCell);
    });
    const terms = rows.map((line) => line.slice(1, line.indexOf('|', 1)).trim());
    const duplicates = terms.filter((term, index) => terms.indexOf(term) !== index);
    assert.deepEqual([...new Set(duplicates)], []);

    const present = new Set(entryInventory().map(({ dir, slug }) => `${dir}/${slug}`));
    for (const match of source.matchAll(/\]\(\.\.\/([^/)]+)\/([^/)]+)\/\)/g)) {
      const id = `${match[1]}/${match[2]}`;
      assert.equal(present.has(id), true, `glossary link does not resolve to an outline article: ${id}`);
      assert.equal(readFileSync(join(CONTENT_ROOT, `${id}.md`), 'utf8').length > 0, true, `glossary link targets an absent article: ${id}`);
    }
  });
});
