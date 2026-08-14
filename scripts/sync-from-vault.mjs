#!/usr/bin/env node
/**
 * 单向同步:Obsidian vault 飞地 → content-zh/。
 *
 * 事实源:vault 的 `03 - AREAS/learning/<SITE.repo>/<slug>.md`(feynman 卡片)。
 * 只同步 `status: complete | reference`;`active` 草稿不出 vault。
 *
 * 适配规则(写作无感,脚本负责):
 *   - `[[slug]]` / `[[slug|显示文本]]` → 站内相对链接(按 sections.yaml 的 slug→章节映射)
 *   - 指向飞地外笔记或未知 slug 的 wikilink → 降级为纯文本并警告
	 *   - 普通 Obsidian callout 标记剥掉,内容保留为 blockquote;受控教学布局标记保留供渲染管线转换
 *   - frontmatter 只透传 title(必填)与 tags(可选),vault-only 字段不透传
 *   - 插图:vault `svg/<slug>.<n>.svg` 拷贝到 `public/assets/<section>/svg/`,
 *     与词条同生命周期(退役即清);引用缺失/归属错误/`![[embed]]` 是硬错误
 *
 * content-zh/ 与 public/assets/ 是纯同步产物,不手改;不在目标集里的旧文件会被清除。
 * (public/assets/playground/ 是 repo 手维护 fixture,不在 sections.yaml 章节内,不参与同步。)
 */
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { parseFrontmatter, splitFrontmatter } from "./lib/frontmatter.mjs";
import { lintChineseCopywriting } from "./lib/copywriting-lint.mjs";
import { prepareArticleLayoutSource } from "./lib/article-layout-source.mjs";
import {
	formatSvgThemeIssue,
	validateSvgTheme,
} from "./lib/svg-theme-contract.mjs";
import {
	SITE,
	VAULT_DIR as VAULT_SUBDIR,
	VAULT_ENV_VAR,
} from "../src/lib/site.config.mjs";

// 飞地位置:vault 根之下的 learning/<仓库名>/。整条路径可被环境变量覆盖。
const VAULT_DIR =
	process.env[VAULT_ENV_VAR] ||
	join(
		homedir(),
		`Documents/ObsidianVaults/Main/03 - AREAS/learning/${VAULT_SUBDIR}`,
	);
const VAULT_SVG_DIR = join(VAULT_DIR, "svg");
const OUT_ROOT = "content-zh";
const ASSETS_ROOT = "public/assets";
const SYNCABLE_STATUS = new Set(["complete", "reference"]);
// 迁移阶段只能显式关闭严格闸;默认阻止旧的浅色专用 SVG 进入产物。
const STRICT_SVG_THEME = process.env.SVG_THEME_STRICT !== "0";

function loadSlugSections() {
	const data = yaml.load(readFileSync("sections.yaml", "utf8"));
	const map = new Map();
	for (const sec of data.sections || []) {
		for (const slug of sec.entries || []) map.set(slug, sec.dir);
	}
	return map;
}

// 生成 vault 内的导航索引 _index.md(下划线前缀,不参与同步;生成物,勿手改)。
// statusMap: slug → vault 内的 status(无文件 = 未写)。
function writeVaultIndex(statusMap) {
	const data = yaml.load(readFileSync("sections.yaml", "utf8"));
	const parts = (data.parts || []).slice().sort((a, b) => a.order - b.order);
	const sections = (data.sections || [])
		.slice()
		.sort((a, b) => a.order - b.order);
	const byPart = new Map();
	for (const sec of sections) {
		const key = sec.part ?? "";
		if (!byPart.has(key)) byPart.set(key, []);
		byPart.get(key).push(sec);
	}

	const MARK = { complete: "✅", reference: "📚", active: "📝" };
	const lines = [
		`# ${SITE.repo} 索引`,
		"",
		"> 生成物(`npm run sync` 顺带生成),勿手改。✅=已毕业 📝=草稿 ⬜=未写;点 ⬜ 的链接可直接创建笔记。",
		"",
	];
	let total = 0,
		done = 0,
		draft = 0;
	for (const part of parts) {
		lines.push(`## ${part.name_zh}`);
		lines.push("");
		for (const sec of byPart.get(part.id) || []) {
			lines.push(`### ${sec.order}. ${sec.name_zh}`);
			for (const slug of sec.entries || []) {
				const st = statusMap.get(slug);
				total++;
				if (st === "complete" || st === "reference") done++;
				else if (st) draft++;
				lines.push(`- ${MARK[st] ?? "⬜"} [[${slug}]]`);
			}
			lines.push("");
		}
	}
	lines.push(`---`);
	lines.push(`进度:${done}/${total} 已毕业,${draft} 篇草稿`);
	lines.push("");
	writeFileSync(join(VAULT_DIR, "_index.md"), lines.join("\n"));
}

function rewriteWikilinks(body, slugSections, warn) {
	return body.replace(
		/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
		(match, target, alias) => {
			const slug = target.trim();
			const section = slugSections.get(slug);
			if (!section) {
				warn(`wikilink 无法解析,降级为纯文本: [[${target}]]`);
				return (alias || target).trim();
			}
			const text = (alias || slug).trim();
			return `[${text}](../${section}/${slug}/)`;
		},
	);
}

// 插图文件名约定:<slug>.<n>.svg。用点号不用连字符:slug 互相包含前缀时
// (如 vector / vector-spaces)连字符归属有歧义,slug 不含点,点号解析无歧义。
function parseSvgOwner(filename, slugSections) {
	if (!filename.endsWith(".svg")) return null;
	const base = filename.slice(0, -4);
	const dot = base.lastIndexOf(".");
	if (dot < 0 || !/^\d+$/.test(base.slice(dot + 1))) return null;
	const slug = base.slice(0, dot);
	return slugSections.has(slug) ? slug : null;
}

function lineOf(text, index) {
	let line = 1;
	for (let i = 0; i < index; i++) if (text[i] === "\n") line++;
	return line;
}

function main() {
	if (!existsSync(VAULT_DIR)) {
		console.log(`[sync] vault 飞地不存在: ${VAULT_DIR}(尚未创建,无词条可同步)`);
		return;
	}

	const slugSections = loadSlugSections();
	const sectionDirs = new Set(slugSections.values());
	const warnings = [];
	const errors = []; // 硬错误:收集完统一报,sync 以 exit 1 失败(显式失败,不写半个产物)
	const warn = (msg) => warnings.push(msg);
	const targets = new Map(); // 'section/slug' -> file content
	const statusMap = new Map(); // slug -> vault status(供 _index.md)

	for (const file of readdirSync(VAULT_DIR)) {
		if (!file.endsWith(".md") || file.startsWith("_")) continue;
		const slug = file.slice(0, -3);
		const section = slugSections.get(slug);
		if (!section) {
			warn(`${file}: slug 不在 sections.yaml,跳过`);
			continue;
		}

		const raw = readFileSync(join(VAULT_DIR, file), "utf8");
		const { frontmatter, body } = splitFrontmatter(raw);
		const data = parseFrontmatter(frontmatter) || {};
		statusMap.set(
			slug,
			SYNCABLE_STATUS.has(data.status) ? data.status : "active",
		);

		if (!SYNCABLE_STATUS.has(data.status)) {
			console.log(`[sync] 跳过(status: ${data.status ?? "missing"}): ${slug}`);
			continue;
		}
		if (typeof data.title !== "string" || !data.title.trim()) {
			warn(`${file}: 缺少 title 字段,跳过`);
			continue;
		}

		const outFrontmatter = ["---", `title: ${JSON.stringify(data.title)}`];
		if (Array.isArray(data.tags) && data.tags.length) {
			outFrontmatter.push(`tags: ${JSON.stringify(data.tags)}`);
		}
		outFrontmatter.push("---");

		// ![[embed]] 必须先于 wikilink 改写拦截:否则 [[...]] 被降级成纯文本,留下 `!foo` 残渣。
		const embedRe = /!\[\[[^\]]+\]\]/g;
		let m;
		while ((m = embedRe.exec(body)) !== null) {
			errors.push(
				`${slug}:${lineOf(body, m.index)} 禁用 Obsidian 嵌入语法: ${m[0]}`,
			);
		}

		const layoutSource = prepareArticleLayoutSource(body);
		for (const issue of layoutSource.warnings) {
			const label = issue.source === "layout" ? "LAYOUT-LINT" : "SIDENOTE-LINT";
			warn(`${slug}:${issue.line} ${label} ${issue.message}`);
		}
		for (const issue of layoutSource.errors) {
			const label = issue.source === "layout" ? "LAYOUT-ERROR" : "SIDENOTE-ERROR";
			errors.push(`${slug}:${issue.line} ${label} ${issue.message}`);
		}
		const outBody = rewriteWikilinks(layoutSource.text, slugSections, warn);
		const outContent = `${outFrontmatter.join("\n")}\n${outBody}`;

		// 文案 lint(沿用 algebrica 规则):reports 警告(LINT),errors 进硬错误数组
		// (LINT-ERROR,exit 1 不写产物——名实相符,2026-07-28 升级)。修复一律在
		// vault 侧做,sync 永不改写正文。
		const lint = lintChineseCopywriting(outContent);
		for (const r of lint.reports) warn(`${slug}:${r.line} LINT ${r.message}`);
		for (const e of lint.errors)
			errors.push(`${slug}:${e.line} LINT-ERROR ${e.message}`);

		// 插图引用校验:必须归属本词条、文件存在于 vault svg/。
		// alt 允许嵌一层方括号(如 [·]_B):[^\]]* 会在内层 ] 处截断,漏配。
		const svgRefRe = /!\[(?:[^[\]]|\[[^\]]*\])*\]\(svg\/([^)\s]+)\)/g;
		while ((m = svgRefRe.exec(outContent)) !== null) {
			const filename = m[1];
			const line = lineOf(outContent, m.index);
			const owner = parseSvgOwner(filename, slugSections);
			if (!owner)
				errors.push(
					`${slug}:${line} 插图文件名非法(约定 <slug>.<n>.svg): svg/${filename}`,
				);
			else if (owner !== slug)
				errors.push(
					`${slug}:${line} 插图归属错误: svg/${filename} 属于 ${owner}`,
				);
			else if (!existsSync(join(VAULT_SVG_DIR, filename)))
				errors.push(`${slug}:${line} 插图缺失: svg/${filename}`);
		}

		// 插图路径改写:相对 svg/x.svg → 站点绝对路径 /assets/<section>/svg/x.svg。
		// Astro content-assets 会把 markdown 相对图片当本地资产解析(构建期 ImageNotFound 报错),
		// 绝对 /assets 路径走 public 目录,Astro 不碰——与 algebrica translate.mjs 的改写一致。
		const finalContent = outContent.replace(
			/(!\[(?:[^[\]]|\[[^\]]*\])*\]\()svg\/([^)\s]+)\)/g,
			`$1/assets/${section}/svg/$2)`,
		);

		targets.set(`${section}/${slug}`, finalContent);
	}

	// SVG 主题契约必须在任何 content-zh/ 或 public/assets/ 写入前检查。
	// SVG 的唯一事实源是 vault;生成目录的全量检查由 check-svg-theme.mjs 负责。
	if (existsSync(VAULT_SVG_DIR)) {
		for (const file of readdirSync(VAULT_SVG_DIR)) {
			if (!file.endsWith(".svg")) continue;
			const owner = parseSvgOwner(file, slugSections);
			if (!owner || !SYNCABLE_STATUS.has(statusMap.get(owner))) continue;
			const source = readFileSync(join(VAULT_SVG_DIR, file), "utf8");
			const theme = validateSvgTheme(source, {
				asset: `svg/${file}`,
				strict: STRICT_SVG_THEME,
			});
			for (const issue of theme.warnings)
				warn(`SVG 主题迁移提示: ${formatSvgThemeIssue(issue)}`);
			for (const issue of theme.errors)
				errors.push(`SVG 主题契约错误: ${formatSvgThemeIssue(issue)}`);
		}
	}

	// 硬错误闸:有则连警告一起全报(只报 ERROR 会吞掉同文件的其他违规),
	// 失败且不写任何产物。
	if (errors.length) {
		for (const msg of warnings) console.warn(`[sync] ${msg}`);
		for (const msg of errors) console.error(`[sync] ERROR ${msg}`);
		process.exit(1);
	}

	// 清除不在目标集里的旧词条(保留 .gitkeep)。
	if (existsSync(OUT_ROOT)) {
		for (const dir of readdirSync(OUT_ROOT, { withFileTypes: true })) {
			if (!dir.isDirectory()) continue;
			for (const file of readdirSync(join(OUT_ROOT, dir.name))) {
				if (!file.endsWith(".md")) continue;
				const key = `${dir.name}/${file.slice(0, -3)}`;
				if (!targets.has(key)) {
					rmSync(join(OUT_ROOT, dir.name, file));
					console.log(`[sync] 清除过期词条: ${key}`);
				}
			}
		}
	}

	// 插图同步:vault svg/ → public/assets/<section>/svg/,与词条同生命周期。
	const expectedSvgs = new Map(); // section -> Set(filename)
	if (existsSync(VAULT_SVG_DIR)) {
		for (const file of readdirSync(VAULT_SVG_DIR)) {
			if (!file.endsWith(".svg")) continue;
			const owner = parseSvgOwner(file, slugSections);
			if (!owner) {
				warn(`svg/${file}: 文件名不符约定 <slug>.<n>.svg 或 slug 未知,跳过`);
				continue;
			}
			if (!SYNCABLE_STATUS.has(statusMap.get(owner))) continue; // 未写/草稿/退役不同步
			const ownerSection = slugSections.get(owner);
			if (!expectedSvgs.has(ownerSection))
				expectedSvgs.set(ownerSection, new Set());
			expectedSvgs.get(ownerSection).add(file);
		}
		for (const [section, files] of expectedSvgs) {
			const dir = join(ASSETS_ROOT, section, "svg");
			mkdirSync(dir, { recursive: true });
			for (const file of files)
				copyFileSync(join(VAULT_SVG_DIR, file), join(dir, file));
		}
	}

	// 清除不在期望集里的旧插图(退役词条的图随之消失),空目录回收。
	// 只扫 sections.yaml 章节目录:playground 等 repo 手维护资产不参与。
	if (existsSync(ASSETS_ROOT)) {
		for (const dir of readdirSync(ASSETS_ROOT, { withFileTypes: true })) {
			if (!dir.isDirectory() || !sectionDirs.has(dir.name)) continue;
			const svgDir = join(ASSETS_ROOT, dir.name, "svg");
			if (!existsSync(svgDir)) continue;
			const expected = expectedSvgs.get(dir.name) || new Set();
			for (const file of readdirSync(svgDir)) {
				if (!file.endsWith(".svg") || expected.has(file)) continue;
				rmSync(join(svgDir, file));
				console.log(`[sync] 清除过期插图: ${dir.name}/svg/${file}`);
			}
			if (readdirSync(svgDir).length === 0) rmSync(svgDir, { recursive: true });
		}
	}

	for (const [key, content] of targets) {
		const outPath = join(OUT_ROOT, `${key}.md`);
		mkdirSync(join(OUT_ROOT, key.split("/")[0]), { recursive: true });
		writeFileSync(outPath, content);
	}

	for (const msg of warnings) console.warn(`[sync] ${msg}`);
	writeVaultIndex(statusMap);
	const svgCount = [...expectedSvgs.values()].reduce((n, s) => n + s.size, 0);
	console.log(
		`[sync] 同步 ${targets.size} 个词条、${svgCount} 张插图(${VAULT_DIR} → ${OUT_ROOT}/),已刷新 _index.md`,
	);
}

main();
