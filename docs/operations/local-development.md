# Windows development plan

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Future implementation setup (not installed by planning run): Git, supported Node LTS/pnpm, Docker Desktop/WSL2 or native PostgreSQL with PostGIS, institution-approved local OIDC/test provider and S3 emulator. Verify virtualization/network/port constraints on Windows before choosing Docker. Use PowerShell-native paths and documented .env.example without real secrets. Pin runtime/tool versions and lockfile in foundation issue.

Proposed workflow after scaffold issue: pnpm install → start database/storage/identity development services → apply versioned migrations → load clearly synthetic non-Makarba fixtures → run API/worker and web/field/admin → relevant unit/integration/browser checks. Commands must be finalized and tested by setup issue; they are not runnable product commands today. Mobile device access needs HTTPS on a trusted local/staging origin for GPS; localhost exceptions do not make LAN HTTP secure. Never use real participant data in local dev or CI.

## Scaffold status (issue #10, partial — draft)

Implemented and tested: pnpm workspace, `@makarba/config` (fail-fast server env validation that never echoes secret values), `@makarba/api` (Express health endpoint, `no-store`, no framework banner), `docker-compose.yml` (PostGIS, synthetic dev credentials, bound to 127.0.0.1), `.env.example`, and a Node CI workflow.

Windows quick start (PowerShell): `pnpm install`; `Copy-Item .env.example .env`; `pnpm dev:services` (needs Docker Desktop); set the variables from `.env` and run `pnpm dev:api`; checks: `pnpm -r build; pnpm typecheck; pnpm test`.

Not yet done: public/field/admin web apps, worker, migrations, fixtures, lint/format tooling, and verification on a clean Windows checkout with Docker (database container not started in this session). The scaffold remains blocked formally on #9 → #6 approval.
