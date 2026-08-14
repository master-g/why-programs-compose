function meaningfulChildren(node) {
  return node.children.filter(
    (child) => child.type !== 'text' || child.value.trim() !== '',
  );
}

function visit(node) {
  if (node?.type !== 'element' && node?.type !== 'root') return;

  if (node.type === 'element' && node.tagName === 'p') {
    const children = meaningfulChildren(node);
    if (
      children.length === 1
      && children[0].type === 'element'
      && children[0].tagName === 'mjx-container'
    ) {
      const className = node.properties.className ?? [];
      node.properties.className = [...className, 'standalone-math'];
    }
  }

  for (const child of node.children ?? []) visit(child);
}

/** Mark paragraphs whose only meaningful content is MathJax output. */
export default function rehypeMarkStandaloneMath() {
  return visit;
}
