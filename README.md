# 程序为什么能组合

蒸馏 Bartosz Milewski《Category Theory for Programmers》的结构化范畴论学习库:
从「组合是编程的本质」出发,到函子、自然变换、极限,再到伴随与单子。
每个概念先在 Rust 里落地一次;Haskell 只在表达力对照处出场,不出现 C++。

**词条是学习成果的正式沉淀:一个概念写成词条才算学完。**
`sections.yaml` 先定义全部章节与词条(5 部分 18 章 66 词条);未完成词条保留为
TODO,随后按学习依赖逐篇编写、核验并发布。

## 架构:vault 是事实源,repo 是渲染器

词条唯一事实源位于 Obsidian vault 的
`03 - AREAS/learning/why-programs-compose/`。`content-zh/` 是 `npm run sync` 的
纯产物,不手工修改。写作约定(结构、练习、文风、SVG)见 vault 飞地的 `_README.md`。

写作完成后,把 vault 词条的 `status` 改为 `complete`,从 `sections.yaml` 的
`known_absent` 移除对应 slug,再运行同步、测试与构建。

第一遍学习从 [学习路径](learn/) 进入;路径数据位于 `learning-paths.yaml`。
术语译法沿承 vault 旧译项目(composition=组合 等),全表见 `glossary/glossary.md`。

## 常用命令

```bash
npm run sync                  # vault → content-zh 单向同步
npm test                      # 单元测试与视觉契约
npm run build                 # 构建 dist/ 并检查公式、插图和静态链接
npm run dev                   # 本地预览
```

## 结构

- `sections.yaml`:章节骨架与 `known_absent` TODO 列表。
- `content-zh/<section>/<slug>.md`:同步产物。
- `public/assets/<section>/svg/`:从 vault 同步的原创插图(paper-ink-v1 明暗契约)。
- `scripts/sync-from-vault.mjs`:同步管道(含中文排版 lint、旁注/布局/SVG 门禁)。
- `learning-paths.yaml`:第一遍主线、记号前置层与参考轨。
- `docs/authoring/`:旁注、Tufte 布局、SVG 主题的作者规范。
- `playground/rendering.md`:渲染管线回归夹具。

## 来源与许可

- 概念骨架与部分练习蒸馏自 [Category Theory for Programmers](https://github.com/hmemcpy/milewski-ctfp-pdf)
  (Bartosz Milewski,CC BY-SA 4.0);本库词条为中文原创重述,含原创 Rust 实现。
- 渲染器 fork 自 [why-models-learn](https://github.com/master-g/why-models-learn);
  其数学渲染、搜索与中文排版 lint 源自 algebrica-zh 的 MIT 许可代码。
- 中文词条与原创插图按 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
  提供(与 CTFP 的 share-alike 兼容);原创软件代码采用 MIT License。
- 第三方清单见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
