function isElement(node, tagName) {
  return node?.type === 'element' && node.tagName === tagName;
}

/**
 * 每个 Markdown 二级标题开启一个文章分节。MathJax 的文档级伴随样式保留为
 * 分节的兄弟节点，避免分节间距和边框把样式元素视为正文。
 */
export default function rehypeSectionizeAlgebrica() {
  return (tree) => {
    if (tree?.type !== 'root' || !Array.isArray(tree.children)) return;

    const children = [];
    let section = null;

    for (const child of tree.children) {
      if (isElement(child, 'h2')) {
        section = {
          type: 'element',
          tagName: 'section',
          properties: { className: ['article-section'] },
          children: [child],
        };
        children.push(section);
      } else if (section && !isElement(child, 'style')) {
        section.children.push(child);
      } else {
        section = null;
        children.push(child);
      }
    }

    tree.children = children;
  };
}
