#!/bin/bash
# Generate all sample books sequentially (rate-limit friendly).
set -a; . ./.env; set +a
for cat in mums dads grandparents siblings babies kids; do
  echo "=== SAMPLE: $cat ==="
  pnpm generate-book "$PWD/packages/pipeline/sample-configs/$cat.json" "$PWD/packages/pipeline/sample-configs/generated-$cat" || echo "!!! $cat FAILED"
done
echo "=== ALL SAMPLES DONE ==="
