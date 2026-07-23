#!/usr/bin/env bash
# Stamps <consumer>/packages/shared/.vendor-manifest.json — the provenance
# record consumer CI verifies the vendored trees against
# (check-vendored-integrity.sh reads only `.sha`).
#
# Runs as the FINAL step after sync-consumer.sh AND sync-email-consumer.sh:
# the stamped SHA covers packages/email too, so it must see both syncs.
#
# Conflict-hygiene by design (TURNWRK-219 follow-up):
#   - DETERMINISTIC: no timestamp — any two syncs of the same canonical commit
#     produce byte-identical manifests, so a dev local sync and a bot PR at the
#     same SHA auto-merge instead of conflicting.
#   - CONTENT-GATED: the manifest is rewritten only when the vendored trees
#     actually changed (or no manifest exists). Doc/CI-only canonical pushes
#     leave consumers untouched — no manifest-only PR churn, and an already-
#     current consumer keeps its older stamped SHA (the integrity gate still
#     passes: content matches that SHA).
#
# Usage: stamp-vendor-manifest.sh <consumer-root>
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
CONSUMER="${1:?usage: stamp-vendor-manifest.sh <consumer-root>}"
CONSUMER="$(cd "$CONSUMER" && pwd)"
MANIFEST="$CONSUMER/packages/shared/.vendor-manifest.json"

SHA="$(git -C "$SRC" rev-parse HEAD 2>/dev/null || echo unknown)"
if [[ "$SHA" == "unknown" ]]; then
  echo "warn: canonical is not a git checkout — manifest not stamped" >&2
  exit 0
fi
VERSION="$(node -p "require('$SRC/package.json').version")"

# Dirty check vs the consumer's HEAD (porcelain includes untracked files, so
# newly-added vendored files count; the manifest itself is excluded so a
# stale stamp alone never forces a re-stamp loop).
dirty="$(git -C "$CONSUMER" status --porcelain -- \
  packages/shared packages/email \
  ':(exclude)packages/shared/.vendor-manifest.json' 2>/dev/null || echo force)"

if [[ -z "$dirty" && -f "$MANIFEST" ]]; then
  echo "Vendored content unchanged — manifest untouched ($(node -p "require('$MANIFEST').sha" 2>/dev/null | cut -c1-9 || echo '?') kept)"
  exit 0
fi

printf '{\n  "source": "TurnWrk/shared",\n  "sha": "%s",\n  "version": "%s"\n}\n' \
  "$SHA" "$VERSION" > "$MANIFEST"
echo "Stamped .vendor-manifest.json @ ${SHA:0:9} (v$VERSION)"
