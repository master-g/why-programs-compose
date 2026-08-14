.DEFAULT_GOAL := help

.PHONY: help sync dev build test preview check-search check-licenses check-public-release check-public-history install

help: ## 列出全部命令
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-14s %s\n", $$1, $$2}'

install: ## 安装依赖
	npm install

sync: ## vault → content-zh 单向同步
	npm run sync

dev: ## 本地预览
	npm run dev

build: ## 构建到 dist/
	npm run build

test: ## 单元测试 + 视觉契约
	npm test

preview: ## 预览构建产物
	npm run preview

check-search: ## 搜索冒烟(需先 make build;词条未写齐时 FAIL 属预期)
	node scripts/check-search.mjs

check-licenses: ## 检查依赖许可元数据与第三方声明
	npm run check:licenses

check-public-release: ## 检查当前文件树与构建产物的公开发布边界
	npm run check:public-release

check-public-history: ## 检查全部可达 Git 历史中的禁止路径
	npm run check:public-history

