import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import yaml from "js-yaml";
import { BASE } from "../lib/base.mjs";
import danglingJson from "../lib/dangling-links.json" with { type: "json" };
import { createArticleMarkdownPipeline } from "../lib/markdown-pipeline.mjs";
import { getKnownAbsent, getSections } from "../lib/sections.mjs";
import { buildSlugMap } from "../lib/slug-map.mjs";

const slugMap = buildSlugMap({
	source: "fs",
	strictCollisions: true,
	strictEmpty: false,
	silent: true,
});
const dangling = {
	...danglingJson,
	text: [...(danglingJson.text || []), ...getKnownAbsent()],
};
const sectionDirs = getSections().map((section) => section.dir);
const processors = new Map();

function getProcessor(currentSection = null) {
	if (!processors.has(currentSection)) {
		processors.set(
			currentSection,
			createMarkdownProcessor(
				createArticleMarkdownPipeline({
					slugMap,
					dangling,
					currentSection,
					sectionDirs,
					base: BASE,
				}),
			),
		);
	}
	return processors.get(currentSection);
}

function parseFrontmatter(raw) {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) return { data: {}, body: raw };
	return { data: yaml.load(match[1]) || {}, body: match[2] };
}

export async function renderPageMarkdown(raw, { currentSection } = {}) {
	const processor = await getProcessor(currentSection);
	const result = await processor.render(raw);
	return result.code;
}

export async function renderPageMarkdownWithFrontmatter(
	raw,
	{ currentSection } = {},
) {
	const { data, body } = parseFrontmatter(raw);
	const html = await renderPageMarkdown(body, { currentSection });
	return { data, html };
}
