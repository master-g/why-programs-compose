function isElement(node, tagName) {
  return node?.type === 'element' && node.tagName === tagName;
}

function isWhitespace(node) {
  return node?.type === 'text' && !node.value.trim();
}

function meaningfulChildren(node) {
  return (node?.children || []).filter((child) => !isWhitespace(child));
}

function textContent(node) {
  if (node?.type === 'text') return node.value;
  return (node?.children || []).map(textContent).join('');
}

function markerFrom(blockquote) {
  const blocks = meaningfulChildren(blockquote);
  const first = blocks[0];
  if (!isElement(first, 'p')) return null;
  const firstChild = first.children?.[0];
  if (firstChild?.type !== 'text') return null;
  const marker = firstChild.value.match(/^\[!(marginfigure|fullwidth|epigraph)\][ \t]*([^\n]*)(?:\n|$)/i);
  if (!marker) return null;
  return {
    type: marker[1].toLowerCase(),
    label: marker[2].trim(),
    blocks,
    first,
    firstChildren: [
      ...(firstChild.value.slice(marker[0].length) ? [{ type: 'text', value: firstChild.value.slice(marker[0].length) }] : []),
      ...(first.children?.slice(1) || []),
    ],
  };
}

function stripWhitespace(children) {
  return children.filter((child) => !isWhitespace(child));
}

function caption(label, trailing = []) {
  const children = [];
  if (label) children.push({ type: 'text', value: label });
  const content = stripWhitespace(trailing);
  if (content.length) {
    if (children.length) children.push({ type: 'text', value: ' ' });
    children.push(...content);
  }
  return children.length
    ? { type: 'element', tagName: 'figcaption', properties: {}, children }
    : null;
}

function makeFigure(className, content, label, trailing = []) {
  const children = [];
  children.push(...content);
  const figcaption = caption(label, trailing);
  if (figcaption) children.push(figcaption);
  return {
    type: 'element',
    tagName: 'figure',
    properties: { className },
    children,
  };
}

function convertMarginfigure(marked) {
  if (marked.blocks.length !== 1) {
    throw new Error('Tufte 块转换失败：marginfigure 只允许一个段落');
  }
  const children = stripWhitespace(marked.firstChildren);
  const images = children.filter((child) => isElement(child, 'img'));
  if (images.length !== 1) {
    throw new Error('Tufte 块转换失败：marginfigure 必须包含一张图片');
  }
  const imageIndex = children.indexOf(images[0]);
  const before = children.slice(0, imageIndex);
  if (before.length) {
    throw new Error('Tufte 块转换失败：marginfigure 图片必须位于图注前');
  }
  const trailing = children.slice(imageIndex + 1);
  if (trailing.some((child) => child.type === 'element' && child.tagName !== 'em' && child.tagName !== 'strong' && child.tagName !== 'a')) {
    throw new Error('Tufte 块转换失败：marginfigure 图注结构无效');
  }
  return makeFigure(['marginfigure'], [images[0]], marked.label, trailing);
}

function convertFullwidth(marked) {
  const firstChildren = stripWhitespace(marked.firstChildren);
  const images = firstChildren.filter((child) => isElement(child, 'img'));
  const table = marked.blocks.find((child) => isElement(child, 'table'));
  if (images.length) {
    if (images.length !== 1 || marked.blocks.length !== 1 || firstChildren.length !== 1) {
      throw new Error('Tufte 块转换失败：fullwidth 图片模式只能包含一张图片');
    }
    return makeFigure(['fullwidth', 'fullwidth--figure'], [images[0]], marked.label);
  }
  if (table) {
    if (marked.blocks.length !== 2 || firstChildren.length !== 0 || marked.blocks.filter((child) => isElement(child, 'table')).length !== 1) {
      throw new Error('Tufte 块转换失败：fullwidth 表格结构无效');
    }
    return makeFigure(['fullwidth', 'fullwidth--table'], [table], marked.label);
  }
  throw new Error('Tufte 块转换失败：fullwidth 缺少图片或表格');
}

function convertEpigraph(marked) {
  if (marked.blocks.length !== 2 || !isElement(marked.blocks[1], 'p')) {
    throw new Error('Tufte 块转换失败：epigraph 必须包含引文段落和来源段落');
  }
  const quote = stripWhitespace(marked.firstChildren);
  const source = stripWhitespace(marked.blocks[1].children);
  if (!quote.length || !source.length) {
    throw new Error('Tufte 块转换失败：epigraph 缺少引文或来源');
  }
  return {
    type: 'element',
    tagName: 'blockquote',
    properties: { className: ['epigraph'] },
    children: [
      { type: 'element', tagName: 'p', properties: {}, children: quote },
      { type: 'element', tagName: 'footer', properties: {}, children: source },
    ],
  };
}

function convert(blockquote) {
  const marked = markerFrom(blockquote);
  if (marked) {
    if (marked.type === 'marginfigure') return convertMarginfigure(marked);
    if (marked.type === 'fullwidth') return convertFullwidth(marked);
    return convertEpigraph(marked);
  }
  const text = textContent(blockquote).trim();
  if (/^\[!(?:marginfigure|fullwidth|epigraph)\]/i.test(text)) {
    throw new Error('Tufte 块转换失败：布局 callout 的 HAST 结构无效');
  }
  return blockquote;
}

function transformChildren(parent) {
  if (!Array.isArray(parent?.children)) return;
  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index];
    if (isElement(child, 'blockquote')) {
      const converted = convert(child);
      parent.children[index] = converted;
      if (converted !== child) continue;
    }
    transformChildren(parent.children[index]);
  }
}

/** 把同步层保留的教学布局 callout转换为语义 HAST 节点。 */
export default function rehypeTufteBlocks() {
  return (tree) => transformChildren(tree);
}
