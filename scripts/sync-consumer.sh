#!/usr/bin/env bash
# Canonical vendoring sync: this repo → <consumer>/packages/shared.
# Single source of truth for sync logic (TURNWRK-219) — the sync-consumers
# GitHub workflow and the local vendor-shared-package skill wrappers both call
# this. Verification lives in check-vendored-shared.sh (canonical side) and
# check-vendored-integrity.sh (consumer side).
#
# Usage: sync-consumer.sh <consumer-root> <apphosting|full>
#   apphosting  clean / hostfix-cmms / restock — vendored package.json is
#               GENERATED with src/*.ts exports (dist/ is gitignored; a
#               dist-pointing vendored package.json breaks App Hosting builds).
#   full        turnwrk-cortex — full tree incl. canonical package.json/lock
#               (cortex compiles shared to dist/ inside its Docker build).
#               Run `npm install` in the consumer afterwards when local.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
CONSUMER="${1:?usage: sync-consumer.sh <consumer-root> <apphosting|full>}"
VARIANT="${2:?usage: sync-consumer.sh <consumer-root> <apphosting|full>}"
CONSUMER="$(cd "$CONSUMER" && pwd)"
DEST="$CONSUMER/packages/shared"

if [[ ! -d "$SRC/src" ]]; then
  echo "error: canonical source not found at $SRC" >&2
  exit 1
fi
if [[ "$VARIANT" != "apphosting" && "$VARIANT" != "full" ]]; then
  echo "error: variant must be apphosting or full, got '$VARIANT'" >&2
  exit 1
fi

mkdir -p "$DEST"

# email/ vendors separately (packages/email via sync-email-consumer.sh);
# firebase.json/.firebaserc are this repo's deploy config, not package content;
# .vendor-manifest.json is written below (exclude protects it from --delete).
EXCLUDES=(
  --exclude node_modules
  --exclude .git
  --exclude .github
  --exclude dist
  --exclude '*.tsbuildinfo'
  --exclude email
  --exclude firebase.json
  --exclude .firebaserc
  --exclude .vendor-manifest.json
)
if [[ "$VARIANT" == "apphosting" ]]; then
  EXCLUDES+=(--exclude package.json --exclude package-lock.json)
fi

rsync -a --delete "${EXCLUDES[@]}" "$SRC/" "$DEST/"

if [[ "$VARIANT" == "apphosting" ]]; then
  node "$SRC/scripts/gen-vendored-package-json.mjs" "$SRC/package.json" > "$DEST/package.json"
fi

# Provenance manifest is written by stamp-vendor-manifest.sh, which must run
# AFTER the email sync too (the manifest SHA covers packages/email as well —
# an email-only canonical change still needs a fresh stamp). Wrappers and the
# sync-consumers workflow call it as their final step.
SHA="$(git -C "$SRC" rev-parse HEAD 2>/dev/null || echo unknown)"
VERSION="$(node -p "require('$SRC/package.json').version")"
echo "Synced @turnwrk/shared ($VARIANT) -> $DEST @ ${SHA:0:9} (v$VERSION)"
