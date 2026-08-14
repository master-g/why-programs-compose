/**
 * Shared weighted substring scorer used by the client dropdown and the
 * post-build check script. Higher weight = higher priority field.
 */
export function scoreEntry(entry, query) {
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const fields = [
    { value: entry.title_zh, weight: 1000 },
    { value: entry.title_en, weight: 500 },
    { value: entry.keywords_zh?.join(' '), weight: 250 },
    { value: entry.tags?.join(' '), weight: 100 },
  ];

  let score = 0;
  for (const { value, weight } of fields) {
    if (value == null) continue;
    const v = String(value).toLowerCase();
    if (v === q) {
      score += weight * 2;
    } else if (v.startsWith(q)) {
      score += weight * 1.5;
    } else if (v.includes(q)) {
      score += weight;
    }
  }
  return score;
}
