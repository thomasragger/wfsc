#!/bin/bash
# Re-run the sample books that failed / were interrupted in the first pass.
# Uses the widened transient-error retry logic. Story JSON is cached per book.
set -euo pipefail
set -a; . ./.env; set +a

export WFSC_MODEL_SPREAD="google/nano-banana-pro"
export WFSC_SPREAD_CONCURRENCY="${WFSC_SPREAD_CONCURRENCY:-3}"
export WFSC_MAX_RETRIES="${WFSC_MAX_RETRIES:-3}"
export WFSC_SKIP_PDF=1   # PDFs rendered separately by the app pipeline (task #20)

CFG="$PWD/packages/pipeline/sample-configs"

SAMPLES=(
  "s-whale-watching|mums|whale-watching"
  "s-grandmas-garden|grandparents|grandmas-garden-of-seasons"
  "s-rainy-day-fort|siblings|rainy-day-fort"
)

for entry in "${SAMPLES[@]}"; do
  IFS='|' read -r cfg slug tpl <<< "$entry"
  echo "=== GENERATE: $cfg ($tpl) ==="
  if pnpm --filter @wfsc/pipeline generate-book "$CFG/$cfg.json" "$CFG/generated-$cfg"; then
    echo "=== IMPORT: $cfg → $slug / $tpl ==="
    node --env-file=.env scripts/import-sample-book.mjs "$CFG/generated-$cfg" "$slug" "$tpl" \
      || echo "!!! IMPORT FAILED: $cfg"
  else
    echo "!!! GENERATE FAILED: $cfg"
  fi
done
echo "=== REMAINING SAMPLES DONE ==="
