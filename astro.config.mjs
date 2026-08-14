import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import minLightTheme from "@shikijs/themes/min-light";
import { BASE } from "./src/lib/base.mjs";
import danglingJson from "./src/lib/dangling-links.json" with { type: "json" };
import { createArticleMarkdownPipeline } from "./src/lib/markdown-pipeline.mjs";
import { getKnownAbsent, getSections } from "./src/lib/sections.mjs";
import { buildSlugMap } from "./src/lib/slug-map.mjs";

// min-light 默认是 Material 冷调色(饱和红/蓝/紫/橙),浮在暖纸上不协调;
// 按 Claude 设计 token(claude.design.md)整体重映射为其代码块指引的
// 「muted blues / oranges / grays」三族,紫色(设计禁止的第四色)并入 teal。
// theme 传对象而非名字:shiki 的 createHighlighter 接受 ThemeRegistration,Astro 原样透传。
const SHIKI_COLOR_MAP = {
	"#24292e": "#141413", // 基础前景 → ink
	"#212121": "#141413", // 标点/editor 前景 → ink
	"#d32f2f": "#cc785c", // 关键字:Material 红 → coral primary(哑橙)
	"#1976d2": "#2b5581", // 数字/常量 → 哑蓝(并入字符串一族)
	"#6f42c1": "#a9583e", // 函数/类型:紫(设计禁色)→ primary-active
	"#ff9800": "#e8a55a", // 函数参数 → accent-amber
	"#22863a": "#2b5581", // 字符串/标签/正则/模板串 → 哑蓝
	"#c2c3c5": "#6c6a64", // 注释:太淡的冷灰 → muted 暖灰
	"#316bcd": "#2b5581", // diff info → 哑蓝
	"#cd9731": "#d4a017", // diff warn → warning
	"#cd3131": "#c64545", // diff error → error
	"#800080": "#6c6a64", // diff debug → muted
};
const shikiTheme = {
	...minLightTheme,
	colors: { ...minLightTheme.colors, "editor.foreground": "#141413" },
	tokenColors: minLightTheme.tokenColors.map((rule) => {
		const fg = rule.settings?.foreground;
		if (!fg) return rule;
		const key = fg.slice(0, 7).toLowerCase();
		const mapped = SHIKI_COLOR_MAP[key];
		return mapped
			? { ...rule, settings: { ...rule.settings, foreground: mapped } }
			: rule;
	}),
};

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
	// GitHub Pages 项目页:https://master-g.github.io/why-models-learn/
	site: "https://master-g.github.io",
	base: BASE,
	compressHTML: true,
	trailingSlash: "always",
	build: {
		format: "directory",
	},
	markdown: {
		shikiConfig: { theme: shikiTheme },
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
