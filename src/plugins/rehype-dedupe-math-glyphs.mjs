/**
 * MathJax SVG 字形去重。
 *
 * mathjax-full 的 SVG 输出默认 `fontCache: 'local'`(见 mathjax-full/js/output/svg.js
 * 的 SVG.OPTIONS),每条公式各自内联一整套字形路径,并且给每份路径发独立的 id。
 * 同一个字母在一页里出现多少次就重复多少份 `<path>`:实测公式密集词条页
 * 2538 个 `<path>` 只对应 108 个不同字形,字形数据占该页体积的 64%。
 *
 * 本插件按 `d` 属性归并:相同字形只保留首次出现的那个 `<path>`,其余删除,
 * 并把指向被删 id 的 `<use>` 改写到保留下来的 id。`<use>` 跨 `<svg>` 引用同一
 * HTML 文档内的 id 是 SVG 标准行为,故公式的渲染结果不变。
 *
 * 归并范围是单篇文档,与页面边界一致——跨页共享需要外部字形表,那会让页面
 * 不再自包含。必须排在 rehype-mathjax 之后;排在 sanitize 之前或之后都可以,
 * `path` 的 id/d 与 `use` 的 href 都在白名单内。
 */

/** hast 对 `xlink:href` 的属性名有两种写法,两种都要认。 */
const HREF_KEYS = ["xLinkHref", "href"];

function eachElement(node, visitor) {
	if (node?.type !== "element" && node?.type !== "root") return;
	if (node.type === "element") visitor(node);
	for (const child of node.children ?? []) eachElement(child, visitor);
}

/** 收集 d → 保留下来的 id,以及被删 id → 保留 id 的改写表。 */
function collectGlyphs(tree) {
	const canonicalByShape = new Map();
	const rename = new Map();

	eachElement(tree, (node) => {
		if (node.tagName !== "path") return;
		const { id, d } = node.properties ?? {};
		if (typeof id !== "string" || typeof d !== "string") return;

		const canonical = canonicalByShape.get(d);
		if (canonical === undefined) {
			canonicalByShape.set(d, id);
			return;
		}
		rename.set(id, canonical);
	});

	return rename;
}

/** 删除被归并掉的 `<path>`,顺带删除因此变空的 `<defs>`。 */
function dropRedundantPaths(tree, rename) {
	eachElement(tree, (node) => {
		if (!node.children?.length) return;
		node.children = node.children.filter((child) => {
			if (child.type !== "element" || child.tagName !== "path") return true;
			return !rename.has(child.properties?.id);
		});
	});

	eachElement(tree, (node) => {
		if (!node.children?.length) return;
		node.children = node.children.filter(
			(child) =>
				child.type !== "element" ||
				child.tagName !== "defs" ||
				child.children?.length > 0,
		);
	});
}

/** 把指向被删 id 的引用改写到保留下来的 id。 */
function rewriteReferences(tree, rename) {
	eachElement(tree, (node) => {
		if (node.tagName !== "use" || !node.properties) return;
		for (const key of HREF_KEYS) {
			const value = node.properties[key];
			if (typeof value !== "string" || !value.startsWith("#")) continue;
			const canonical = rename.get(value.slice(1));
			if (canonical) node.properties[key] = `#${canonical}`;
		}
	});
}

export default function rehypeDedupeMathGlyphs() {
	return (tree) => {
		const rename = collectGlyphs(tree);
		if (rename.size === 0) return;
		rewriteReferences(tree, rename);
		dropRedundantPaths(tree, rename);
	};
}
