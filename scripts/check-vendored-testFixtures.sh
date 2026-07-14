#!/usr/bin/env bash
# Fail-closed: canonical src/testFixtures must match App Hosting vendored copies.
# When this package is checked out alone (GitHub CI for turnwrk-shared), sibling
# apps are absent — skip with exit 0. When run from the suite tree locally (or
# a multi-repo CI), drift exits 1.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src/testFixtures"
SUITE="$(cd "$ROOT/.." && pwd)"

if [[ ! -d "$SRC" ]]; then
  echo "error: canonical testFixtures missing at $SRC" >&2
  exit 1
fi

# label|relative path under suite
CHECKS=(
  "hostfix-cmms|hostfix-cmms/packages/shared/src/testFixtures"
  "restock|restock/packages/shared/src/testFixtures"
  "clean|clean/packages/shared/src/testFixtures"
)

found=0
failed=0

for entry in "${CHECKS[@]}"; do
  app="${entry%%|*}"
  rel="${entry#*|}"
  dest="$SUITE/$rel"
  parent="$(dirname "$dest")"
  if [[ ! -d "$parent" ]]; then
    continue
  fi
  found=1
  if [[ ! -d "$dest" ]]; then
    echo "FAIL: $app missing vendored testFixtures at $dest" >&2
    echo "  Fix: .cursor/skills/vendor-shared-package/scripts/sync-to-*.sh" >&2
    failed=1
    continue
  fi
  if ! diff -qr "$SRC" "$dest" >/tmp/tw-fixtures-diff.$$ 2>&1; then
    echo "FAIL: testFixtures drift — canonical vs $app vendored copy:" >&2
    cat /tmp/tw-fixtures-diff.$$ >&2 || true
    echo "  Fix: re-run vendor sync for $app from turnwrk.com root." >&2
    failed=1
  else
    echo "OK: $app testFixtures matches canonical"
  fi
  rm -f /tmp/tw-fixtures-diff.$$
done

if [[ "$found" -eq 0 ]]; then
  echo "skip: no sibling App Hosting apps in tree (standalone checkout) — vendored parity not checked"
  exit 0
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "OK: all present vendored testFixtures mirrors match canonical"
