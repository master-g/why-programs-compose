import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import { BASE } from "./src/lib/base.mjs";
import { shikiConfig } from "./src/lib/shiki-theme.mjs";
import danglingJson from "./src/lib/dangling-links.json" with { type: "json" };
import { createArticleMarkdownPipeline } from "./src/lib/markdown-pipeline.mjs";
import { getKnownAbsent, getSections } from "./src/lib/sections.mjs";
import { buildSlugMap } from "./src/lib/slug-map.mjs";

// 空词条合法(known_absent):slugMap 只含已写词条,strictEmpty 关闭。
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
console.log(`[astro-config] built slug map: ${slugMap.size} articles`);

export default defineConfig({
	// GitHub Pages 项目页:https://master-g.github.io/why-programs-compose/
	site: "https://master-g.github.io",
	base: BASE,
	compressHTML: true,
	trailingSlash: "always",
	build: {
		format: "directory",
	},
	markdown: {
		shikiConfig,
		processor: unified(
			createArticleMarkdownPipeline({
				slugMap,
				dangling,
				warn: console.warn,
				sectionDirs,
				base: BASE,
			}),
		),
	},
});
