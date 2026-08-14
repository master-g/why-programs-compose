import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { visit } from "unist-util-visit";
import rehypePrefixBase from "../../src/plugins/rehype-prefix-base.mjs";

const BASE = "/why-programs-compose";

function makeLink(text, href) {
	return {
		type: "element",
		tagName: "a",
		properties: { href },
		children: [{ type: "text", value: text }],
	};
}

function makeImg(src) {
	return {
		type: "element",
		tagName: "img",
		properties: { src, alt: "" },
		children: [],
	};
}

function run(tree, opts = { base: BASE }) {
	rehypePrefixBase(opts)(tree);
	return tree;
}

function find(tree, tagName) {
	const out = [];
	visit(tree, "element", (node) => {
		if (node.tagName === tagName) out.push(node);
	});
	return out;
}

describe("rehype-prefix-base", () => {
	it("prefixes article links produced by rewrite-algebrica", () => {
		const tree = { type: "root", children: [makeLink("向量", "/vectors/")] };
		run(tree);
		const [a] = find(tree, "a");
		assert.equal(a.properties.href, "/why-programs-compose/vectors/");
	});

	it("prefixes category links and asset images", () => {
		const tree = {
			type: "root",
			children: [
				makeLink("章", "/category/linear-algebra/"),
				makeImg("/assets/linear-algebra/svg/x.svg"),
			],
		};
		run(tree);
		const [a] = find(tree, "a");
		const [img] = find(tree, "img");
		assert.equal(
			a.properties.href,
			"/why-programs-compose/category/linear-algebra/",
		);
		assert.equal(
			img.properties.src,
			"/why-programs-compose/assets/linear-algebra/svg/x.svg",
		);
	});

	it("rewrites root / to <base>/", () => {
		const tree = { type: "root", children: [makeLink("首页", "/")] };
		run(tree);
		const [a] = find(tree, "a");
		assert.equal(a.properties.href, "/why-programs-compose/");
	});

	it("leaves external URLs, protocol-relative, anchors and relative paths alone", () => {
		const tree = {
			type: "root",
			children: [
				makeLink("ext", "https://algebrica.org/vectors/"),
				makeLink("cdn", "//cdn.example.com/x.js"),
				makeLink("frag", "#sec-1"),
				makeLink("rel", "../vectors/"),
			],
		};
		run(tree);
		const hrefs = find(tree, "a").map((a) => a.properties.href);
		assert.deepEqual(hrefs, [
			"https://algebrica.org/vectors/",
			"//cdn.example.com/x.js",
			"#sec-1",
			"../vectors/",
		]);
	});

	it("is idempotent: already-prefixed paths are not double-prefixed", () => {
		const tree = {
			type: "root",
			children: [makeLink("向量", "/why-programs-compose/vectors/")],
		};
		run(tree);
		const [a] = find(tree, "a");
		assert.equal(a.properties.href, "/why-programs-compose/vectors/");
	});

	it("does nothing when base is empty", () => {
		const tree = { type: "root", children: [makeLink("向量", "/vectors/")] };
		run(tree, { base: "" });
		const [a] = find(tree, "a");
		assert.equal(a.properties.href, "/vectors/");
	});

	it("tolerates a trailing slash in the base option", () => {
		const tree = { type: "root", children: [makeLink("向量", "/vectors/")] };
		run(tree, { base: "/why-programs-compose/" });
		const [a] = find(tree, "a");
		assert.equal(a.properties.href, "/why-programs-compose/vectors/");
	});
});
