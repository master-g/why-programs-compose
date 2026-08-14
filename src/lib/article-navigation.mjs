export function getNextAvailableSlug(sectionEntries, currentSlug, availableSlugs) {
  const currentIndex = sectionEntries.indexOf(currentSlug);
  if (currentIndex < 0) return undefined;

  for (const candidate of sectionEntries.slice(currentIndex + 1)) {
    if (availableSlugs.has(candidate)) return candidate;
  }
  return undefined;
}

export function getPreviousAvailableSlug(sectionEntries, currentSlug, availableSlugs) {
  const currentIndex = sectionEntries.indexOf(currentSlug);
  if (currentIndex < 0) return undefined;

  for (const candidate of sectionEntries.slice(0, currentIndex).reverse()) {
    if (availableSlugs.has(candidate)) return candidate;
  }
  return undefined;
}

function getAvailableSet(paths, availableSlugs) {
  if (availableSlugs) return availableSlugs;
  return new Set(
    [...paths.entryIndex.values()]
      .filter((entry) => entry.available)
      .map((entry) => entry.slug),
  );
}

function findSequenceEntry(entries, slug) {
  return entries.find((entry) => entry.slug === slug);
}

function getBackfillReturns(paths, slug) {
  const entry = paths.entryIndex.get(slug);
  const stageIds = new Set();
  for (const role of entry?.roles || []) {
    if (role.type !== 'math' || role.layer !== 'backfill') continue;
    for (const stage of paths.path.backfillForGroups.get(role.groupId) || []) stageIds.add(stage.id);
  }
  return [...stageIds]
    .map((stageId) => paths.path.mainline.stages.find((stage) => stage.id === stageId))
    .filter(Boolean)
    .map((stage) => ({ id: stage.id, name_zh: stage.name_zh, slug: stage.entries.find((entry) => entry.available)?.slug }));
}

function branchReturnSlug(paths, branch) {
  const stage = paths.path.mainline.stages.find((candidate) => candidate.id === branch.return_stage);
  return stage?.entries.find((entry) => entry.available)?.slug;
}

const MATH_GROUPS = [
  {
    layer: 'core',
    actionLabel: '现在读',
    descriptionZh: '第一遍只读这些词条。目标是掌握定义、具体例子和第一次在主线中的用途。',
  },
  {
    layer: 'backfill',
    actionLabel: '按需回补',
    descriptionZh: '遇到当前推导困难时再读。这些词条不构成进入下一阶段的条件。',
  },
  {
    layer: 'reference',
    actionLabel: '形式参考',
    descriptionZh: '用于补全严格定义、证明和理论边界。第一遍可以跳过。',
  },
];

function getSectionMathGroups(paths, sectionId) {
  const section = paths.sections.get(sectionId);
  if (!section) return [];

  const entriesByLayer = new Map(MATH_GROUPS.map(({ layer }) => [layer, []]));
  for (const slug of section.entries) {
    const entry = paths.entryIndex.get(slug);
    const mathRole = entry?.roles.find((role) => role.type === 'math');
    if (mathRole) entriesByLayer.get(mathRole.layer)?.push(entry);
  }

  return MATH_GROUPS
    .map((group) => ({ ...group, entries: entriesByLayer.get(group.layer) || [] }))
    .filter((group) => group.entries.length > 0);
}

export function getArticleNavigation(paths, {
  slug,
  sectionEntries = [],
  availableSlugs,
} = {}) {
  const available = getAvailableSet(paths, availableSlugs);
  const mainlineEntry = findSequenceEntry(paths.path.mainline.entries, slug);
  const branch = paths.path.optionalBranches.find((candidate) =>
    candidate.entries.some((entry) => entry.slug === slug),
  );

  if (mainlineEntry) {
    // fork 决定:主线允许 known_absent 词条,前后链跳到最近的已毕业词条。
    const mainlineSlugs = paths.path.mainline.entries.map((entry) => entry.slug);
    return {
      mode: 'mainline',
      stageId: mainlineEntry.stageId,
      stage: paths.path.mainline.stages.find((stage) => stage.id === mainlineEntry.stageId),
      previousSlug: getPreviousAvailableSlug(mainlineSlugs, slug, available),
      nextSlug: getNextAvailableSlug(mainlineSlugs, slug, available),
      backfillReturns: getBackfillReturns(paths, slug),
      hrefQuery: undefined,
    };
  }

  if (branch) {
    const branchSlugs = branch.entries.map((entry) => entry.slug);
    return {
      mode: 'optional-branch',
      branchId: branch.id,
      branch,
      previousSlug: getPreviousAvailableSlug(branchSlugs, slug, available),
      nextSlug: getNextAvailableSlug(branchSlugs, slug, available),
      returnSlug: branchReturnSlug(paths, branch),
      backfillReturns: getBackfillReturns(paths, slug),
      hrefQuery: undefined,
    };
  }

  return {
    mode: 'catalog-only',
    previousSlug: getPreviousAvailableSlug(sectionEntries, slug, available),
    nextSlug: getNextAvailableSlug(sectionEntries, slug, available),
    backfillReturns: getBackfillReturns(paths, slug),
    hrefQuery: undefined,
  };
}

export function getSectionPathContext(paths, sectionId) {
  const mainlineStage = paths.path.mainline.stages.find((stage) =>
    stage.entries.some((entry) => entry.sectionId === sectionId),
  );
  const optionalBranch = paths.path.optionalBranches.find((branch) =>
    branch.entries.some((entry) => entry.sectionId === sectionId),
  );
  return {
    mainlineStage,
    optionalBranch,
    backfillGroups: paths.path.backfillForSections.get(sectionId) || [],
    mathGroups: getSectionMathGroups(paths, sectionId),
  };
}
