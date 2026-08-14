import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { getKnownAbsent, getSections } from './sections.mjs';

const LEARNING_PATHS_YAML = join(process.cwd(), 'learning-paths.yaml');

let cache = null;

function readSource() {
  return yaml.load(readFileSync(LEARNING_PATHS_YAML, 'utf8')) || {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function outlineIndex(sections) {
  const bySlug = new Map();
  const byDir = new Map();
  for (const section of asArray(sections)) {
    if (section?.dir) byDir.set(section.dir, section);
    for (const [index, slug] of asArray(section?.entries).entries()) {
      if (!bySlug.has(slug)) bySlug.set(slug, { slug, section, index });
    }
  }
  return { bySlug, byDir };
}

function normalizeEntry(slug, meta, outline, knownAbsent) {
  const location = outline.bySlug.get(slug);
  return {
    slug,
    sectionId: location?.section?.dir,
    sectionNameZh: location?.section?.name_zh,
    sectionOrder: location?.section?.order,
    indexInSection: location?.index,
    available: !knownAbsent.has(slug),
    ...(meta || {}),
  };
}

function addRole(roleMap, slug, role) {
  if (!roleMap.has(slug)) roleMap.set(slug, []);
  roleMap.get(slug).push(role);
}

function makeError(errors, message) {
  errors.push(message);
}

function readMathLayers(data, outline, knownAbsent, errors) {
  const raw = data?.math_layers || {};
  const mathEntries = new Map();
  const layers = {
    core: { name_zh: raw.core?.name_zh || '最小数学前置', description_zh: raw.core?.description_zh || '', groups: [], entries: [], slugs: [] },
    backfill: { groups: [], entries: [], slugs: [] },
    reference: { id: raw.reference?.id || 'advanced-math', name_zh: raw.reference?.name_zh || '进阶数学参考', purpose_zh: raw.reference?.purpose_zh || '', entries: [], slugs: [] },
  };
  const mathOutline = new Set(
    [...outline.bySlug.values()]
      .filter(({ section }) => section?.part === 'foundations')
      .map(({ slug }) => slug),
  );

  const register = (slug, layer, groupId, meta = {}) => {
    if (typeof slug !== 'string' || !slug) {
      makeError(errors, `数学分区包含无效 slug: ${String(slug)}`);
      return null;
    }
    if (!mathOutline.has(slug)) {
      makeError(errors, `未知数学 slug: ${slug}`);
      return null;
    }
    if (mathEntries.has(slug)) {
      makeError(errors, `数学 slug 重复: ${slug} (${mathEntries.get(slug).layer} 与 ${layer})`);
      return null;
    }
    const entry = normalizeEntry(slug, { layer, groupId, ...meta }, outline, knownAbsent);
    mathEntries.set(slug, entry);
    layers[layer].entries.push(entry);
    layers[layer].slugs.push(slug);
    return entry;
  };

  const coreGroups = asArray(raw.core?.groups);
  for (const group of coreGroups) {
    const normalized = {
      id: group?.id,
      name_zh: group?.name_zh || group?.id || '',
      entries: [],
    };
    if (!normalized.id) makeError(errors, '最小数学前置包含缺少 id 的分组');
    for (const item of asArray(group?.entries)) {
      const slug = typeof item === 'string' ? item : item?.slug;
      const entry = register(slug, 'core', normalized.id, typeof item === 'object' ? {
        why_now_zh: item.why_now_zh,
        first_use: item.first_use,
        reading_goal_zh: item.reading_goal_zh,
      } : {});
      if (entry) normalized.entries.push(entry);
    }
    layers.core.groups.push(normalized);
  }

  for (const group of asArray(raw.backfill)) {
    const normalized = {
      id: group?.id,
      name_zh: group?.name_zh || group?.id || '',
      purpose_zh: group?.purpose_zh || '',
      entries: [],
    };
    if (!normalized.id) makeError(errors, '按需回补包含缺少 id 的分组');
    for (const slug of asArray(group?.entries)) {
      const entry = register(slug, 'backfill', normalized.id);
      if (entry) normalized.entries.push(entry);
    }
    layers.backfill.groups.push(normalized);
  }

  for (const slug of asArray(raw.reference?.entries)) {
    register(slug, 'reference', layers.reference.id);
  }

  const missing = [...mathOutline].filter((slug) => !mathEntries.has(slug));
  if (missing.length) makeError(errors, `数学分区遗漏: ${missing.join(', ')}`);
  // fork 决定:不硬编码分区数量;完整性由上面的遗漏检查与 register 的重复检查保证。

  layers.core.groups = layers.core.groups.map((group) => ({
    ...group,
    slugs: group.entries.map((entry) => entry.slug),
  }));
  layers.backfill.groups = layers.backfill.groups.map((group) => ({
    ...group,
    slugs: group.entries.map((entry) => entry.slug),
  }));
  layers.reference.slugs = layers.reference.entries.map((entry) => entry.slug);

  return {
    layers,
    bySlug: mathEntries,
    allSlugs: [...mathEntries.keys()],
    counts: {
      core: layers.core.slugs.length,
      backfill: layers.backfill.slugs.length,
      reference: layers.reference.slugs.length,
      total: mathEntries.size,
    },
  };
}

function expandSections(sectionIds, outline, knownAbsent, errors, context) {
  const expanded = [];
  for (const sectionId of asArray(sectionIds)) {
    const section = outline.byDir.get(sectionId);
    if (!section) {
      makeError(errors, `${context} 引用了未知 section: ${sectionId}`);
      continue;
    }
    for (const slug of asArray(section.entries)) {
      expanded.push(normalizeEntry(slug, { sectionId }, outline, knownAbsent));
    }
  }
  return expanded;
}

function expandCoreGroups(groupIds, math, outline, knownAbsent, errors, context) {
  const groups = new Map(math.layers.core.groups.map((group) => [group.id, group]));
  const expanded = [];
  for (const groupId of asArray(groupIds)) {
    const group = groups.get(groupId);
    if (!group) {
      makeError(errors, `${context} 引用了未知数学分组: ${groupId}`);
      continue;
    }
    expanded.push(...group.entries.map((entry) => normalizeEntry(entry.slug, {
      ...entry,
      sectionId: entry.sectionId,
    }, outline, knownAbsent)));
  }
  return expanded;
}

function expandExplicitEntries(entries, outline, knownAbsent, errors, context) {
  const expanded = [];
  for (const value of asArray(entries)) {
    const slug = typeof value === 'string' ? value : value?.slug;
    if (!outline.bySlug.has(slug)) {
      makeError(errors, `${context} 引用了未知 slug: ${slug}`);
      continue;
    }
    expanded.push(normalizeEntry(slug, typeof value === 'object' ? value : {}, outline, knownAbsent));
  }
  return expanded;
}

function expandStage(stage, math, outline, knownAbsent, errors) {
  const context = `主线阶段 ${stage?.id || '(无 id)'}`;
  const entries = [];
  entries.push(...expandCoreGroups(stage?.math_groups, math, outline, knownAbsent, errors, context));
  entries.push(...expandSections(stage?.sections, outline, knownAbsent, errors, context));
  entries.push(...expandExplicitEntries(stage?.entries, outline, knownAbsent, errors, context));
  return {
    ...stage,
    id: stage?.id,
    name_zh: stage?.name_zh || stage?.id || '',
    goal_zh: stage?.goal_zh || '',
    mathGroups: asArray(stage?.math_groups),
    entries,
  };
}

function addSequenceLinks(entries) {
  return entries.map((entry, index) => ({
    ...entry,
    index,
    previousSlug: entries[index - 1]?.slug,
    nextSlug: entries[index + 1]?.slug,
  }));
}

function assertUnique(entries, label, errors) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.slug)) makeError(errors, `${label} 重复 slug: ${entry.slug}`);
    seen.add(entry.slug);
  }
}

function buildPath(data, math, outline, knownAbsent, errors) {
  const spec = data?.paths?.['first-pass'];
  if (!spec) {
    makeError(errors, '缺少 paths.first-pass');
    return {
      mainline: { stages: [], entries: [], slugs: [] },
      optionalBranches: [],
      referenceTracks: [],
    };
  }

  const stages = asArray(spec.stages).map((stage) => expandStage(stage, math, outline, knownAbsent, errors));
  const flattened = [];
  for (const stage of stages) {
    if (!stage.id) makeError(errors, '主线阶段缺少 id');
    for (const entry of stage.entries) flattened.push({ ...entry, stageId: stage.id });
  }
  assertUnique(flattened, '第一遍主线', errors);
  // fork 决定:允许主线包含 known_absent 词条(全库 TODO 起步);
  // learn 页对 available: false 的词条渲染纯文本,不出链接。
  const mainlineEntries = addSequenceLinks(flattened);

  const roleMap = new Map();
  for (const entry of mainlineEntries) {
    addRole(roleMap, entry.slug, { type: 'mainline', stageId: entry.stageId, index: entry.index });
  }

  const expandTrack = (track, type, label) => {
    const entries = expandSections(track?.sections, outline, knownAbsent, errors, `${label} ${track?.id || '(无 id)'}`);
    if (!track?.id) makeError(errors, `${label} 缺少 id`);
    assertUnique(entries, label, errors);
    const sequence = addSequenceLinks(entries);
    for (const entry of sequence) addRole(roleMap, entry.slug, { type, trackId: track.id, index: entry.index });
    return { ...track, id: track?.id, name_zh: track?.name_zh || track?.id || '', entries: sequence };
  };

  const optionalBranches = asArray(spec.optional_branches).map((track) => expandTrack(track, 'optional-branch', '可选支线'));
  const referenceTracks = asArray(spec.reference_tracks).map((track) => expandTrack(track, 'reference-track', '参考轨'));

  for (const coreEntry of math.layers.core.entries) {
    if (!coreEntry.first_use || !mainlineEntries.some((entry) => entry.slug === coreEntry.first_use)) {
      makeError(errors, `最小数学前置 ${coreEntry.slug} 的 first_use 无效: ${coreEntry.first_use || '(空)'}`);
    }
    if (!coreEntry.why_now_zh) makeError(errors, `最小数学前置 ${coreEntry.slug} 缺少 why_now_zh`);
    if (!coreEntry.reading_goal_zh) makeError(errors, `最小数学前置 ${coreEntry.slug} 缺少 reading_goal_zh`);
  }

  return {
    mainline: {
      id: spec.id || 'first-pass',
      name_zh: spec.name_zh || '第一遍主线',
      description_zh: spec.description_zh || '',
      stages,
      entries: mainlineEntries,
      slugs: mainlineEntries.map((entry) => entry.slug),
    },
    optionalBranches,
    referenceTracks,
    roleMap,
  };
}

function buildBackfillIndex(data, math, outline, errors) {
  const groupMap = new Map();
  for (const group of math.layers.backfill.groups) groupMap.set(group.id, group);
  const sectionMap = new Map();
  for (const [sectionId, groupIds] of Object.entries(data?.backfill_for_sections || {})) {
    if (!outline.byDir.has(sectionId)) {
      makeError(errors, `回补映射引用了未知 section: ${sectionId}`);
      continue;
    }
    const groups = [];
    for (const groupId of asArray(groupIds)) {
      const group = groupMap.get(groupId);
      if (!group) {
        makeError(errors, `回补映射引用了未知分组: ${groupId}`);
        continue;
      }
      groups.push(group);
    }
    sectionMap.set(sectionId, groups);
  }
  return sectionMap;
}

export function validateLearningPathData({ data, sections, knownAbsent = [] }) {
  const errors = [];
  const outline = outlineIndex(sections);
  const absent = new Set(knownAbsent);
  const math = readMathLayers(data, outline, absent, errors);
  const path = buildPath(data, math, outline, absent, errors);
  const backfillForSections = buildBackfillIndex(data, math, outline, errors);
  const backfillForGroups = new Map();
  for (const [sectionId, groups] of backfillForSections) {
    const stage = path.mainline.stages.find((candidate) =>
      candidate.entries.some((entry) => entry.sectionId === sectionId),
    );
    if (!stage) continue;
    for (const group of groups) {
      if (!backfillForGroups.has(group.id)) backfillForGroups.set(group.id, []);
      const stages = backfillForGroups.get(group.id);
      if (!stages.some((candidate) => candidate.id === stage.id)) {
        stages.push({ id: stage.id, name_zh: stage.name_zh });
      }
    }
  }

  const roles = new Map();
  for (const [slug, entryRoles] of path.roleMap || []) roles.set(slug, entryRoles);
  for (const [slug, entry] of math.bySlug) {
    if (!roles.has(slug)) roles.set(slug, []);
    roles.get(slug).push({ type: 'math', layer: entry.layer, groupId: entry.groupId });
  }

  if (errors.length) {
    throw new Error(`学习路径数据校验失败:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }

  const entryIndex = new Map();
  for (const [slug, location] of outline.bySlug) {
    entryIndex.set(slug, {
      ...normalizeEntry(slug, {}, outline, absent),
      roles: roles.get(slug) || [],
    });
  }

  return {
    math,
    path: {
      ...path,
      backfillForSections,
      backfillForGroups,
    },
    entryIndex,
    sections: outline.byDir,
    knownAbsent: absent,
  };
}

export function getLearningPaths() {
  if (cache) return cache;
  cache = validateLearningPathData({
    data: readSource(),
    sections: getSections(),
    knownAbsent: getKnownAbsent(),
  });
  return cache;
}

export function clearLearningPathCache() {
  cache = null;
}
