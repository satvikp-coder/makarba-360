# Integration-ready checklist

> **Assignment status (verified against GitHub, 2026-11-08):** all 26 open Developer B issues are assigned to `varunkarthic`; the `owner:developer-b` label, closed history and acceptance criteria are unchanged. Issues #128 and #130-#135 are **unfinished stretch work**: only disabled rule modules exist in `packages/stretch` (no UI, no data, not released) and they hard-depend on #126. Varun has an open PR #207 (`dev-b/issue-82-responsive-map`) that these documents do not touch. Per-issue detail: `FUTURE_VARUN_RESPONSIBILITIES.md`.

Run these in order once a Developer A service exists. Result categories: **PASS-MOCK**, **PASS-SYNTHETIC-ADAPTER**, **PASS-LIVE**, **BLOCKED-LIVE-SERVICE**, **BLOCKED-HUMAN**, **BLOCKED-DEVICE**, **FAILED**, **NOT RUN**. Status today is in `integration-readiness.json` and `DEPENDENCY_PREPARATION_PROGRESS.md`.

| # | Check | Command | Today | Passes live when |
|---|---|---|---|---|
| 1 | Public API conformance | `pnpm --filter @makarba/api conformance <base>/api/v1/public` | PASS-MOCK (11/11), PASS-SYNTHETIC-ADAPTER (11/11) | 11/11 against the real server |
| 2 | Python contract smoke | `python scripts/check_public_contracts.py --fixtures --base-url <origin>` | PASS-MOCK | passes against the real server |
| 3 | Browser journeys without stubs | `E2E_TARGET=preview pnpm --filter @makarba/web test:e2e` with `VITE_API_BASE` set | PASS-MOCK (66) | the same specs pass on real data |
| 4 | Journey preflight | `LIVE_API_BASE=<origin> pnpm --filter @makarba/journeys live` | BLOCKED-LIVE-SERVICE (lists missing routes) | prints "preflight OK" |
| 5 | Live journey | `LIVE_API_BASE=<origin> LIVE_AUTH_JSON=... pnpm --filter @makarba/journeys test` | NOT RUN | same assertions as synthetic pass |
| 6 | Abuse-case register on the real router | `pnpm --filter @makarba/api test` (point `threat-model.test.ts` world at the real router) | PASS-MOCK (23) | AC-15 and AC-17 become automated |
| 7 | Analytics frozen cases on the worker | worker output vs `docs/project/fixtures/analytics-cases.json` `expected` | PASS-MOCK (module) | equal |
| 8 | Dependency gate with empty baseline | `python scripts/check_dependency_audit.py` | PASS with 16 baselined advisories | baseline empty |
| 9 | Budgets, CI policy, secret scan | `python scripts/check_budgets.py ...`, `python scripts/check_ci_policy.py`, `python scripts/scan_secrets.py --bundle apps/web/dist` | PASS | unchanged |
| 10 | Human gates | see `DEVELOPER_B_HUMAN_ACTION_REQUIRED.md` | BLOCKED-HUMAN / BLOCKED-DEVICE | evidence attached to the issue |
