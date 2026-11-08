#!/bin/sh
# Provider-neutral rollback TEMPLATE. Replace the two "deploy_*" functions with the chosen platform's commands (#124).
# Usage: deploy/rollback.sh <previous-release-tag>
# Rolls the web and API tiers back to a previously built, previously verified image tag, then runs the smoke test. It never touches
# the database: schema changes use expand-then-contract migrations (packages/db), so the previous release must run on the current schema.
set -eu
PREV="${1:?usage: rollback.sh <previous-release-tag>}"
BASE_URL="${BASE_URL:?set BASE_URL to the public address, for example https://staging.example.org}"

deploy_web() { echo "TODO(platform): point the web tier at image makarba-web:$PREV"; exit 3; }
deploy_api() { echo "TODO(platform): point the API tier at image makarba-api:$PREV"; exit 3; }

deploy_api
deploy_web
python3 scripts/deploy_smoke.py "$BASE_URL" --expect-https
echo "rolled back to $PREV and smoke test passed"
