import assert from "node:assert/strict";
import { describe, it } from "node:test";
import rehypeSidenotes from "../../src/plugins/rehype-sidenotes.mjs";

function text(value) {
	return { type: "text", value };
}

function element(tagName, properties = {}, children = []) {
	return { type: "element", tagName, properties, children };
}

function footnoteReference(id, number = "1") {
	return element("sup", {}, [
		element(
			"a",
			{
				href: `#user-content-fn-${id}`,
				id: `user-content-fnref-${id}`,
				dataFootnoteRef: true,
				ariaDescribedBy: ["footnote-label"],
			},
			[text(number)],
		),
	]);
}

function footnoteSection(definitions) {
	return element(
		"section",
		{ dataFootnotes: true, className: ["footnotes"] },
		[
			element("h2", { id: "footnote-label" }, [text("Footnotes")]),
			element(
				"ol",
				{},
				definitions.map(({ id, children }) =>
					element("li", { id: `user-content-fn-${id}` }, children),
				),
			),
		],
	);
}

function run(tree) {
	rehypeSidenotes()(tree);
	return tree;
}

describe("rehype-sidenotes", () => {
	it("把当前 GFM 脚注 HAST 转为紧邻引用的可访问旁注", () => {
		const paragraph = element("p", {}, [
			text("正文。"),
			footnoteReference("note"),
		]);
		const tree = {
			type: "root",
			children: [
				paragraph,
				footnoteSection([
					{
						id: "note",
						children: [
							element("p", {}, [
								text("旁注内容。 "),
								element(
									"a",
									{
										href: "#user-content-fnref-note",
										dataFootnoteBackref: "",
									},
									[text("↩")],
								),
							]),
						],
					},
				]),
			],
		};

		run(tree);

		assert.equal(tree.children.length, 1);
		const reference = paragraph.children[1].children[0];
		const note = paragraph.children[2];
		assert.deepEqual(reference.properties, {
			href: "#sidenote-note",
			id: "sidenote-ref-note",
			className: ["sidenote-ref"],
			ariaDescribedBy: ["sidenote-note"],
		});
		assert.equal(note.tagName, "span");
		assert.deepEqual(note.properties, {
			id: "sidenote-note",
			className: ["sidenote", "sidenote--numbered"],
			role: "note",
			ariaLabelledBy: ["sidenote-ref-note"],
		});
		assert.equal(note.children.at(-1).properties.href, "#sidenote-ref-note");
		assert.equal(note.children.at(-1).properties.ariaLabel, "返回旁注引用 1");
	});

	it("转换 marginnote 并保持普通 blockquote 不变", () => {
		const ordinary = element("blockquote", {}, [
			element("p", {}, [text("普通引用。")]),
		]);
		const margin = element("blockquote", {}, [
			element("p", {}, [
				text("[!marginnote] 符号提醒\n范数下标表示所用的"),
				element("em", {}, [text("尺子")]),
				text("。"),
			]),
		]);
		const tree = { type: "root", children: [ordinary, margin] };

		run(tree);

		assert.equal(tree.children[0], ordinary);
		assert.equal(tree.children[1].tagName, "aside");
		assert.deepEqual(tree.children[1].properties, {
			className: ["sidenote", "sidenote--margin"],
			role: "note",
			ariaLabel: "符号提醒",
		});
		assert.equal(tree.children[1].children[0].properties.className[0], "sidenote__label");
		assert.equal(tree.children[1].children[0].children[0].value, "符号提醒");
		assert.ok(tree.children[1].children.some((child) => child.tagName === "em"));
	});

	it("按正文引用顺序插入多个旁注", () => {
		const paragraph = element("p", {}, [
			text("第一处"),
			footnoteReference("a", "1"),
			text("与第二处"),
			footnoteReference("b", "2"),
		]);
		const tree = {
			type: "root",
			children: [
				paragraph,
				footnoteSection([
					{ id: "a", children: [element("p", {}, [text("甲。")])] },
					{ id: "b", children: [element("p", {}, [text("乙。")])] },
				]),
			],
		};

		run(tree);

		const notes = paragraph.children.filter((node) =>
			node.properties?.className?.includes("sidenote--numbered"),
		);
		assert.deepEqual(
			notes.map((node) => node.properties.id),
			["sidenote-a", "sidenote-b"],
		);
	});

	it("对缺失定义、重复引用和多段定义显式失败", () => {
		const missing = {
			type: "root",
			children: [element("p", {}, [footnoteReference("missing")])],
		};
		assert.throws(() => run(missing), /缺少定义/);

		const duplicate = {
			type: "root",
			children: [
				element("p", {}, [
					footnoteReference("same"),
					footnoteReference("same"),
				]),
				footnoteSection([
					{ id: "same", children: [element("p", {}, [text("内容。")])] },
				]),
			],
		};
		assert.throws(() => run(duplicate), /重复引用/);

		const multiParagraph = {
			type: "root",
			children: [
				element("p", {}, [footnoteReference("multi")]),
				footnoteSection([
					{
						id: "multi",
						children: [
							element("p", {}, [text("第一段。")]),
							element("p", {}, [text("第二段。")]),
						],
					},
				]),
			],
		};
		assert.throws(() => run(multiParagraph), /单段/);
	});
});
