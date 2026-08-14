import { prepareSidenoteSource } from './sidenote-source.mjs';

const LAYOUT_HEADER = /^> \[!(marginfigure|fullwidth|epigraph)\][ \t]*(.*)$/i;
const QUOTE_LINE = /^>[ \t]?(.*)$/;
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/;
const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)$/;
const TABLE_DELIMITER = /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/;
const LAYOUT_TYPES = ['marginfigure', 'fullwidth', 'epigraph'];

/**
 * 在同步前保留并校验三种教学布局 callout。
 *
 * 这个模块只按行跟踪引用块，不跨越任意 Markdown 块做正则匹配。
 * 普通 callout 与现有旁注的降级、脚注关系校验继续由 sidenote-source 负责。
 */
export function prepareArticleLayoutSource(text) {
  const layout = validateLayoutBlocks(text);
  const sidenote = prepareSidenoteSource(text, { preserveCallouts: LAYOUT_TYPES });
  return {
    text: sidenote.text,
    errors: [
      ...layout.errors.map((item) => ({ ...item, source: 'layout' })),
      ...sidenote.errors.map((item) => ({ ...item, source: 'sidenote' })),
    ],
    warnings: [
      ...layout.warnings.map((item) => ({ ...item, source: 'layout' })),
      ...sidenote.warnings.map((item) => ({ ...item, source: 'sidenote' })),
    ],
  };
}

export function validateLayoutBlocks(text) {
  const lines = text.split(/\r?\n/);
  const errors = [];
  const warnings = [];
  let inFence = false;
  let layoutCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const header = line.match(LAYOUT_HEADER);
    if (!header) continue;

    const type = header[1].toLowerCase();
    const title = header[2].trim();
    const parsed = collectQuotedBlock(lines, index);
    errors.push(...validateLayoutBlock(type, title, parsed.body, lineNumber));
    if (type === 'epigraph' && lineNumber > 12) {
      warnings.push(issue(lineNumber, `题记位于文章中段（第 ${lineNumber} 行），建议只用于页面或章节开场`));
    }
    if (type === 'marginfigure' && visibleLength(title) > 80) {
      warnings.push(issue(lineNumber, '页边图图注超过 80 个可见字符，建议缩短'));
    }
    layoutCount += 1;
    index = parsed.endIndex;
  }

  if (layoutCount > 2) {
    warnings.push(issue(1, `教学布局共 ${layoutCount} 个，超过单篇 2 个的密度建议值`));
  }

  return { errors, warnings };
}

function collectQuotedBlock(lines, headerIndex) {
  const body = [];
  let endIndex = headerIndex;
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const match = lines[index].match(QUOTE_LINE);
    if (!match) break;
    body.push(match[1]);
    endIndex = index;
  }
  return { body, endIndex };
}

function validateLayoutBlock(type, title, body, lineNumber) {
  if (type === 'marginfigure') return validateMarginFigure(title, body, lineNumber);
  if (type === 'fullwidth') return validateFullwidth(title, body, lineNumber);
  return validateEpigraph(body, lineNumber);
}

function validateMarginFigure(title, body, lineNumber) {
  const errors = [];
  const lines = meaningfulLines(body);
  const images = lines.filter((line) => IMAGE.test(line));
  if (images.length === 0) errors.push(issue(lineNumber, 'marginfigure 缺少图片'));
  if (images.length > 1) errors.push(issue(lineNumber, 'marginfigure 包含多张图片，只能保留一张'));
  if (images[0]) errors.push(...validateImage(images[0], lineNumber, 'marginfigure'));
  const captions = lines.filter((line) => !IMAGE.test(line));
  if (captions.length > 1) errors.push(issue(lineNumber, 'marginfigure 图注只能有一行'));
  for (const content of [...lines, title]) errors.push(...forbiddenLayoutContent(content, lineNumber));
  if (captions.length && images.length && lines.indexOf(captions[0]) < lines.indexOf(images[0])) {
    errors.push(issue(lineNumber, 'marginfigure 图片必须位于图注前'));
  }
  return errors;
}

function validateFullwidth(title, body, lineNumber) {
  const errors = [];
  const lines = meaningfulLines(body);
  const images = lines.filter((line) => IMAGE.test(line));
  const tableLines = lines.filter((line) => isTableLine(line));
  if (images.length && tableLines.length) {
    errors.push(issue(lineNumber, 'fullwidth 图片与表格混合'));
  } else if (images.length) {
    if (images.length !== 1 || lines.length !== 1) {
      errors.push(issue(lineNumber, 'fullwidth 图片模式只能包含一张图片'));
    }
    errors.push(...validateImage(images[0], lineNumber, 'fullwidth'));
  } else if (tableLines.length) {
    if (tableLines.length !== lines.length) errors.push(issue(lineNumber, 'fullwidth 表格模式不能混入其他内容'));
    errors.push(...validateTable(lines, lineNumber));
  } else {
    errors.push(issue(lineNumber, 'fullwidth 必须包含一张图片或一张表格'));
  }
  for (const content of [...lines, title]) errors.push(...forbiddenLayoutContent(content, lineNumber));
  return errors;
}

function validateEpigraph(body, lineNumber) {
  const errors = [];
  const trimmed = body.map((line) => line.trim());
  const nonEmpty = trimmed.filter(Boolean);
  const source = nonEmpty.at(-1);
  if (!source || !/^[-—]{1,2}/.test(source)) {
    errors.push(issue(lineNumber, 'epigraph 缺少一行来源'));
    return errors;
  }
  const sourceIndex = trimmed.lastIndexOf(source);
  const quoteLines = trimmed.slice(0, sourceIndex);
  if (!quoteLines.some(Boolean)) errors.push(issue(lineNumber, 'epigraph 缺少引文'));
  if (!trimmed.slice(0, sourceIndex).some((line) => line === '')) {
    errors.push(issue(lineNumber, 'epigraph 引文与来源之间必须有空行'));
  }
  const quoteText = quoteLines.join('\n').trim();
  if (quoteText.split(/\n\s*\n/).filter(Boolean).length > 1) {
    errors.push(issue(lineNumber, 'epigraph 引文必须保持单段'));
  }
  for (const content of [...nonEmpty, source]) errors.push(...forbiddenLayoutContent(content, lineNumber));
  return errors;
}

function validateImage(line, lineNumber, type) {
  const errors = [];
  const image = line.match(IMAGE);
  if (!image) return [issue(lineNumber, `${type} 图片语法无效` )];
  if (!image[1].trim()) errors.push(issue(lineNumber, `${type} 图片 alt 不能为空`));
  if (!image[2].startsWith('svg/')) errors.push(issue(lineNumber, `${type} 图片必须使用 svg/ 路径`));
  return errors;
}

function validateTable(lines, lineNumber) {
  const errors = [];
  if (lines.length < 2 || !lines.some((line) => TABLE_DELIMITER.test(line))) {
    errors.push(issue(lineNumber, 'fullwidth 表格缺少分隔行'));
    return errors;
  }
  const counts = lines.map(unescapedPipeCount);
  if (counts.some((count) => count !== counts[0])) {
    errors.push(issue(lineNumber, 'fullwidth 表格列数不一致'));
  }
  return errors;
}

function forbiddenLayoutContent(line, lineNumber) {
  const errors = [];
  if (!line) return errors;
  if (/^\s*\[![^\]]+\]/.test(line)) errors.push(issue(lineNumber, '教学布局不允许嵌套 callout'));
  if (/^\s*(?:`{3,}|~{3,})/.test(line)) errors.push(issue(lineNumber, '教学布局不允许代码'));
  if (/\$\$|\\\[|\\\]/.test(line)) errors.push(issue(lineNumber, '教学布局不允许展示数学'));
  if (/<\/?[A-Za-z][^>]*>/.test(line)) errors.push(issue(lineNumber, '教学布局不允许原始 HTML'));
  return errors;
}

function meaningfulLines(lines) {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function isTableLine(line) {
  return /^\|.*\|$/.test(line);
}

function unescapedPipeCount(line) {
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== '|') continue;
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && line[cursor] === '\\'; cursor -= 1) backslashes += 1;
    if (backslashes % 2 === 0) count += 1;
  }
  return count;
}

function visibleLength(value) {
  return Array.from(value.replace(/[*_$~]/g, '').replace(/\s/g, '')).length;
}

function issue(line, message) {
  return { line, lines: [line], message };
}
