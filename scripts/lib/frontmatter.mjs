import yaml from 'js-yaml';

/**
 * Split markdown into frontmatter YAML text and body.
 *
 * Returns { frontmatter: string | null, body: string }.
 * frontmatter is the raw YAML between the leading --- markers (no markers).
 */
export function splitFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    return { frontmatter: null, body: text };
  }
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: null, body: text };

  const frontmatter = text.slice(4, end);
  let bodyStart = end + 4;
  if (text[bodyStart] === '\r') bodyStart++;
  if (text[bodyStart] === '\n') bodyStart++;
  return { frontmatter, body: text.slice(bodyStart) };
}

/**
 * Parse frontmatter YAML text into an object.
 * Returns null if the text is empty or invalid YAML.
 */
export function parseFrontmatter(frontmatterText) {
  if (!frontmatterText) return null;
  try {
    return yaml.load(frontmatterText.replace(/^---\n?/, '')) || {};
  } catch {
    return null;
  }
}
