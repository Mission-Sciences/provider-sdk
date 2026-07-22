#!/usr/bin/env bash
# =============================================================================
# publish-mirror.sh — scrub-and-mirror publish flow (GW-8641)
#
# Bitbucket (ghostdogbase/gw-sdk) is the CANONICAL repo. Publishing works by
# pushing a scrubbed, fresh-history snapshot of HEAD to the GitHub mirror
# (github.com/Mission-Sciences/provider-sdk). The mirror's GitHub Actions
# workflow (.github/workflows/publish-package.yml) then publishes the package
# to AWS CodeArtifact and the public npm registry on push to main.
#
# What "scrubbed" means:
#   - No git history — a single snapshot commit replaces the mirror's main.
#   - Internal-only paths are excluded (see EXCLUDES below).
#   - Hard gate: the snapshot must contain no live API keys (gwsk_<hex>) and
#     none of the internal patterns from .internal-patterns.txt.
#
# Usage:
#   ./scripts/publish-mirror.sh            # dry run (build + verify only)
#   ./scripts/publish-mirror.sh --push     # build, verify, and force-push
#
# Requirements: git with push access to the GitHub mirror, rg (ripgrep).
# =============================================================================
set -Eeuo pipefail
[ "${DEBUG:-}" == "true" ] && set -x

MIRROR_REMOTE="${MIRROR_REMOTE:-git@github.com:Mission-Sciences/provider-sdk.git}"
MIRROR_BRANCH="${MIRROR_BRANCH:-main}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

PUSH=false
if [ "${1:-}" == "--push" ]; then
  PUSH=true
fi

# Internal-only paths that must never reach the public mirror.
# (git archive already excludes untracked files, node_modules, dist, etc.)
#
# NOT excluded on purpose (the mirror's publish workflow needs them):
#   terraform/            — CodeArtifact infra applied by terraform-plan/apply jobs
#   scripts/scan-tarball.sh + .internal-patterns.txt — tarball scan step
EXCLUDES=(
  ".claude"
  ".devcontainer"
  ".swarm"
  "agentpod"
  "concourse"
  "planning"
  "pact"
  "test-app"
  "CLAUDE.md"
  "PACT.md"
  "TESTING.md"
  "VALIDATION.md"
  "Makefile"
)

HEAD_SHA="$(git rev-parse --short HEAD)"
VERSION="$(node -p "require('./package.json').version")"

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is dirty — commit or stash before mirroring." >&2
  exit 1
fi

echo "==> Building clean snapshot of HEAD ($HEAD_SHA, v$VERSION)"
SNAPSHOT_DIR="$(mktemp -d)"
trap 'rm -rf "$SNAPSHOT_DIR"' EXIT

git archive HEAD | tar -x -C "$SNAPSHOT_DIR"

for path in "${EXCLUDES[@]}"; do
  rm -rf "${SNAPSHOT_DIR:?}/${path}"
done

echo "==> Verifying snapshot contains no secrets or internal references"
# Hard gate 1: no API-key-shaped strings anywhere in the snapshot.
# Real keys are gwsk_<64 hex>. Test mocks must use non-hex suffixes
# (e.g. gwsk_testmock) so this stays a zero-tolerance gate.
KEY_HITS="$(rg -n "gwsk_[0-9a-f]" "$SNAPSHOT_DIR" || true)"
if [ -n "$KEY_HITS" ]; then
  echo "BLOCKED: live API key pattern (gwsk_<hex>) found in snapshot:" >&2
  echo "$KEY_HITS" >&2
  exit 1
fi

# Hard gate 2: none of the internal patterns used by scan-tarball.sh.
# (Skip the patterns file itself — it ships in the snapshot so the mirror's
# scan-tarball workflow step keeps working, and it trivially matches itself.)
if [ -f "$REPO_ROOT/.internal-patterns.txt" ]; then
  FOUND=0
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    case "$pattern" in \#*) continue ;; esac
    MATCHES="$(rg -n --fixed-strings -g '!.internal-patterns.txt' "$pattern" "$SNAPSHOT_DIR" || true)"
    if [ -n "$MATCHES" ]; then
      echo "BLOCKED: internal reference '$pattern' found in snapshot:" >&2
      echo "$MATCHES" | head -5 >&2
      FOUND=1
    fi
  done < "$REPO_ROOT/.internal-patterns.txt"
  if [ "$FOUND" -eq 1 ]; then
    exit 1
  fi
fi
echo "    PASS: snapshot is clean."

echo "==> Creating fresh-history snapshot commit"
cd "$SNAPSHOT_DIR"
git init -q -b "$MIRROR_BRANCH"
git add -A
git -c user.name="GW SDK Mirror" -c user.email="engineering@generalwisdom.com" \
  commit -q -m "provider-sdk v$VERSION (mirrored from canonical repo @ $HEAD_SHA)"

if [ "$PUSH" != "true" ]; then
  echo ""
  echo "DRY RUN complete. Snapshot verified at $SNAPSHOT_DIR"
  echo "Re-run with --push to force-push to $MIRROR_REMOTE $MIRROR_BRANCH"
  echo "(pushing to main triggers the GitHub Actions publish workflow)."
  exit 0
fi

echo "==> Force-pushing snapshot to $MIRROR_REMOTE ($MIRROR_BRANCH)"
git remote add mirror "$MIRROR_REMOTE"
git push --force mirror "$MIRROR_BRANCH:$MIRROR_BRANCH"

echo ""
echo "Done. Push to $MIRROR_BRANCH triggers the 'Build and Publish Package'"
echo "GitHub Actions workflow, which publishes v$VERSION to CodeArtifact + npm."
echo "Watch: https://github.com/Mission-Sciences/provider-sdk/actions"
