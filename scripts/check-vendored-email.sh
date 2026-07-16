#!/usr/bin/env bash
# Fail-closed: canonical @turnwrk/email (suite email/) must match app packages/email.
# Lives in turnwrk-shared so GitHub CI can ship the script; canonical source is
# ../email when the suite tree is present. Normalizes ESM `.js` suffixes on
# relative imports so hostfix's Turbopack-friendly extensionless tree compares
# equal to the canonical `.js` tree. Standalone / no siblings → skip exit 0.
set -euo pipefail

SHARED_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUITE="$(cd "$SHARED_ROOT/.." && pwd)"
ROOT="$SUITE/email"

if [[ ! -d "$ROOT/src" ]]; then
  echo "skip: canonical email/ not adjacent to turnwrk-shared (standalone checkout)"
  exit 0
fi

CHECKS=(
  "hostfix-cmms|hostfix-cmms/packages/email"
  "restock|restock/packages/email"
  "clean|clean/packages/email"
)

found=0
failed=0

normalize_tree() {
  local src="$1" dest="$2"
  rm -rf "$dest"
  mkdir -p "$dest"
  rsync -a \
    --exclude node_modules \
    --exclude package-lock.json \
    --exclude .git \
    --exclude scripts \
    "$src/" "$dest/"
  find "$dest" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) \
    -print0 2>/dev/null \
    | xargs -0 -r sed -i -E "s/(from ['\"]\\.\\.?\\/[^'\"]+)\\.js(['\"])/\\1\\2/g"
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

normalize_tree "$ROOT" "$TMP/canonical"

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
    echo "FAIL: $app missing vendored email at $dest" >&2
    echo "  Fix: .claude/skills/vendor-shared-package/scripts/sync-email-to-*.sh" >&2
    failed=1
    continue
  fi

  normalize_tree "$dest" "$TMP/$app"
  if ! diff -qr "$TMP/canonical" "$TMP/$app" >/tmp/tw-email-diff.$$ 2>&1; then
    echo "FAIL: @turnwrk/email drift — canonical vs $app (after .js-import normalize):" >&2
    cat /tmp/tw-email-diff.$$ >&2 || true
    echo "  Fix: re-run email vendor sync for $app (hostfix sync strips .js for Turbopack)." >&2
    failed=1
  else
    echo "OK: $app packages/email matches canonical (normalized)"
  fi
  rm -f /tmp/tw-email-diff.$$
done

if [[ "$found" -eq 0 ]]; then
  echo "skip: no sibling App Hosting apps in tree — email vendored parity not checked"
  exit 0
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "OK: all present vendored @turnwrk/email mirrors match canonical"
