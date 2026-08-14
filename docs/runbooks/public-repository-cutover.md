# 公开仓库历史整改

## 警告

该流程会重写 Git 提交 ID，并需要对远端执行带 lease 的强制更新。执行前必须
停止 Pages 部署，通知所有协作者，并创建可恢复 bundle。不要在当前工作区直接
运行历史重写。

## 停止条件

- 当前工作区不干净。
- 远端存在未纳入审计的分支或标签。
- `npm run check:public-release` 失败。
- 历史门禁仍报告禁止路径。
- 凭据扫描存在未解决命中。
- 无法确认远端旧 `main` 的提交 ID。

## 执行顺序

1. 暂停 GitHub Pages 或把发布源改为不自动部署。
2. 记录远端分支、标签和 `main` 提交 ID。
3. 创建远端仓库的隔离镜像和可恢复 bundle。
4. 在隔离镜像中获取待发布的本地 `main`。
5. 使用 `git-filter-repo` 从全部历史删除以下路径：
   - `public/theme/`
   - `public/styles/zh-overrides.css`
   - `public/media/`
   - `reference/home.html`
   - `reference/entry.html`
   - `reference/category.html`
   - `scripts/fetch-assets.mjs`
6. 对隔离镜像运行 `npm run check:public-history -- <mirror>`。
7. 对隔离镜像运行凭据扫描，并解决全部命中。
8. 比较清理前后的远端分支与标签集合。
9. 使用远端旧 `main` 提交作为 `--force-with-lease` 边界替换 `main`。
10. 将本地检出对齐到已审计的新提交。
11. 恢复 GitHub Pages 的 GitHub Actions 发布源。
12. 触发工作流并核对线上页面、控制台和运行时资源。

## 回退

- 部署失败时先暂停 Pages，不要立即恢复旧历史到公开仓库。
- 使用 cutover 前 bundle 恢复时，先把仓库设为私有。
- 发现凭据或来源不明材料时，保持仓库私有并重新审计。
