.PHONY: help install dev build preview clean
.DEFAULT_GOAL := help

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

dev: ## Start dev server
	npm run dev

build: ## Build for production
	npm run build

preview: ## Preview production build
	npm run preview

clean: ## Remove dist and node_modules
	rm -rf dist node_modules
