#!/bin/bash
# Regenerate the 6 showcase sample books from the preferred templates, using
# nano-banana-pro for spreads (far more coherent than seedream: no extra limbs,
# consistent scale) plus the strengthened QA judge. Generates locally, then
# imports each as a public sample. Old samples are pruned separately after review.
set -euo pipefail
set -a; . ./.env; set +a

export WFSC_MODEL_SPREAD="google/nano-banana-pro"
export WFSC_SPREAD_CONCURRENCY="${WFSC_SPREAD_CONCURRENCY:-2}"
export WFSC_MAX_RETRIES="${WFSC_MAX_RETRIES:-3}"

CFG="$PWD/packages/pipeline/sample-configs"
OUT="$PWD/packages/pipeline/sample-configs"

# config-basename  category-slug  template-id
SAMPLES=(
  "s-beach-treasure|mums|beach-treasure"
  "s-dads-toolbox|dads|dads-tiny-toolbox-helper"
  "s-whale-watching|mums|whale-watching"
  "s-golf-grandpa|grandparents|golf-with-grandpa"
  "s-grandmas-garden|grandparents|grandmas-garden-of-seasons"
  "s-rainy-day-fort|siblings|rainy-day-fort"
)

for entry in "${SAMPLES[@]}"; do
  IFS='|' read -r cfg slug tpl <<< "$entry"
  echo "=== GENERATE: $cfg ($tpl) ==="
  if pnpm --filter @wfsc/pipeline generate-book "$CFG/$cfg.json" "$OUT/generated-$cfg"; then
    echo "=== IMPORT: $cfg → $slug / $tpl ==="
    node --env-file=.env scripts/import-sample-book.mjs "$OUT/generated-$cfg" "$slug" "$tpl" \
      || echo "!!! IMPORT FAILED: $cfg"
  else
    echo "!!! GENERATE FAILED: $cfg"
  fi
done
echo "=== ALL SAMPLES DONE ==="
