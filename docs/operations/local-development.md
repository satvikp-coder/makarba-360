# Windows development plan

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Future implementation setup (not installed by planning run): Git, supported Node LTS/pnpm, Docker Desktop/WSL2 or native PostgreSQL with PostGIS, institution-approved local OIDC/test provider and S3 emulator. Verify virtualization/network/port constraints on Windows before choosing Docker. Use PowerShell-native paths and documented .env.example without real secrets. Pin runtime/tool versions and lockfile in foundation issue.

Proposed workflow after scaffold issue: pnpm install → start database/storage/identity development services → apply versioned migrations → load clearly synthetic non-Makarba fixtures → run API/worker and web/field/admin → relevant unit/integration/browser checks. Commands must be finalized and tested by setup issue; they are not runnable product commands today. Mobile device access needs HTTPS on a trusted local/staging origin for GPS; localhost exceptions do not make LAN HTTP secure. Never use real participant data in local dev or CI.
