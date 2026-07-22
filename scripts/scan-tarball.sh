#!/bin/bash
# Scans npm tarball for internal references before publish
# Exit 1 if any internal patterns found

set -e

PATTERNS_FILE="${1:-.internal-patterns.txt}"
TARBALL=$(ls *.tgz 2>/dev/null | head -1)

if [ -z "$TARBALL" ]; then
  echo "No tarball found. Run 'npm pack' first."
  exit 1
fi

echo "Scanning $TARBALL for internal references..."

TMPDIR=$(mktemp -d)
tar -xzf "$TARBALL" -C "$TMPDIR"

FOUND=0
while IFS= read -r pattern; do
  [ -z "$pattern" ] && continue
  [[ "$pattern" == \#* ]] && continue
  MATCHES=$(grep -rn "$pattern" "$TMPDIR" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    echo "FAIL: Found internal reference '$pattern':"
    echo "$MATCHES" | head -5
    FOUND=1
  fi
done < "$PATTERNS_FILE"

rm -rf "$TMPDIR"

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "BLOCKED: Internal references found in tarball. Fix before publishing."
  exit 1
fi

echo "PASS: No internal references found in tarball."
