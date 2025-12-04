#!/bin/bash

# cleanup-validation.sh - Clean up validation artifacts for gw-sdk
#
# This script removes temporary files and artifacts created during
# SDK validation. Run after validation is complete.
#
# Usage:
#   ./scripts/cleanup-validation.sh [OPTIONS]
#
# Options:
#   --dry-run       Show what would be deleted without deleting
#   --keep-coverage Keep coverage reports
#   --verbose       Show detailed output
#   --help          Show this help message

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Options
DRY_RUN=false
KEEP_COVERAGE=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --keep-coverage)
            KEEP_COVERAGE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            head -20 "$0" | tail -18
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

cd "$PROJECT_ROOT"

echo -e "${BLUE}=== gw-sdk Validation Cleanup ===${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN MODE - No files will be deleted${NC}"
    echo ""
fi

# Function to remove directory/file
remove_item() {
    local item="$1"
    local description="$2"

    if [ -e "$item" ]; then
        if [ "$VERBOSE" = true ] || [ "$DRY_RUN" = true ]; then
            echo -e "  ${YELLOW}Found:${NC} $item"
        fi

        if [ "$DRY_RUN" = false ]; then
            rm -rf "$item"
            echo -e "  ${GREEN}Removed:${NC} $description"
        else
            echo -e "  ${YELLOW}Would remove:${NC} $description"
        fi
        return 0
    fi
    return 1
}

# Track cleanup stats
CLEANED_COUNT=0

# 1. Validation evidence directory
echo -e "${BLUE}Cleaning validation evidence...${NC}"
if remove_item "validation-evidence" "validation-evidence directory"; then
    ((CLEANED_COUNT++))
fi

# 2. Coverage reports (optional)
if [ "$KEEP_COVERAGE" = false ]; then
    echo -e "${BLUE}Cleaning coverage reports...${NC}"
    if remove_item "coverage" "coverage directory"; then
        ((CLEANED_COUNT++))
    fi
else
    echo -e "${YELLOW}Keeping coverage reports (--keep-coverage)${NC}"
fi

# 3. Build artifacts (optional - usually want to keep)
# Not cleaning dist/ by default as it may be needed

# 4. Test keys (generated for validation)
echo -e "${BLUE}Cleaning test keys...${NC}"
if remove_item "test-keys" "test-keys directory"; then
    ((CLEANED_COUNT++))
fi
if remove_item "keys" "keys directory"; then
    ((CLEANED_COUNT++))
fi

# 5. Temporary test files
echo -e "${BLUE}Cleaning temporary test files...${NC}"
if remove_item ".test-server.pid" "test server PID file"; then
    ((CLEANED_COUNT++))
fi

# 6. Any validation log files
echo -e "${BLUE}Cleaning validation logs...${NC}"
for log_file in validation-*.log test-output.txt build-output.txt; do
    if remove_item "$log_file" "$log_file"; then
        ((CLEANED_COUNT++))
    fi
done

# 7. npm/build caches (optional, not by default)
# These can speed up subsequent builds, so don't clean by default
# remove_item "node_modules/.cache" "npm cache"

# 8. Vitest cache
echo -e "${BLUE}Cleaning test caches...${NC}"
if remove_item ".vitest" "vitest cache"; then
    ((CLEANED_COUNT++))
fi

# 9. TypeScript build info
if remove_item "tsconfig.tsbuildinfo" "TypeScript build info"; then
    ((CLEANED_COUNT++))
fi

echo ""
echo -e "${BLUE}=== Cleanup Summary ===${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN - No files were actually deleted${NC}"
    echo -e "Would have cleaned ${CLEANED_COUNT} items"
else
    echo -e "${GREEN}Cleaned ${CLEANED_COUNT} items${NC}"
fi

echo ""
echo -e "${GREEN}Validation cleanup complete!${NC}"

# List remaining validation-related files if verbose
if [ "$VERBOSE" = true ]; then
    echo ""
    echo -e "${BLUE}Remaining project structure:${NC}"
    ls -la "$PROJECT_ROOT" | head -20
fi

exit 0
