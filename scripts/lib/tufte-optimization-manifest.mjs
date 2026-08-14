const REVIEW_STATES = new Set([
  'pending',
  'reviewed-no-change',
  'changed',
  'deferred',
]);

const DECISIONS = new Set([
  'sidenote',
  'marginnote',
  'marginfigure',
  'fullwidth',
  'epigraph',
]);

const ROLE_ORDER = [
  'first-pass-core',
  'first-pass-mainline',
  'math-backfill',
  'optional-branch',
  'math-reference',
  'advanced-reference',
];

export function buildInitialTufteManifest({ sections, knownAbsent = [], learningPaths }) {
  return {
    version: 1,
    entries: expectedEntries({ sections, knownAbsent, learningPaths }).map(({ slug, learning_role }) => ({
      slug,
      learning_role,
      review_state: 'pending',
      decision: [],
      rationale: '',
      batch: null,
      source_updated: null,
      visual_evidence: [],
    })),
  };
}

export function validateTufteOptimizationManifest({
  manifest,
  sections,
  knownAbsent = [],
  learningPaths,
}) {
  const errors = [];
  if (manifest?.version !== 1) errors.push(`台账 version 应为 1，实际为 ${String(manifest?.version)}`);
  if (!Array.isArray(manifest?.entries)) {
    throw new Error('Tufte 优化台账校验失败:\n- entries 必须是数组');
  }

  const absent = new Set(knownAbsent);
  const outlineSlugs = new Set(sections.flatMap((section) => section.entries || []));
  const expected = expectedEntries({ sections, knownAbsent, learningPaths });
  const expectedBySlug = new Map(expected.map((entry) => [entry.slug, entry]));
  const seen = new Set();

  for (const entry of manifest.entries) {
    const slug = entry?.slug;
    if (typeof slug !== 'string' || !slug) {
      errors.push(`台账包含无效 slug: ${String(slug)}`);
      continue;
    }
    if (seen.has(slug)) errors.push(`台账包含重复 slug: ${slug}`);
    seen.add(slug);

    if (absent.has(slug)) {
      errors.push(`known_absent 不得进入存量台账: ${slug}`);
      continue;
    }
    if (!outlineSlugs.has(slug)) {
      errors.push(`台账包含未知 slug: ${slug}`);
      continue;
    }

    const expectedEntry = expectedBySlug.get(slug);
    if (!expectedEntry) {
      errors.push(`台账包含非存量 slug: ${slug}`);
      continue;
    }
    if (entry.learning_role !== expectedEntry.learning_role) {
      errors.push(`学习角色不一致: ${slug} 应为 ${expectedEntry.learning_role}，实际为 ${String(entry.learning_role)}`);
    }
    validateReviewRecord(entry, errors);
  }

  const missing = expected.filter((entry) => !seen.has(entry.slug)).map((entry) => entry.slug);
  if (missing.length) errors.push(`台账遗漏: ${missing.join(', ')}`);

  if (errors.length) {
    throw new Error(`Tufte 优化台账校验失败:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }

  const counts = Object.fromEntries(ROLE_ORDER.map((role) => [role, 0]));
  for (const entry of manifest.entries) counts[entry.learning_role] += 1;
  return { entries: manifest.entries, counts };
}

export function mergeTufteOptimizationManifest({ current, initial }) {
  if (!current) return initial;
  if (current.version !== initial.version || !Array.isArray(current.entries)) {
    throw new Error('现有 Tufte 优化台账结构无效，不能自动刷新');
  }

  const initialBySlug = new Map(initial.entries.map((entry) => [entry.slug, entry]));
  const currentBySlug = new Map();
  for (const entry of current.entries) {
    if (currentBySlug.has(entry.slug)) throw new Error(`现有 Tufte 优化台账包含重复 slug: ${entry.slug}`);
    currentBySlug.set(entry.slug, entry);
  }

  const stale = [...currentBySlug.keys()].filter((slug) => !initialBySlug.has(slug));
  if (stale.length) {
    throw new Error(`无法自动移除台账记录，请先人工裁决: ${stale.join(', ')}`);
  }

  return {
    version: initial.version,
    entries: initial.entries.map((entry) => {
      const existing = currentBySlug.get(entry.slug);
      if (!existing) return entry;
      if (existing.learning_role !== entry.learning_role) {
        throw new Error(`学习角色变化需要人工裁决: ${entry.slug} (${existing.learning_role} → ${entry.learning_role})`);
      }
      return existing;
    }),
  };
}

function expectedEntries({ sections, knownAbsent, learningPaths }) {
  const absent = new Set(knownAbsent);
  const entries = [];
  const errors = [];

  for (const section of sections) {
    for (const slug of section.entries || []) {
      if (absent.has(slug)) continue;
      const roles = learningPaths?.entryIndex?.get(slug)?.roles || [];
      const learningRole = classifyRole(roles);
      if (!learningRole) errors.push(`无法从 learning-paths.yaml 派生学习角色: ${slug}`);
      else entries.push({ slug, learning_role: learningRole });
    }
  }

  if (errors.length) {
    throw new Error(`Tufte 优化台账角色派生失败:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return entries;
}

function classifyRole(roles) {
  const math = roles.find((role) => role.type === 'math');
  if (math?.layer === 'core') return 'first-pass-core';
  if (math?.layer === 'backfill') return 'math-backfill';
  if (math?.layer === 'reference') return 'math-reference';
  if (roles.some((role) => role.type === 'optional-branch')) return 'optional-branch';
  if (roles.some((role) => role.type === 'mainline')) return 'first-pass-mainline';
  if (roles.some((role) => role.type === 'reference-track')) return 'advanced-reference';
  return null;
}

function validateReviewRecord(entry, errors) {
  const { slug } = entry;
  if (!REVIEW_STATES.has(entry.review_state)) {
    errors.push(`${slug}: review_state 无效: ${String(entry.review_state)}`);
    return;
  }
  if (!Array.isArray(entry.decision)) {
    errors.push(`${slug}: decision 必须是数组`);
    return;
  }
  const duplicateDecisions = entry.decision.filter((decision, index) => entry.decision.indexOf(decision) !== index);
  if (duplicateDecisions.length) errors.push(`${slug}: decision 包含重复项: ${[...new Set(duplicateDecisions)].join(', ')}`);
  for (const decision of entry.decision) {
    if (!DECISIONS.has(decision)) errors.push(`${slug}: decision 无效: ${String(decision)}`);
  }
  if (!Array.isArray(entry.visual_evidence)) errors.push(`${slug}: visual_evidence 必须是数组`);

  if (entry.review_state === 'pending') return;

  if (typeof entry.rationale !== 'string' || !entry.rationale.trim()) {
    const label = entry.review_state === 'reviewed-no-change' ? '保持现状必须记录理由' : '最终状态必须记录理由';
    errors.push(`${slug}: ${label}`);
  }
  if (typeof entry.batch !== 'string' || !entry.batch.trim()) {
    errors.push(`${slug}: 最终状态必须记录 batch`);
  }

  if (entry.review_state === 'reviewed-no-change' && entry.decision.length) {
    errors.push(`${slug}: 保持现状时 decision 必须为空`);
  }
  if (
    (entry.review_state === 'reviewed-no-change' || entry.review_state === 'changed')
    && (!Array.isArray(entry.visual_evidence) || !entry.visual_evidence.length)
  ) {
    errors.push(`${slug}: 最终审查状态必须记录视觉证据`);
  }
  if (entry.review_state === 'changed') {
    if (!entry.decision.length) errors.push(`${slug}: changed 必须记录采用的教学能力`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.source_updated || '')) {
      errors.push(`${slug}: changed 必须记录 YYYY-MM-DD 格式的 source_updated`);
    }
  }
}
