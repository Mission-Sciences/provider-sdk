# Makefile for Marketplace Provider SDK

.PHONY: help
help: ## Show this help message
	@echo "Marketplace Provider SDK - Available targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development
.PHONY: install
install: ## Install dependencies
	npm install

.PHONY: dev
dev: ## Start development server
	npm run dev

.PHONY: build
build: ## Build the SDK
	npm run build

.PHONY: clean
clean: ## Remove build artifacts
	rm -rf dist/
	rm -rf node_modules/

# Testing
.PHONY: test
test: ## Run unit tests
	npm run test

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	npm run test:watch

.PHONY: test-coverage
test-coverage: ## Run tests with coverage report
	npm run test:coverage

# Code Quality
.PHONY: lint
lint: ## Run ESLint
	npm run lint

.PHONY: format
format: ## Format code with Prettier
	npm run format

# Terraform (CodeArtifact setup)
.PHONY: tf-init
tf-init: ## Initialize Terraform
	cd terraform && terraform init

.PHONY: tf-plan
tf-plan: ## Plan Terraform changes
	cd terraform && terraform plan

.PHONY: tf-apply
tf-apply: ## Apply Terraform changes (creates CodeArtifact)
	cd terraform && terraform apply

.PHONY: tf-destroy
tf-destroy: ## Destroy Terraform resources
	cd terraform && terraform destroy

.PHONY: tf-output
tf-output: ## Show Terraform outputs
	cd terraform && terraform output

# CodeArtifact Publishing
.PHONY: ca-login
ca-login: ## Login to CodeArtifact
	aws codeartifact login --tool npm --domain ghostdogbase --repository sdk-packages --region us-east-1

.PHONY: publish
publish: build ca-login ## Build and publish to CodeArtifact
	npm publish

.PHONY: version-patch
version-patch: ## Bump patch version (0.1.0 -> 0.1.1)
	npm version patch

.PHONY: version-minor
version-minor: ## Bump minor version (0.1.0 -> 0.2.0)
	npm version minor

.PHONY: version-major
version-major: ## Bump major version (0.1.0 -> 1.0.0)
	npm version major

# Complete release workflow
.PHONY: release-patch
release-patch: version-patch publish ## Bump patch version and publish
	git push origin main --tags

.PHONY: release-minor
release-minor: version-minor publish ## Bump minor version and publish
	git push origin main --tags

.PHONY: release-major
release-major: version-major publish ## Bump major version and publish
	git push origin main --tags

# Test Server (for local JWT testing)
.PHONY: test-server
test-server: ## Start test server with JWT validation
	npm run test-server

.PHONY: generate-keys
generate-keys: ## Generate RSA key pair for testing
	npm run generate-keys

.PHONY: generate-jwt
generate-jwt: ## Generate test JWT (usage: make generate-jwt MINUTES=60)
	npm run generate-jwt -- $(or $(MINUTES),60)

# Quick Setup
.PHONY: setup
setup: install generate-keys ## Complete setup for new developers
	@echo "✓ Dependencies installed"
	@echo "✓ Test keys generated"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Run 'make test-server' to start test server"
	@echo "  2. Run 'make generate-jwt' to create test JWT"
	@echo "  3. Visit http://localhost:3000?jwt=<YOUR_JWT>"

# CodeArtifact Setup
.PHONY: setup-codeartifact
setup-codeartifact: tf-init tf-apply ## Deploy CodeArtifact infrastructure
	@echo ""
	@echo "✓ CodeArtifact setup complete!"
	@echo ""
	@cd terraform && terraform output -raw setup_commands

# Common workflows
.PHONY: ci
ci: lint test build ## Run full CI checks locally
	@echo "✓ All CI checks passed"

.PHONY: check
check: lint test ## Quick check before commit
	@echo "✓ Code quality checks passed"
