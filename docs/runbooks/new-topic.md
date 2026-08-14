# 用本仓库开一个新 topic

本仓库是 GitHub template repo。渲染管线、数学与旁注排版、SVG 明暗契约、学习路径、
搜索与四道发布门禁全部与 topic 无关,直接继承;只有身份、文案、大纲需要重写。

先读一遍「省不掉的部分」再决定要不要开:替换字符串是半天,设计大纲是几周。

## 零、模板与学习库是同一个仓库

本仓库一边继续推进自己的 topic,一边充当模板。**Use this template** 复制的是当时默认分支的
完整文件树快照 —— 包括已毕业的词条、插图、大纲与术语表,但不含 Git 历史、Pages 设置与 secrets。

要删的都是整目录,清空成本不随源 topic 的写作进度增长(见第五节)。唯一随进度变化的是
**内容许可的约束**:源 topic 的词条许可会跟着复制过来,不删干净就不能换许可(见第二节)。

## 一、开仓库

1. 在 GitHub 点 **Use this template** 建新仓库。
2. **先启用 Pages,再推第一个提交**:
   ```bash
   gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow
   ```
   新仓库继承 `.github/workflows/deploy.yml`,首次 push 会立刻触发部署;Pages 未启用时
   `configure-pages` 步骤直接失败,留一条红色的运行记录。
3. 克隆到本地,`npm install`。

## 二、改身份(唯一事实源)

改 `src/lib/site.config.mjs` 的 `SITE` 对象,只有五个字段:

| 字段 | 作用 | 派生出 |
|---|---|---|
| `repo` | GitHub 仓库名 | `BASE` 路径、vault 飞地目录、`<REPO>_VAULT_DIR` 环境变量名、主题存储键、vault 索引标题 |
| `owner` | GitHub 账号 | 仓库链接、`<owner>.github.io` 站点源 |
| `brandZh` | 品牌名 | 页头、footer、全站 title 后缀 |
| `taglineZh` | 品牌名下的副标题 | 页头 |
| `contentLicense` | 正文与插图的许可 | footer、about 页、词条页脚 |

**许可要先想清楚,后面不好改。** 源材料带 share-alike(如 CC BY-SA)时,衍生内容必须沿用同款,
不能加 NC 条款;全原创的 topic 可以用 CC BY-NC-SA 4.0。改完这里,`LICENSE.md` 与
`README.md` 里的许可段落要手动同步 —— `npm test` 会校验 README 与配置一致,不一致直接红。

**换许可前必须先清空源 topic 的内容(第五节)。** 模板带来的词条继承的是源 topic 的许可;
源 topic 是 CC BY-SA 而新 topic 想用 CC BY-NC-SA 时,仓库里若还留着旧词条,
就同时存在 NC 声明和 share-alike 衍生内容 —— 这是实质性的许可冲突,不是整洁问题。
许可相同时没有这条约束,但旧内容仍应删掉。

## 三、改文案

`src/lib/site-copy.mjs` 收了首页 hero、关于页定位、学习路径页导语这三处必改的短文案,
逐条改完即可。`footerCta.sectionDir` 要指向本 topic 前置层所在的章节目录。

含链接的整段留在页面里,由源码中的 `TOPIC:` 注释标出,目前只有一处:

- `src/pages/about.astro` 的「许可范围」首段 —— 源材料的书名、作者、原作许可与「重述」边界。

## 四、改无法派生的元数据

这些文件不读配置,手改:

| 文件 | 改什么 |
|---|---|
| `package.json` | `name` |
| `README.md` | 全文重写(项目介绍、大纲规模、命令说明) |
| `CLAUDE.md` | 全文重写(架构约定、语言政策、词条格式、术语来源) |
| `LICENSE.md` | 正文许可段落与源材料归属 |
| `THIRD_PARTY_NOTICES.md` | 仓库链接 |
| `.github/workflows/deploy.yml` | 顶部注释里的站点 URL |
| `docs/authoring/*.md` | 三篇里的示例路径与 slug |
| `public/favicon.svg` | 重画;明暗主题契约见 `docs/authoring/svg-theme.md` |

`LICENSES/`、`THIRD_PARTY_NOTICES.md` 与 about 页的 algebrica-zh 归属声明**不可删** —— 那是复用条件。

## 五、重建内容骨架

先删干净。两条命令,与源 topic 写了多少词条无关:

```bash
rm -rf content-zh/*/
find public/assets -mindepth 1 -maxdepth 1 -type d ! -name playground -exec rm -rf {} +
```

`public/assets/playground/` 必须留 —— 它是手维护的渲染回归夹具,不参与同步。
`src/lib/dangling-links.json` 目前是空表;源 topic 若在里面登记过别名或外链,一并清空。

剩下的没有捷径,是真正的工作量:

1. `sections.yaml` —— 设计 parts / sections / entries 三层大纲,全部 slug 进 `known_absent`。
2. `learning-paths.yaml` —— 第一遍主线、前置层、参考轨。
3. `glossary/glossary.md` —— 术语表清空重写。
4. vault 里建飞地 `03 - AREAS/learning/<repo>/` 并写 `_README.md` 写作约定。
5. 测试夹具里的示例 slug:`tests/unit/article-navigation.test.mjs`、`learning-paths.test.mjs`、
   `content-inventory.test.mjs` 引用了当前 topic 的 slug 与 part id,按新大纲改写。

## 六、陷阱

按踩过的顺序列,每条都造成过实际故障:

- **章节目录名不能与词条 slug 同名。** 同名会让 wikilink 改写产生歧义(本项目因此把
  `category` 章改成 `categories`)。
- **条件分支里的 section id 会随大纲改名一起失效。** 从 why-models-learn fork 时漏改
  `stage.id === 'math-core'`,条件永远为 false,前置层整个渲染不出来,且没有任何报错。
  改大纲后搜一遍 `src/` 里所有比较 section / stage / part id 的字面量。当前用的是
  `stage.kind === 'core-math'`(语义标记,不随改名失效),新增分支照此办理。
- **正文标点用全角**(，：；？)。这是 `copywriting-lint` 的口径,半角会在 `npm run sync` 报警。
- **旁注不能以行内数学或代码开头。** `rehype-sidenotes` 要求标签行之后的首个文本节点非空,
  否则抛错;而 glob-loader 会把这个异常吞成日志,产出空正文页面并静默通过全部门禁。
  `tests/unit/content-render.test.mjs` 的渲染冒烟专为堵这个漏洞而存在,不要删。
- **主题存储键必须带仓库名。** 同账号的多个项目页共用 `<owner>.github.io` 这一个 origin,
  键不带仓库名会让不同 topic 的明暗设置互相覆盖。已由 `THEME_STORAGE_KEY` 派生保证。
- **代码块语言要先在 shiki 里可用。** 新 topic 换语言(wgsl、asm 等)时确认高亮生效,
  双主题配置在 `src/lib/shiki-theme.mjs`。

## 七、验证并发布

```bash
npm test                      # 155 项,必须全绿
npm run build                 # 含 postbuild:公式、插图、SVG 主题、全站内部引用
npm run check:public-release   # 发布边界
```

Pages 已在第一节启用,推送即部署。核对线上首页、`/learn/`、`/category/` 均为 200。

**推送可能被 workflow scope 拦。** 仓库含 `.github/workflows/`,而 gh 的默认 token 没有
`workflow` scope,首次推送报 `refusing to allow an OAuth App to create or update workflow`。
跑一次 `gh auth refresh -h github.com -s workflow` 即可。
(SSH 也能绕过,但全局 git config 里的 `url.https://github.com/.insteadOf git@github.com:`
会把 `git@github.com:` 形式重写回 HTTPS,remote 得写成 `ssh://git@github.com/<owner>/<repo>.git`。)
