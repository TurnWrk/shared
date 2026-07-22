#!/usr/bin/env bash
# Fail-closed: canonical @turnwrk/shared tree must match App Hosting / Docker
# vendored copies (same exclusions as vendor-shared-package sync scripts).
# Standalone GitHub CI for this repo has no sibling apps — skip with exit 0.
# Suite tree (local overnight / multi-repo): drift exits 1.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUITE="$(cd "$ROOT/.." && pwd)"

# Paths the App Hosting sync scripts copy (package.json intentionally preserved
# per-app with src/*.ts exports — compared separately via export keys).
# email/ vendors separately at packages/email; firebase.json/.firebaserc are
# this repo's deploy config; .vendor-manifest.json exists only in vendored
# copies (written by sync-consumer.sh).
EXCLUDES=(
  --exclude=node_modules
  --exclude=.git
  --exclude=.github
  --exclude=package.json
  --exclude=package-lock.json
  --exclude=dist
  --exclude='*.tsbuildinfo'
  --exclude=email
  --exclude=firebase.json
  --exclude=.firebaserc
  --exclude=.vendor-manifest.json
)

# label|relative path under suite|compare_package_json (0|1)
# cortex syncs package.json too (builds to dist in Docker).
CHECKS=(
  "hostfix-cmms|hostfix-cmms/packages/shared|0"
  "restock|restock/packages/shared|0"
  "clean|clean/packages/shared|0"
  "turnwrk-cortex|turnwrk-cortex/packages/shared|1"
)

found=0
failed=0

export_keys() {
  node -e "console.log(Object.keys(require(process.argv[1]).exports||{}).sort().join(','))" "$1"
}

for entry in "${CHECKS[@]}"; do
  IFS='|' read -r app rel compare_pkg <<<"$entry"
  dest="$SUITE/$rel"
  parent="$(dirname "$dest")"
  if [[ ! -d "$parent" ]]; then
    continue
  fi
  found=1
  if [[ ! -d "$dest" ]]; then
    echo "FAIL: $app missing vendored shared at $dest" >&2
    echo "  Fix: scripts/sync-consumer.sh <app-root> <apphosting|full>" >&2
    failed=1
    continue
  fi

  if ! diff -qr "${EXCLUDES[@]}" "$ROOT" "$dest" >/tmp/tw-shared-diff.$$ 2>&1; then
    echo "FAIL: @turnwrk/shared drift — canonical vs $app:" >&2
    cat /tmp/tw-shared-diff.$$ >&2 || true
    echo "  Fix: re-run vendor sync for $app from turnwrk.com root." >&2
    failed=1
  else
    echo "OK: $app packages/shared tree matches canonical (excl. package.json)"
  fi
  rm -f /tmp/tw-shared-diff.$$

  if [[ ! -f "$dest/package.json" ]]; then
    echo "FAIL: $app missing vendored package.json" >&2
    failed=1
    continue
  fi

  SRC_EXPORTS="$(export_keys "$ROOT/package.json")"
  DEST_EXPORTS="$(export_keys "$dest/package.json")"
  if [[ "$SRC_EXPORTS" != "$DEST_EXPORTS" ]]; then
    echo "FAIL: $app export subpaths differ from canonical:" >&2
    echo "  canonical: $SRC_EXPORTS" >&2
    echo "  vendored:  $DEST_EXPORTS" >&2
    failed=1
  else
    echo "OK: $app export subpaths match canonical"
  fi

  if [[ "$compare_pkg" == "1" ]]; then
    if ! diff -q "$ROOT/package.json" "$dest/package.json" >/dev/null 2>&1; then
      echo "FAIL: $app package.json should match canonical (cortex syncs it)" >&2
      diff -u "$ROOT/package.json" "$dest/package.json" >&2 || true
      failed=1
    else
      echo "OK: $app package.json matches canonical"
    fi
  fi
done

if [[ "$found" -eq 0 ]]; then
  echo "skip: no sibling deployable apps in tree (standalone checkout) — shared vendored parity not checked"
  exit 0
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "OK: all present vendored @turnwrk/shared mirrors match canonical"
