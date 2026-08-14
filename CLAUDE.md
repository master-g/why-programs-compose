# CLAUDE.md — why-programs-compose

「程序为什么能组合」:蒸馏 CTFP(Category Theory for Programmers)的结构化范畴论学习库。**词条是学习成果的正式沉淀:一个概念写成词条才算学完。** 不做逐章翻译。

## 架构:vault 是事实源,repo 是渲染器

- **词条唯一事实源**:Obsidian vault 飞地 `~/Documents/ObsidianVaults/Main/03 - AREAS/learning/why-programs-compose/<slug>.md`(约定见该目录 `_README.md`)。
- `content-zh/` 是 `npm run sync` 的**纯产物,永不手改**。同步只拷 `status: complete | reference`;wikilink 改写为站内链接;受控 `marginnote`/`marginfigure`/`fullwidth`/`epigraph` 经源校验后保留;frontmatter 只透传 `title`/`tags`。
- 毕业信号:词条写完 → vault 里 `status` 翻为 `complete` → repo `sections.yaml` 的 `known_absent` 移除该 slug。指向未毕业词条的链接自动渲染为纯文本。

## 工作流

```bash
npm run sync    # vault → content-zh 单向同步
npm run dev     # 预览
npm test        # 单元测试 + 视觉契约
npm run build   # 构建 dist/(postbuild 自动查公式/插图/链接)
```

## 已决策事项(2026-08-14 项目启动,勿重开)

- **大纲**:**5 部分 18 章 66 词条**见 `sections.yaml`,蒸馏自 CTFP 三部分结构。Part 0(记号地基,3 词条)是最小前置;further 章为参考轨,长期 TODO 合法。
- **语言政策**:**代码 Rust 为主,先跑后写**(rustc 本地真跑,断言贴进词条);Haskell 只在类型类/惰性/HKT 的表达力对照处出场,不超过一屏;**C++ 一律不出现**。
- **词条格式**:开头定义+定位段(无 TLDR)→ `##` 分节 → 失效模式/反例一节 → `## 练习`(≥2 题,含解答,代码题 Rust、证明题等式推理)→ `## 相关词条`。体裁是长文,不是费曼卡片。
- **文风**:声口参照 Calculus Made Easy(平坐、祛魅、不升华);CTFP 原书的好比喻保留并注明出处;禁用词表与行文规范见 vault `_README.md` 规则 8,旁注硬约束(marginnote 不能以行内数学/代码开头等)见规则 7。**正文标点用全角**(，：；？),这是 copywriting-lint 的口径。
- **术语**:沿承 vault `03 - AREAS/learning/category-theory/` 旧译项目词汇表(composition=组合、恒等态射、终端对象等),全表在 `glossary/glossary.md`,既有决定不重开。
- **插图**:交换图手绘 SVG 存 vault `svg/<slug>.<n>.svg`,paper-ink-v1 明暗契约(`docs/authoring/svg-theme.md`);自定义颜色走 `svg-special-{text,graphic,fill,background}-<name>` 命名空间。旧译的 webp 位图不搬,一律重绘。
- **旧材料**:CTFP 前 7 章译文在 vault `03 - AREAS/learning/category-theory/`,作参考底稿;该目录 README 的词汇表已迁入本项目。
- **部署**:GitHub Pages 项目页,base `/why-programs-compose`,由 `src/lib/site.config.mjs` 派生进 `src/lib/base.mjs`。站内绝对路径必须经 `withBase()` 或 rehype-prefix-base。
- **站点身份唯一事实源**:`src/lib/site.config.mjs`(仓库名、账号、品牌名、tagline、内容许可)。BASE、仓库链接、主题存储键、vault 目录与环境变量名全部派生,`src/`、`scripts/`、`tests/` 里**不得再出现身份字面量**。每 topic 必改的短文案在 `src/lib/site-copy.mjs`;含链接的整段留在页面里由 `TOPIC:` 注释标出。
- **本仓库是 template repo**:开新 topic 走 `docs/runbooks/new-topic.md`,勿再 fork 上游 why-models-learn(其硬编码计数与 known_absent 限制未修)。
- **fork 放宽的两条校验**(相对上游 why-models-learn):learning-paths 不硬编码分区数量;主线允许 known_absent 词条(全库 TODO 起步,learn 页对未毕业词条渲染纯文本)。

## 骨架

渲染器 fork 自 [why-models-learn](https://github.com/master-g/why-models-learn)(2026-08-14,不带 git 历史);其数学渲染、sectionize、搜索与中文写作 lint 源自 algebrica-zh 的 MIT 许可代码。公开界面使用独立样式 `src/styles/site.css`,不含 Algebrica 主题包/品牌/字体。**LICENSES/、THIRD_PARTY_NOTICES.md 与 about 页的归属声明是复用条件,不可删。**

**渲染试验田**:`playground/rendering.md` → `/playground/` 页,与词条同管线同版式;改管线/样式后肉眼回归用。不进 vault/大纲/首页/搜索。

## 技术栈

- Astro ~7.1.0(静态站点,"type": "module",纯 ESM .mjs;无框架组件,仅 .astro)
- 数学管线:remark-math → rehype-mathjax/svg → rehype-sanitize(自定义 MathJax SVG 白名单),零运行时 JS
- 内容:Astro content collection(glob 扫 `content-zh/*/*.md`),frontmatter 只需 `title`(+ 可选 `tags`)
- 测试:node:test + assert/strict(`node --test`),无测试框架

## 命令

- `make`(无参数)列出全部命令——npm 脚本的薄封装:`make sync / dev / build / test / preview / check-search / install`
- `make sync` 写词条后必跑;`make test` 须全绿

## 代码风格

- 管线文件注释用中文;内部插件文件名沿用 algebrica 命名(历史遗留,勿改)
- 词条正文:`##`(h2)分节(sectionize 插件依赖);站点侧交叉链接是 `../section/slug/` 相对路径(sync 生成)
- vault 侧写作用 Obsidian 习惯(`[[slug|中文名]]`、callout),同步脚本负责适配,站点侧不手写 wikilink

## 禁止文件

- `content-zh/` 与 `public/assets/<section>/` 下所有文件——同步产物,手改会被下次 sync 覆盖/清除(`public/assets/playground/` 例外,手维护)
- `dist/`、`node_modules/`、`.astro/`(gitignore)
- `public/theme/`、`public/styles/zh-overrides.css`——上游禁入清单,不得进入当前树或 Git 历史

## 审查规则

- 词条验收:概念讲透 + 失效模式一节 + `## 练习` 含解答且代码真跑过 + 结尾 `## 相关词条`
- 自动闸:`npm run sync` 跑 copywriting-lint(LINT 警告回 vault 修;LINT-ERROR/SIDENOTE-ERROR/LAYOUT-ERROR/SVG 契约错误 = sync exit 1 不写产物);`npm run build` postbuild 查 `mjx-error`、插图 404、全站内部引用与 SVG 主题
- `npm test` 必须全绿;视觉契约约束 BaseLayout/index/[slug] 结构,改页面时同步改测试
- sections.yaml 的 slug 与 vault 文件名一一对应;新词条先进 sections.yaml + known_absent
- 提交信息:`type(scope): 中文描述`,直接提交 main

## 项目记忆 (回写约定)

跨会话的持久信息记录在 [PROJECT_MEMORY.md](./PROJECT_MEMORY.md)。
**完成每个重要任务后务必回写**: 把确认的决策写入「已验证的事实」、踩的坑写入「失败尝试」、用进展更新「上次会话」、把计划写入「下次运行」。
