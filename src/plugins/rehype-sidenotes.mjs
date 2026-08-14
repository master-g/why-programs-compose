function isElement(node, tagName) {
	return node?.type === "element" && node.tagName === tagName;
}

function classNames(node) {
	const value = node?.properties?.className ?? node?.properties?.class ?? [];
	return Array.isArray(value) ? value : String(value).split(/\s+/).filter(Boolean);
}

function isWhitespace(node) {
	return node?.type === "text" && !node.value.trim();
}

function meaningfulChildren(node) {
	return (node?.children ?? []).filter((child) => !isWhitespace(child));
}

function textContent(node) {
	if (node?.type === "text") return node.value;
	return (node?.children ?? []).map(textContent).join("");
}

function walk(node, visitor, parent = null, index = null) {
	visitor(node, index, parent);
	if (!Array.isArray(node?.children)) return;
	for (let childIndex = 0; childIndex < node.children.length; childIndex++) {
		walk(node.children[childIndex], visitor, node, childIndex);
	}
}

function findFootnoteSection(tree) {
	const matches = [];
	walk(tree, (node, index, parent) => {
		if (
			isElement(node, "section") &&
			(node.properties?.dataFootnotes || classNames(node).includes("footnotes"))
		) {
			matches.push({ node, index, parent });
		}
	});
	if (matches.length > 1) throw new Error("旁注转换失败：发现多个脚注定义区");
	return matches[0] ?? null;
}

function collectDefinitions(sectionMatch) {
	const definitions = new Map();
	if (!sectionMatch) return definitions;
	const list = meaningfulChildren(sectionMatch.node).find((node) => isElement(node, "ol"));
	if (!list) throw new Error("旁注转换失败：脚注定义区缺少有序列表");

	for (const item of meaningfulChildren(list)) {
		if (!isElement(item, "li") || typeof item.properties?.id !== "string") {
			throw new Error("旁注转换失败：脚注定义项结构无效");
		}
		const blocks = meaningfulChildren(item);
		if (blocks.length !== 1 || !isElement(blocks[0], "p")) {
			throw new Error(`旁注转换失败：脚注「${item.properties.id}」只允许单段内容`);
		}
		if (definitions.has(item.properties.id)) {
			throw new Error(`旁注转换失败：脚注「${item.properties.id}」重复定义`);
		}
		definitions.set(item.properties.id, stripGeneratedBackrefs(blocks[0].children));
	}

	return definitions;
}

function stripGeneratedBackrefs(children) {
	const content = children.filter(
		(node) =>
			!(isElement(node, "a") &&
				(node.properties?.dataFootnoteBackref !== undefined ||
					classNames(node).includes("data-footnote-backref"))),
	);
	while (content.length && isWhitespace(content.at(-1))) content.pop();
	if (content.at(-1)?.type === "text") {
		content.at(-1).value = content.at(-1).value.replace(/\s+$/, "");
		if (!content.at(-1).value) content.pop();
	}
	return content;
}

function getReference(node) {
	if (!isElement(node, "sup")) return null;
	const children = meaningfulChildren(node);
	if (children.length !== 1 || !isElement(children[0], "a")) return null;
	const anchor = children[0];
	const href = anchor.properties?.href;
	if (
		typeof href !== "string" ||
		(!anchor.properties?.dataFootnoteRef && !href.startsWith("#user-content-fn-"))
	)
		return null;
	return { anchor, definitionId: href.slice(1), number: textContent(anchor).trim() };
}

function collectReferences(tree, sectionNode) {
	const references = [];
	function collect(node, parent = null, index = null) {
		if (node === sectionNode) return;
		const reference = getReference(node);
		if (reference) references.push({ ...reference, node, index, parent });
		for (let childIndex = 0; childIndex < (node.children?.length ?? 0); childIndex++) {
			collect(node.children[childIndex], node, childIndex);
		}
	}
	collect(tree);
	return references;
}

function validateRelations(references, definitions) {
	const counts = new Map();
	for (const reference of references) {
		counts.set(reference.definitionId, (counts.get(reference.definitionId) ?? 0) + 1);
	}
	for (const [id, count] of counts) {
		if (count > 1) throw new Error(`旁注转换失败：脚注「${id}」重复引用`);
		if (!definitions.has(id)) throw new Error(`旁注转换失败：脚注「${id}」缺少定义`);
	}
	for (const id of definitions.keys()) {
		if (!counts.has(id)) throw new Error(`旁注转换失败：脚注「${id}」存在孤立定义`);
	}
}

function makeNumberedNote(reference, content) {
	const suffix = reference.definitionId.replace(/^user-content-fn-/, "");
	const noteId = `sidenote-${suffix}`;
	const referenceId = `sidenote-ref-${suffix}`;
	const number = reference.number;

	reference.node.properties = { className: ["sidenote-ref-wrapper"] };
	reference.anchor.properties = {
		href: `#${noteId}`,
		id: referenceId,
		className: ["sidenote-ref"],
		ariaDescribedBy: [noteId],
	};

	return {
		type: "element",
		tagName: "span",
		properties: {
			id: noteId,
			className: ["sidenote", "sidenote--numbered"],
			role: "note",
			ariaLabelledBy: [referenceId],
		},
		children: [
			{
				type: "element",
				tagName: "span",
				properties: { className: ["sidenote__number"], ariaHidden: "true" },
				children: [{ type: "text", value: `${number}.` }],
			},
			{
				type: "element",
				tagName: "span",
				properties: { className: ["sidenote__body"] },
				children: content,
			},
			{
				type: "element",
				tagName: "a",
				properties: {
					href: `#${referenceId}`,
					className: ["sidenote__backref"],
					ariaLabel: `返回旁注引用 ${number}`,
				},
				children: [{ type: "text", value: "↩" }],
			},
		],
	};
}

function collectMarginnotes(tree) {
	const matches = [];
	walk(tree, (node, index, parent) => {
		if (!isElement(node, "blockquote") || !parent || typeof index !== "number")
			return;
		const blocks = meaningfulChildren(node);
		if (blocks.length !== 1 || !isElement(blocks[0], "p")) {
			if (/^\[!marginnote\]/i.test(textContent(node).trim())) {
				throw new Error("旁注转换失败：marginnote 只允许单段内容");
			}
			return;
		}
		const first = blocks[0].children?.[0];
		if (first?.type !== "text" || !/^\[!marginnote\]/i.test(first.value)) return;
		const marker = first.value.match(/^\[!marginnote\][ \t]*([^\n]*)\n([\s\S]*)$/i);
		if (!marker || !marker[1].trim() || !marker[2].trim()) {
			throw new Error("旁注转换失败：marginnote 必须包含标签和单段正文");
		}
		const body = [...blocks[0].children];
		body[0] = { ...first, value: marker[2] };
		matches.push({ parent, index, label: marker[1].trim(), body });
	});
	return matches;
}

function makeMarginnote({ label, body }) {
	return {
		type: "element",
		tagName: "aside",
		properties: {
			className: ["sidenote", "sidenote--margin"],
			role: "note",
			ariaLabel: label,
		},
		children: [
			{
				type: "element",
				tagName: "span",
				properties: { className: ["sidenote__label"] },
				children: [{ type: "text", value: label }],
			},
			{ type: "text", value: " " },
			...body,
		],
	};
}

/**
 * 把 GFM 脚注和保留的 marginnote callout 转为局部 note 节点。
 * 插件必须在 MathJax 后、链接改写前运行。
 */
export default function rehypeSidenotes() {
	return (tree) => {
		const footnoteSection = findFootnoteSection(tree);
		const definitions = collectDefinitions(footnoteSection);
		const references = collectReferences(tree, footnoteSection?.node);
		const marginnotes = collectMarginnotes(tree);
		validateRelations(references, definitions);

		for (const reference of references) {
			const note = makeNumberedNote(
				reference,
				definitions.get(reference.definitionId),
			);
			const currentIndex = reference.parent.children.indexOf(reference.node);
			reference.parent.children.splice(currentIndex + 1, 0, note);
		}

		for (const marginnote of marginnotes) {
			marginnote.parent.children.splice(
				marginnote.index,
				1,
				makeMarginnote(marginnote),
			);
		}

		if (footnoteSection) {
			footnoteSection.parent.children.splice(footnoteSection.index, 1);
		}
	};
}
