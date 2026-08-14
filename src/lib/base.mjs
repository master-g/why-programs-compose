import { SITE } from "./site.config.mjs";

/**
 * 站点部署 base 路径。
 * GitHub Pages 项目页挂在 https://<owner>.github.io/<仓库名>/ 下,
 * 站内所有绝对路径都必须带此前缀,否则线上 404。
 *
 * astro.config.mjs 的 defineConfig({ base })、markdown 管线前缀插件、
 * 页面组件、构建后校验脚本全部从这里取;
 * 换部署目标时改 site.config.mjs 的 SITE.repo,不改本文件。
 *
 * 不用 import.meta.env.BASE_URL:它由本常量派生(base + '/'),
 * 但独立 Node 脚本(sync、check-*)没有 import.meta.env,统一用本模块。
 */
export const BASE = `/${SITE.repo}`;

/**
 * 给站内绝对路径加 base 前缀:'/about/' → '/<仓库名>/about/'。
 * 外部 URL、锚点、协议相对路径(//)原样返回;已加过前缀的路径幂等返回。
 */
export function withBase(path) {
	if (typeof path !== "string") return path;
	if (!path.startsWith("/") || path.startsWith("//")) return path;
	if (path === "/") return `${BASE}/`;
	if (path.startsWith(`${BASE}/`)) return path;
	return `${BASE}${path}`;
}
