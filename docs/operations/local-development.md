# Windows development plan

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Future implementation setup (not installed by planning run): Git, supported Node LTS/pnpm, Docker Desktop/WSL2 or native PostgreSQL with PostGIS, institution-approved local OIDC/test provider and S3 emulator. Verify virtualization/network/port constraints on Windows before choosing Docker. Use PowerShell-native paths and documented .env.example without real secrets. Pin runtime/tool versions and lockfile in foundation issue.

Proposed workflow after scaffold issue: pnpm install → start database/storage/identity development services → apply versioned migrations → load clearly synthetic non-Makarba fixtures → run API/worker and web/field/admin → relevant unit/integration/browser checks. Commands must be finalized and tested by setup issue; they are not runnable product commands today. Mobile device access needs HTTPS on a trusted local/staging origin for GPS; localhost exceptions do not make LAN HTTP secure. Never use real participant data in local dev or CI.

## Scaffold (issue #10)

Packages: `@makarba/config` (fail-fast server env validation; secret values never echoed; mock env needs no secrets and refuses `NODE_ENV=production`), `@makarba/contracts` (strict runtime validators for the frozen public DTO v1.0.0, forbidden private-field scan, conformance tests against `docs/project/contracts/fixture-bundle.json` and its recorded hash), `@makarba/api` (Express health endpoint, `no-store`, synthetic mock public API with success/empty/suppressed/error/404/422 states that validates every response against the contracts and fails closed).

### Windows quick start (PowerShell)
1. `pnpm install`
2. Public/B development needs no database, identity provider or secret: `pnpm dev:mock` serves the synthetic public API on `http://127.0.0.1:4010/api/v1/public` (add `?scenario=empty|suppressed|error`).
3. Private/A development: `Copy-Item .env.example .env`, `pnpm dev:services` (Docker Desktop required; PostGIS bound to 127.0.0.1), then `pnpm dev:api` after exporting the `.env` variables. A missing or short value stops startup with a message naming the variable.
4. Checks: `pnpm -r build; pnpm typecheck; pnpm lint; pnpm test`; contract conformance against the running mock: `python scripts/check_public_contracts.py --fixtures --base-url http://127.0.0.1:4010`; `python scripts/check_secret_exposure.py`.

### Verification evidence and limits
CI runs install/build/typecheck/lint/test on Ubuntu and **windows-latest** (a real Windows runner, not an emulation of a developer's machine), the live mock conformance check, and a PostGIS container health/`postgis_version()` check. Docker was not running on the author's machine, so the database step was verified in CI only. Not in scope here: web apps, worker, migrations (#22), identity (#32). Synthetic data only; no real participant data or credentials.
