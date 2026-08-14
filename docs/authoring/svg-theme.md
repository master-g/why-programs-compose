# SVG 主题作者规范

本文档约束 vault 中的原创插图。插图必须同时适配纸色浅色主题和黑色暗色主题。

## 文件边界

只编辑 vault 中的源文件：

`~/Documents/ObsidianVaults/Main/03 - AREAS/learning/why-models-learn/svg/`

`content-zh/` 与 `public/assets/` 都是 `npm run sync` 生成的产物。不要手工编辑这两个目录中的插图。

同步管道会在写入产物前检查主题契约。缺少契约的新增 SVG 会使严格同步失败。

## 最小结构

根元素声明契约版本，并在同一个 SVG 内提供浅色规则和暗色规则：

```svg
<svg data-svg-theme="paper-ink-v1" viewBox="0 0 320 180">
  <style>
    .svg-page-fill { fill: #faf9f5; }
    .svg-ink-stroke { stroke: #312f2f; }
    @media (prefers-color-scheme: dark) {
      .svg-page-fill { fill: #151515; }
      .svg-ink-stroke { stroke: #f0efe8; }
    }
  </style>
  <rect class="svg-page-fill" width="320" height="180"/>
  <path class="svg-ink-stroke" d="M20 150H300"/>
</svg>
```

主题切换由浏览器的 `prefers-color-scheme` 触发。不要复制两套几何结构，也不要在 SVG 外层依赖页面 CSS 传递颜色。

## 标准角色

优先使用下表中的标准角色。`-fill` 和 `-stroke` 后缀只表达 SVG 属性，不改变角色语义。

| 角色 | 浅色值 | 暗色值 | 用途 |
| --- | --- | --- | --- |
| `svg-page` | `#faf9f5` | `#151515` | 页面底色 |
| `svg-ink` | `#312f2f` | `#f0efe8` | 主文字、主线条 |
| `svg-muted` | `#6c6a64` | `#aaa9a1` | 次要文字 |
| `svg-axis` | `#b8b2a8` | `#8b8a83` | 坐标轴与辅助线 |
| `svg-divider` | `#e1ddd7` | `#4f4f49` | 分隔线 |
| `svg-coral-text` | `#a9583e` | `#dc896d` | 强调文字 |
| `svg-coral-stroke` | `#cc785c` | `#e28466` | 强调线条 |

标准角色的颜色值固定。不要为同一个标准角色添加第三个颜色值。

## 专用角色

当插图需要保留独立于标准调色板的颜色时，使用以下命名空间：

- `svg-special-text-<name>`：文字或文字继承的颜色，浅色与暗色均至少达到 4.5:1 对比度。
- `svg-special-graphic-<name>`：线条、轮廓或小面积图形，浅色与暗色均至少达到 3:1 对比度。
- `svg-special-fill-<name>`：一般填充图形，浅色与暗色均至少达到 3:1 对比度。
- `svg-special-background-<name>`：大面积背景填充。该角色用于保留面积色与页面背景的层次，不承担文字可读性。

每个专用角色在浅色媒体规则和暗色媒体规则中各定义一个十六进制颜色。暗色规则必须位于：

```css
@media (prefers-color-scheme: dark) { ... }
```

渐变的 `stop-color` 也必须通过角色类提供明暗值。`url(#id)`、`none`、`transparent` 等非颜色绘制值可以保留，但引用的 `id` 必须在同一个 SVG 内存在。

RGBA 颜色迁移时会拆为角色颜色和对应的 `fill-opacity`、`stroke-opacity` 等声明。新增插图应优先使用不透明十六进制颜色，以便审查结果稳定。

## 迁移命令

先分析，不写文件：

```bash
node scripts/migrate-svg-theme.mjs path/to/figure.svg
```

标准纸墨颜色可以批量自动迁移：

```bash
node scripts/migrate-svg-theme.mjs --apply path/to/standard-svg-directory
```

包含渐变、样式块、RGBA 或自定义颜色的插图使用专用迁移路径：

```bash
node scripts/migrate-svg-theme.mjs --apply-specialized path/to/svg-directory
```

专用迁移会先在内存中完成全部文件的转换和契约检查。任意文件失败时，不写入该批次的文件。

## 提交前检查

从仓库根目录运行：

```bash
npm run sync
npm run check:svg-theme
npm test
npm run build
```

`npm run check:svg-theme` 检查 `public/assets/`。构建后的 `postbuild` 会再次检查 `dist/assets/`，因此不能只检查源文件而忽略发布产物。

迁移工具必须保持结构投影不变。允许变化的内容只有主题标记、颜色样式、语义类和透明度属性。不要在迁移过程中调整坐标、文本、路径、渐变结构或内部引用。
