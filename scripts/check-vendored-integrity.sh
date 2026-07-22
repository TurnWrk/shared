#!/usr/bin/env bash
# Consumer-side drift gate (TURNWRK-219). Runs from a vendored copy inside an
# app repo (<app>/packages/shared/scripts/): verifies the committed vendored
# trees match canonical TurnWrk/shared at the SHA recorded in
# .vendor-manifest.json. The repo is public, so app CI needs no token.
#
# Skips (exit 0) only when no manifest exists (pre-bot vendored copy) or when
# run from the canonical repo itself. Clone/checkout failures FAIL the gate —
# a drift check that can't check must not pass.
set -euo pipefail

PKG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_ROOT="$(cd "$PKG_DIR/../.." && pwd)"
MANIFEST="$PKG_DIR/.vendor-manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "skip: no .vendor-manifest.json (canonical repo or pre-bot vendored copy)"
  exit 0
fi

SHA="$(node -p "require('$MANIFEST').sha")"
if [[ -z "$SHA" || "$SHA" == "unknown" ]]; then
  echo "skip: manifest has no source sha"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Verifying vendored trees against TurnWrk/shared @ $SHA ..."
git clone --quiet --filter=blob:none https://github.com/TurnWrk/shared.git "$TMP/shared"
git -C "$TMP/shared" checkout --quiet "$SHA"

EXCLUDES=(
  --exclude=node_modules
  --exclude=.git
  --exclude=.github
  --exclude=dist
  --exclude='*.tsbuildinfo'
  --exclude=email
  --exclude=firebase.json
  --exclude=.firebaserc
  --exclude=.vendor-manifest.json
)

# App Hosting copies carry a GENERATED src-exports package.json; cortex mirrors
# canonical byte-for-byte (and so gets package.json included in the tree diff).
if grep -q '"\./src/index.ts"' "$PKG_DIR/package.json"; then
  EXCLUDES+=(--exclude=package.json --exclude=package-lock.json)
  node "$TMP/shared/scripts/gen-vendored-package-json.mjs" "$TMP/shared/package.json" \
    > "$TMP/expected-package.json"
  if ! diff -u "$TMP/expected-package.json" "$PKG_DIR/package.json"; then
    echo "FAIL: vendored package.json does not match generator output for canonical @ $SHA" >&2
    echo "  Fix: re-run turnwrk-shared/scripts/sync-consumer.sh (or take the bot PR)" >&2
    exit 1
  fi
fi

if ! diff -qr "${EXCLUDES[@]}" "$TMP/shared" "$PKG_DIR"; then
  echo "FAIL: packages/shared drifts from TurnWrk/shared @ $SHA" >&2
  echo "  Fix: re-run turnwrk-shared/scripts/sync-consumer.sh (or take the bot PR)" >&2
  exit 1
fi
echo "OK: packages/shared matches TurnWrk/shared @ $SHA"

# packages/email (App Hosting apps): hostfix strips ESM .js suffixes for
# Turbopack, so normalize relative-import suffixes on both sides before diffing
# (same normalization as check-vendored-email.sh).
if [[ -d "$APP_ROOT/packages/email" && -d "$TMP/shared/email" ]]; then
  normalize_tree() {
    local src="$1" dest="$2"
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
  normalize_tree "$TMP/shared/email" "$TMP/email-canonical"
  normalize_tree "$APP_ROOT/packages/email" "$TMP/email-vendored"
  if ! diff -qr "$TMP/email-canonical" "$TMP/email-vendored"; then
    echo "FAIL: packages/email drifts from TurnWrk/shared email/ @ $SHA (after .js normalize)" >&2
    echo "  Fix: re-run turnwrk-shared/scripts/sync-email-consumer.sh (or take the bot PR)" >&2
    exit 1
  fi
  echo "OK: packages/email matches canonical email/ @ $SHA (normalized)"
fi
