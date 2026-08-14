# PROJECT_MEMORY — why-programs-compose

## 已验证的事实

- 2026-08-14 项目启动:渲染器 fork 自 why-models-learn(不带 git 历史),复用手册要点已落实——base.mjs、sync vault 路径(env `WHY_PROGRAMS_COMPOSE_VAULT_DIR`)、品牌串、learning-paths 硬编码 part id(改为 `foundations`)。
- fork 放宽两条校验:learning-paths.mjs 不再硬编码 core/backfill/reference 数量;主线允许 known_absent 词条(learn 页渲染纯文本)。
- 大纲 5 部分 18 章 66 词条;section dir 避免与 slug 同名(categories/functors 用复数),否则 wikilink 改写歧义。
- 内容许可 CC BY-SA 4.0(非上游的 NC 版):CTFP 是 CC BY-SA,share-alike 禁止衍生内容加 NC 条款。LICENSE.md/about/BaseLayout/[slug]/public-release 测试已同步。
- copywriting-lint 口径:正文标点全角(，：；？);半角逗号在部分上下文不报警但全角是 house style。旁注(marginnote)禁行内代码。
- SVG 契约:自定义颜色类必须走 `svg-special-{text,graphic,fill,background}-<name>` 命名空间;标准 coral 角色只有 -text 与 -stroke,fill 用 special。
- 首词条 category(范畴)已毕业:sync 零告警,Rust 代码 rustc 真跑通过。

## 失败尝试

- `node --test tests/unit/` 不展开 glob,要用 `npm test`(pattern 'tests/**/*.test.mjs')。
- 词条初稿按 vault 半角标点风格写,与站点全角口径冲突,返工一轮;新词条直接写全角。

## 上次会话(2026-08-14)

- 完成 repo 脚手架、sections.yaml、learning-paths.yaml、glossary(迁自旧译词汇表)、CLAUDE/README/LICENSE、内容耦合测试改写(learning-paths、article-navigation、render-page-structure 夹具、删 3 个 WML 试点测试)、playground 链接替换、首词条 category + SVG。

## 下次运行

- 按 first-pass 顺序写词条:sets-and-functions → haskell-notation → rust-type-system → what-is-composition → identity-morphism → composition-in-rust。
- Part I 词条有旧译底稿(vault `03 - AREAS/learning/category-theory/`,★ 对照表见其 README),蒸馏不翻译。
- 建 GitHub 仓库 master-g/why-programs-compose 并推送后,Pages 工作流会自动部署。
- 可选:为旁注/Tufte 布局补本项目的 pilot 测试(上游删掉的三个)。
