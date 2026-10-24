.PHONY: build build-arm build-amd build-package clean help

build: ## Build for the current macOS architecture
	cargo tauri build

build-arm: ## Build for Apple Silicon
	cargo tauri build --target aarch64-apple-darwin

build-amd: ## Build for Intel
	cargo tauri build --target x86_64-apple-darwin

build-package: build ## Build the macOS application bundle

clean: ## Remove Tauri build output
	cargo clean --manifest-path src-tauri/Cargo.toml

help: ## Display available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
