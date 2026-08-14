import { visit } from "unist-util-visit";

/**
 * Rehype 插件:给 markdown 渲染产物里的站内绝对路径统一加部署 base 前缀。
 *
 * 管线位置:必须在 rehype-rewrite-algebrica 之后——后者把交叉链接改写成
 * `/<slug>/`、`/category/<section>/`,插图改写成 `/assets/<section>/svg/x.svg`,
 * 本插件再统一加成 `<base>/<slug>/` 等。内容与 sync 脚本因此保持 base 无关。
 *
 * 跳过:非绝对路径、协议相对(//)、已加过前缀的(幂等)。
 * 锚点(#)与 MathJax SVG 的 <use xlink:href="#..."> 不以 / 开头,天然不命中。
 *
 * Options:
 *   - base: 部署 base 路径(site.config.mjs 派生的 BASE,如 '/<仓库名>');空串时插件不做事。
 */
export default function rehypePrefixBase({ base = "" } = {}) {
	const prefix = base.replace(/\/+$/, "");
	return (tree) => {
		if (!prefix) return;
		visit(tree, "element", (node) => {
			const props = node.properties;
			if (!props) return;
			for (const attr of ["href", "src"]) {
				const value = props[attr];
				if (typeof value !== "string") continue;
				if (!value.startsWith("/") || value.startsWith("//")) continue;
				if (value === "/") {
					props[attr] = `${prefix}/`;
				} else if (!value.startsWith(`${prefix}/`)) {
					props[attr] = `${prefix}${value}`;
				}
			}
		});
	};
}
