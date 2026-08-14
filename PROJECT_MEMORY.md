# PROJECT_MEMORY — why-programs-compose

## 已验证的事实

- 2026-08-14 项目启动:渲染器 fork 自 why-models-learn(不带 git 历史),复用手册要点已落实——base.mjs、sync vault 路径(env `WHY_PROGRAMS_COMPOSE_VAULT_DIR`)、品牌串、learning-paths 硬编码 part id(改为 `foundations`)。
- fork 放宽两条校验:learning-paths.mjs 不再硬编码 core/backfill/reference 数量;主线允许 known_absent 词条(learn 页渲染纯文本)。
- 大纲 5 部分 18 章 66 词条;section dir 避免与 slug 同名(categories/functors 用复数),否则 wikilink 改写歧义。
- 内容许可 CC BY-SA 4.0(非上游的 NC 版):CTFP 是 CC BY-SA,share-alike 禁止衍生内容加 NC 条款。LICENSE.md/about/BaseLayout/[slug]/public-release 测试已同步。
- copywriting-lint 口径:正文标点全角(，：；？);半角逗号在部分上下文不报警但全角是 house style。旁注(marginnote)禁行内代码。
- SVG 契约:自定义颜色类必须走 `svg-special-{text,graphic,fill,background}-<name>` 命名空间;标准 coral 角色只有 -text 与 -stroke,fill 用 special。
- 首词条 category(范畴)已毕业:sync 零告警,Rust 代码 rustc 真跑通过。
- 2026-08-14 categories 章四篇全毕业(440d316):what-is-composition、category、identity-morphism、composition-in-rust。known_absent 从 66 降到 63。三篇的 Rust 代码经 rustc 1.97.1 真跑,编译错误信息(E0525/E0382/E0284/E0373/E0308)原样贴进词条。
- **写词条时两条硬约束是踩出来的**:(1) 正文行内代码不能含 `::`,copywriting-lint 判为「标点重复使用」——写 `str::len` 会报 LINT,改成描述性说法或放进代码块;(2) 旁注(marginnote)内不能有任何行内代码,含 trait 名也不行,直接 SIDENOTE-ERROR 阻断 sync,把 Fn/FnMut/FnOnce 写成不带反引号的普通文本即可。
- 2026-08-14 本仓库已参数化为 topic 模板(2febcbd,GitHub `is_template=true`):身份唯一事实源 `src/lib/site.config.mjs`(repo/owner/brandZh/taglineZh/contentLicense 五个字段),BASE、仓库链接、主题存储键、vault 目录与 env 名全部派生;每 topic 必改的短文案在 `src/lib/site-copy.mjs`;换 topic 步骤见 `docs/runbooks/new-topic.md`。已实测:改这 5 个字段 + build,title/BASE/品牌/tagline/主题键/仓库链接/许可全站跟随,唯一残留是词条 frontmatter 的 tag(随 content-zh 一起重建,非缺陷)。**新 topic 从本仓库 Use this template,不要再 fork why-models-learn**(其硬编码 17/56/21 计数与「主线不容 known_absent」未修)。
- WML → WPC 的 fork 成本实测:身份串约 50 处 / 12 文件、领域文案约 15 处 / 3 页面、通用性缺陷 5 处(已在 WPC 修完)、测试夹具 3 文件;site.css 2495 行与整条管线零改动。
- 2026-08-14 远程仓库与 Pages 上线:`master-g/why-programs-compose`(public),Pages 构建源为 `build_type=workflow`(gh api POST `/repos/:owner/:repo/pages` 设定),站点 https://master-g.github.io/why-programs-compose/ 三个入口页(/、/learn/、/category/)返回 200。

## 失败尝试

- **shiki 单主题 + 行内样式压样式表**:上游只配了浅色 min-light 重映射,`background-color:#ffffff` 行内样式压过 `.article-section pre` 的 --note 底色,暗色主题下白底浅色 token 全盘失效;且 _render-page 入口(glossary/learn/playground)根本没接 shikiConfig,吃 shiki 默认主题。修复:`src/lib/shiki-theme.mjs` 双主题唯一事实源(paper-ink-light/dark),shikiConfig 放进 createArticleMarkdownPipeline 供两个入口共用,site.css 用 `html[data-theme="black"]` + `--shiki-dark` 变量激活暗色(!important 压行内样式)。WML 因 Part 0 不写代码未暴露此问题。

- **marginnote 正文不能以 $math$/行内代码开头**:rehype-sidenotes 要求标签行换行后的首个文本节点非空,math 开头会抛「必须包含标签和单段正文」。更危险的是 glob-loader 把该异常吞成 [ERROR] 日志,dev/build 都产出空正文页面并静默通过全部 postbuild 门禁——已加 tests/unit/content-render.test.mjs 渲染冒烟堵住。

- `node --test tests/unit/` 不展开 glob,要用 `npm test`(pattern 'tests/**/*.test.mjs')。

- **写 composition-in-rust 时两个「以为会失败」的假设被实测推翻**:(1) 以为 compose 组合不了「返回借用自输入的引用」的函数(如 first_word 与 trim_dot),实测能编译并输出正确结果——单态化时 A、B 各自取到具体生命周期即可,代价是结果不再对任意生命周期多态;(2) 以为两个闭包都不标注参数类型就推断不出,实测有下游调用点时能推断,只有结果完全不使用才报 E0284。**词条里的每条限制都必须先跑一遍再写**,凭 Rust 经验推断会写出错误断言。

- **fork 时漏改条件分支里的 section id**:WML → WPC 漏了 `learn.astro` 的 `stage.id === 'math-core'`(上游 section id),改名后条件永远 false,记号前置阶段整个渲染不出来且无任何报错。现已改为语义标记 `stage.kind === 'core-math'`。改大纲后必须搜一遍 `src/` 里比较 section/stage/part id 的字面量——纯字符串替换发现不了这类失效。

- **首次推送被 workflow scope 拒绝**:gh token scope 为 `gist, read:org, repo`,推送含 `.github/workflows/deploy.yml` 的提交时报 `refusing to allow an OAuth App to create or update workflow`。改用 SSH 推送即可绕过,但全局 git config 有 `url.https://github.com/.insteadOf git@github.com:`,`git@github.com:` 形式的 remote 会被重写回 HTTPS;remote 必须写成 `ssh://git@github.com/<owner>/<repo>.git`(该前缀不匹配 insteadOf 规则)。另一条路是 `gh auth refresh -h github.com -s workflow`。
- 词条初稿按 vault 半角标点风格写,与站点全角口径冲突,返工一轮;新词条直接写全角。

- 2026-08-14 去 WML 化完成(2913760):主页 hero、about、learn、category 页、article-navigation 文案、docs/authoring 三篇路径与示例、sync 脚本索引标题、astro.config 注释全部改为 WPC;learn.astro 的 `stage.id === 'math-core'` 改为 `stage.kind === 'core-math'`(否则记号前置阶段走不进 math-groups 渲染分支);空的 backfill/reference/支线区块加条件隐藏;visual-contracts 里 WML 硬编码 17/56/21 断言改为通用断言。保留:README/CLAUDE/LICENSES 的 fork 归属声明、测试夹具内的合成范数示例。

- 2026-08-14 本页大纲上线(8316367):src/components/ArticleOutline.astro,数据取 `render(entry)` 的 headings(只取 h2,少于 2 个不渲染)。布局几何:容器 1080px 居中,旁注悬挂止于 50%+460px;≥1360px 右栏 fixed 于 `left: calc(50% + 480px)` 宽 200px 与旁注零冲突;1040–1359px 退化为右上角 `<details>` pill;<1040px 隐藏。滚动高亮用「视口 140px 阅读线以上最后一个标题」语义(scroll + rAF,同 VitePress),渐进增强,无 JS 时右栏为纯锚点列表。
- **内联脚本陷阱**:组件 DOM 在正文之前,`<script is:inline>` 同步执行时 h2 尚未解析,`getElementById` 全空导致静默 return——必须等 DOMContentLoaded 再 init。首版踩过,dump-dom 验证时发现。
- 页宽体系(409b509):site-shell 纸面卡片 1180px,正文容器 1080px,**site-header inner 与正文同用 `min(1080px, calc(100% - 96px))` 对齐**(≤760px 时 padding 0 20px 对齐正文的 100%-40px);footer 仍是 1180+48 padding(视觉上与正文差 2px,未动)。
- 大纲 rail 布局定稿(7b528a7):不用 fixed 而用**流内 sticky**(`height: 0; margin-left: 1020px; top: 96px`)——DOM 位置在 header 之后,初始就落在 article-header 分割线下方(同 VitePress aside),滚动后吸附,分割线不再穿过控件;title 加 34px padding-top 与 article-content 的 border-top 对齐。pill 长标题:标题 span 220px 省略号,`·n/m` 计数独立 span 放省略区外。rail 长标题自然折行,marker 随行高伸展(已用 patch dist 长标题截图验证)。
- **导语列宽陷阱**(1e924a5):sectionize 只包裹首个 h2 之后的内容,导语 p 是 `.article-content` 直接子元素,无 680px 约束会横穿 1080px 容器并压到宽屏大纲栏——已用 `.article-content > p/blockquote { max-width }` 兜住。同 commit:rail 高亮改为滑动 marker(transform/height 过渡,pill 保留左线),h2 加 `scroll-margin-top: 90px`,搜索 kbd 9→12px。

## 上次会话(2026-08-14)

- 写词条:categories 章毕业三篇(what-is-composition、identity-morphism、composition-in-rust),代码全部 rustc 真跑,sync 零告警,测试 156 全绿,build 27 页 410 内部引用。
- 模板化:量化 WML→WPC 的 fork 成本后做参数化(档 2 方案),新增 site.config.mjs / site-copy.mjs / new-topic.md,BaseLayout 统一 title 后缀(消 6 处重复),测试常量改派生并加「身份字面量不得进 src/scripts/tests」守卫(156 项全绿),仓库设为 GitHub template。
- 发布上线:本地跑通 check:public-history / npm test(155 通过)/ npm run build(24 页,postbuild 全绿)/ check:public-release(94 个追踪文件),`gh repo create` 建 public 仓库,SSH 推送 main,启用 Pages(workflow 构建源),Actions build+deploy 全绿,线上三个入口页 200。
- 完成 repo 脚手架、sections.yaml、learning-paths.yaml、glossary(迁自旧译词汇表)、CLAUDE/README/LICENSE、内容耦合测试改写(learning-paths、article-navigation、render-page-structure 夹具、删 3 个 WML 试点测试)、playground 链接替换、首词条 category + SVG。

## 下次运行

- **交接就绪(2026-08-14 审计)**:CLAUDE.md、README、vault `_README.md` 三份文档已对齐,踩过的坑(全角标点、marginnote 硬约束、插图位置判断)全部落入 `_README.md` 规则 6–8;写作 agent 从 vault `_README.md` 入手即可,无需读本文件历史。
- 下一批词条:记号前置三篇(sets-and-functions、haskell-notation、rust-type-system),它们是 learning-paths 的 core 层;之后进 types-and-functions 章(types-as-sets、void-unit-bool、pure-functions)。已毕业词条里有 6 处指向 types-as-sets、monoid、functor、isomorphism、universal-construction 的链接在等它们。
- Part I 词条有旧译底稿(vault `03 - AREAS/learning/category-theory/`,★ 对照表见其 README),蒸馏不翻译。
- 开第 3、第 4 个 topic 后再评估要不要剥独立模板仓库(档 3):现在只有 2 个实例,三仓库同步的回流成本大于收益。
- deploy.yml 的 actions/checkout@v4、configure-pages@v5、setup-node@v4、upload-artifact@v4 触发 Node.js 20 弃用告警(runner 已强制跑 Node 24,当前不阻塞);升 v5 系列时一并处理。
- 可选:为旁注/Tufte 布局补本项目的 pilot 测试(上游删掉的三个)。
