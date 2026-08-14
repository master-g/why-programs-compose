/**
 * 站点身份的唯一事实源。
 *
 * 换 topic 时只改本文件的 SITE 对象:仓库名、账号、品牌串、内容许可。
 * BASE 路径、GitHub 链接、主题存储键、vault 目录与环境变量名全部由此派生,
 * 任何一处都不得再出现身份字面量——漏改一处会在线上表现为 404 或串主题。
 *
 * 本文件只放「每个 topic 必然不同的身份」。正文文案见 site-copy.mjs,
 * 大纲与词条见 sections.yaml / learning-paths.yaml。
 */
export const SITE = {
	/** GitHub 仓库名,同时是 Pages 项目页的路径段与 vault 飞地目录名。 */
	repo: "why-programs-compose",
	/** GitHub 账号,同时决定 Pages 域名 <owner>.github.io。 */
	owner: "master-g",
	/** 品牌名:页头、footer、页面 title 后缀。 */
	brandZh: "程序为什么能组合",
	/** 页头品牌名下方的一行副标题。 */
	taglineZh: "结构化范畴论条目",
	/**
	 * 正文与原创插图的许可。
	 * 源材料带 share-alike 时必须沿用同款(本项目蒸馏自 CC BY-SA 的 CTFP,
	 * 故不能加 NC 条款);全原创的 topic 可换成 CC BY-NC-SA 4.0。
	 * 改动后 LICENSE.md 与 about 页的许可段落要同步。
	 */
	contentLicense: {
		id: "CC BY-SA 4.0",
		url: "https://creativecommons.org/licenses/by-sa/4.0/",
	},
};

/** 仓库主页,用于页头图标、footer 与正文归属里的链接。 */
export const REPO_URL = `https://github.com/${SITE.owner}/${SITE.repo}`;

/** Pages 站点源,astro.config.mjs 的 site 字段。 */
export const SITE_ORIGIN = `https://${SITE.owner}.github.io`;

/**
 * 主题偏好的 localStorage 键。
 * 同账号的多个项目页共用 <owner>.github.io 这一个 origin,
 * 键不带仓库名会让不同 topic 的明暗设置互相覆盖。
 */
export const THEME_STORAGE_KEY = `${SITE.repo}-theme`;

/** vault 飞地目录名(`03 - AREAS/learning/<VAULT_DIR>/`)。 */
export const VAULT_DIR = SITE.repo;

/** 覆盖 vault 路径的环境变量名。 */
export const VAULT_ENV_VAR = `${SITE.repo.replace(/-/g, "_").toUpperCase()}_VAULT_DIR`;
