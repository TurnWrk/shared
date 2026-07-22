#!/usr/bin/env bash
# Canonical email vendoring sync: this repo's email/ → <consumer>/packages/email.
# @turnwrk/email is a second package in this repo (TURNWRK-221) so the sync
# bot has a remote canonical.
#
# Usage: sync-email-consumer.sh <consumer-root> [--strip-js]
#   --strip-js  hostfix-cmms only: strip ESM `.js` suffixes off relative
#               imports (Turbopack needs extensionless; webpack is fine).
#               check-vendored-email.sh normalizes both forms when comparing.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/../email" && pwd)"
CONSUMER="${1:?usage: sync-email-consumer.sh <consumer-root> [--strip-js]}"
CONSUMER="$(cd "$CONSUMER" && pwd)"
STRIP="${2:-}"
DEST="$CONSUMER/packages/email"

if [[ ! -d "$SRC/src" ]]; then
  echo "error: canonical email not found at $SRC" >&2
  exit 1
fi

mkdir -p "$DEST"
rsync -a --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude package-lock.json \
  --exclude scripts \
  "$SRC/" "$DEST/"

if [[ "$STRIP" == "--strip-js" ]]; then
  find "$DEST" -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 \
    | xargs -0 -r sed -i -E "s/(from ['\"]\\.\\.?\\/[^'\"]+)\\.js(['\"])/\\1\\2/g"
  echo "Synced @turnwrk/email -> $DEST (extensionless imports for Turbopack)"
else
  echo "Synced @turnwrk/email -> $DEST"
fi
