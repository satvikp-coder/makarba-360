# Deployment preparation (issue #124) - provider-neutral

**Status: prepared, not deployed.** No hosting provider, region, tile provider, budget or credential has been approved; nothing here has run in a real environment. Container builds were not executed on the author's machine (no Docker); the CI `deploy` job runs the static checks, the header tests in a real browser and the smoke test against the production build.

## What is here
| File | Purpose |
|---|---|
| `deploy/Dockerfile.web` | builds the SPA, fails the build if the bundle contains a server secret, serves it with unprivileged nginx |
| `deploy/Dockerfile.api` | runs the API as a non-root user; secrets are injected at run time |
| `deploy/nginx.conf` | security headers (values in `deploy/headers.json`), no-store HTML and API, immutable hashed assets, no source maps, `/api/` proxy that strips cookies |
| `deploy/headers.json` | the one source of truth for required headers |
| `deploy/rollback.sh` | rollback template; platform commands are `TODO(platform)` until a provider is approved |
| `scripts/deploy_smoke.py` | smoke test for any environment address |
| `scripts/check_deploy_config.py` | static checks: no credentials, pinned images, non-root, health checks, header parity |
| `packages/config` | environment validation already in the repo: refuses placeholder secrets, local database in staging/production, production on an unapproved capability matrix |

## Environments
- **local:** `.env` from `.env.example` (synthetic values), `pnpm dev:mock`.
- **synthetic staging:** same images, `APP_ENV=staging`, synthetic data only, no real participant data ever. Public only if the owner approves.
- **production:** `APP_ENV=production` refuses to start while the capability matrix is PROPOSED (#6) and while `DATABASE_URL`/`SESSION_SECRET` are placeholders.
Required runtime variables: `NODE_ENV`, `APP_ENV`, `API_PORT`, `DATABASE_URL` (TLS required outside local), `SESSION_SECRET` (>= 32 random characters). Missing or unsafe values stop start-up with the variable name, never its value.

## Release and rollback
1. Build both images from a tagged commit (`git describe`), run `scripts/deploy_smoke.py` on a staging address, then promote the same image tags.
2. Keep the previous two tags. Roll back with `deploy/rollback.sh <tag>` (after filling in the platform commands). Migrations are expand-then-contract (`packages/db`), so the previous release runs on the current schema.
3. Backups and restore: `docs/operations/backups.md`. A restore must be rehearsed on a copy and its tombstones replayed so withdrawn content is not resurrected.

## HTTPS
Terminate TLS at the platform or in front of nginx; then uncomment the `Strict-Transport-Security` line and run `python scripts/deploy_smoke.py https://<address> --expect-https`.

## Still needs people (issue #124)
Provider and region choice, tile provider and monthly cap, credentials in a secret store, DNS and certificates, the real deployment, and a recorded rollback rehearsal. Do not enable paid services before the owner approves.
