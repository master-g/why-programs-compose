import minLightTheme from "@shikijs/themes/min-light";

/**
 * 代码高亮双主题的唯一事实源。astro.config(词条页)与
 * _render-page(glossary/learn/playground)共用,防止两个入口配色漂移。
 *
 * min-light 默认是 Material 冷调色(饱和红/蓝/紫/橙),浮在暖纸上不协调;
 * 先整体重映射为纸墨调色的浅色主题,再由浅色派生暗色主题。
 * 暗色 token 与 site.css 的 html[data-theme="black"] 变量、SVG paper-ink-v1
 * 契约同族(coral #e28466 / muted #aaa9a1 / note #20201d)。
 * theme 传对象而非名字:shiki 的 createHighlighter 接受 ThemeRegistration。
 */
const LIGHT_COLOR_MAP = {
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

// 浅色 → 暗色的逐色派生;键是浅色主题重映射后的颜色。
const DARK_COLOR_MAP = {
	"#141413": "#deddd6", // ink → 暗色正文
	"#cc785c": "#e28466", // coral primary → 暗色 coral(同 SVG 契约)
	"#a9583e": "#dc896d", // primary-active → 暗色 coral-text
	"#2b5581": "#8ab0d8", // 哑蓝 → 提亮的哑蓝
	"#e8a55a": "#e8b578", // amber → 略提亮
	"#6c6a64": "#aaa9a1", // muted → 暗色 muted
	"#d4a017": "#d9b13d", // warning → 提亮
	"#c64545": "#e07575", // error → 提亮
};

function remapTheme(theme, colorMap, { name, foreground, background }) {
	return {
		...theme,
		name,
		colors: {
			...theme.colors,
			"editor.foreground": foreground,
			"editor.background": background,
		},
		tokenColors: theme.tokenColors.map((rule) => {
			const fg = rule.settings?.foreground;
			if (!fg) return rule;
			const key = fg.slice(0, 7).toLowerCase();
			const mapped = colorMap[key];
			return mapped
				? { ...rule, settings: { ...rule.settings, foreground: mapped } }
				: rule;
		}),
	};
}

// 背景取 site.css 的 --note(浅 #f5f0e8 / 暗 #20201d),与行内 code 的底色一致。
export const shikiLightTheme = remapTheme(minLightTheme, LIGHT_COLOR_MAP, {
	name: "paper-ink-light",
	foreground: "#141413",
	background: "#f5f0e8",
});

export const shikiDarkTheme = remapTheme(shikiLightTheme, DARK_COLOR_MAP, {
	name: "paper-ink-dark",
	foreground: "#deddd6",
	background: "#20201d",
});

// 双主题输出:span 带浅色 color + --shiki-dark 变量,
// 暗色由 site.css 的 html[data-theme="black"] 规则激活。
export const shikiConfig = {
	themes: { light: shikiLightTheme, dark: shikiDarkTheme },
	defaultColor: "light",
};
