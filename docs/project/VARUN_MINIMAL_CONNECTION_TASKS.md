# Developer A: the smallest connection tasks

Honest sizing: **S** = a connection of prepared code (hours), **M** = real backend work against a prepared interface and prepared tests (days), **L** = substantial backend implementation that nothing in Developer B's code can replace. Nothing below is marked S unless the code on the other side exists and was run.

## 1. Public API (issue #81) - size **M** (the HTTP layer is done; the data access is not)
- **Prepared and tested:** `apps/api/src/public-api.ts` (`publicApi({ repository })`): all four routes plus the proposed `/stories`, input validation (limit 1..200, cursor, slug, id, cohort), identical 404 for unknown/unpublished/malformed, contract validation of every payload (fail closed, generic 500), `no-store`, no cookies, repository timeout (5 s default) mapped to a retryable 503 with no internal text, unknown filter value mapped to 422 via `InvalidFilterError`. `apps/api/src/public-conformance.ts` (11 checks) passes against the mock and against the repository-backed router (`public-api.test.ts`, 7 tests). `apps/api/src/safe-errors.ts` supplies `notFound` and `safeErrors`.
- **You implement:** a class `PublicRepository` (interface in `public-api.ts`) reading the `published` schema only: `listLocations({limit, cursor})` returning the `LocationCollection` shape, `getHistory(slug)`, `getMedia(id)` (derivatives only), `getInsights({cohort})` from the approved snapshot, optional `getStories()`. Return `null` for anything unknown OR unpublished.
- **Wire it:** in the real server, after `createApp()`: `app.use("/api/v1/public", publicApi({ repository: new PgPublicRepository(pool) }))`, then `app.use(notFound); app.use(safeErrors);` last.
- **Test:** start the server and run `pnpm --filter @makarba/api conformance http://localhost:<port>/api/v1/public` (expect `11/11 checks passed`), `python scripts/check_public_contracts.py --fixtures --base-url http://localhost:<port>`, then `E2E_TARGET=preview pnpm --filter @makarba/web test:e2e`.
- **Unlocks:** every public page against real data (#74–#80, #82, #88, #113, #117).

## 2. Aggregation and disclosure (issues #84, #92) - size **M-L**
- **Prepared:** `packages/analytics` (eligibility, distinct counting, k=5 and complementary suppression, versions, `ratingGroupToCohort`, cohort manifest and differencing check), frozen cases `docs/project/fixtures/analytics-cases.json` with hand-computed expected values, mutation guard.
- **You implement:** the worker that maps approved database rows to the `Interview` record shape (`packages/analytics/src/index.ts`) and calls these functions; persisting snapshots; the independent publication step. Server-side enforcement is the control, not the frontend.
- **Test:** feed the worker a database seeded from `analytics-cases.json`; its output must equal the file's `expected` block; `python scripts/mutation_check.py` extended to your service.
- **Unlocks:** real Urban Insights (#88/#91 live), place summaries (#89), exports (#104).

## 3. Consent records and raw endpoints (issues #37, #38) - size **L**
- **Prepared:** the rules oracle (`packages/field-flow`), the private-route pattern and 23 abuse-case tests (`apps/api/src/threat-model.test.ts`, register `docs/architecture/threat-model.json`), eligibility flags in analytics.
- **You implement:** consent storage, withdrawal propagation, raw interview/GPS endpoints. Re-run the abuse register against them; cases AC-15 and AC-17 are the acceptance.

## 4. Journey (issue #113, live mode) - size **S once 1-3 exist**
- **Prepared:** `packages/journeys` dual-mode harness. `pnpm --filter @makarba/journeys live` with `LIVE_API_BASE` lists exactly which of five private routes and the public insights route are missing. Proposed routes: `POST /private/test/reset` (test environments only), `POST /private/interviews`, `POST /private/interviews/:id/approve`, `POST /private/interviews/:id/withdraw`, `POST /private/publication/run`.
- **Test:** `LIVE_API_BASE=https://test-env LIVE_AUTH_JSON='{"lead":{"cookie":"..","csrf":".."},"administrator":{...},"researcher":{...}}' pnpm --filter @makarba/journeys test`; the same assertions as the synthetic run must pass.

## 5. Security hardening (issue #41 findings) - size **S**
Mount `notFound` and `safeErrors` last; add rate limiting (none exists); make unauthenticated private-route attempts auditable; mount private routers behind `createApp` for `no-store`.

## 6. Media (issue #60) - size **L**
Prepared: `packages/place-content` media rights model, `audit.ts`, gallery and panorama UI. You implement the quarantined upload, scanning, re-encoding, derivative storage and EXIF stripping; run `auditPublication` over the real asset records.

## 7. Dependencies (issue #193) - size **S-M**
Upgrade vitest in `apps/api` (>= 3.2.7, as `apps/web` already runs), upgrade zod in `packages/config` (runtime; >= 4.6.6), delete the matching entries from `docs/project/audit-baseline.json` and keep `python scripts/check_dependency_audit.py` green.

## 8. Stories contract (issue #80)
Adopt the proposed `Stories` shape into `packages/contracts` (fixture `docs/project/contracts/proposed/stories-fixture.json`, strict parser `apps/web/src/stories.ts`); the router already serves `/stories` when `getStories` exists.

## Added 2026-11-08 (second pass)

### 9. Snapshot pipeline (issues #84, #92) - size **M**
- **Prepared and tested (12 tests, synthetic adapters):** `packages/analytics/src/pipeline.ts`: `EligibleRecordSource` and `SnapshotStore` interfaces, `buildSnapshot` (manifest differencing check, per-place cohorts, contract validation), `saveCandidate`, `publishSnapshot` (refuses self-approval, stale inputs after a withdrawal, invalid payloads; a failed publish leaves the previous snapshot), `invalidateCurrent`. `InMemorySource`/`InMemoryStore` are the reference adapters.
- **You implement:** a `SnapshotStore` over your tables (atomic `publish` that swaps the single current snapshot) and an `EligibleRecordSource` that returns only authorised, study-scoped rows in the `Interview` shape plus an `inputRevision()` that changes on any change or withdrawal. Call `invalidateCurrent` from the withdrawal job.
- **Test:** seed a database from `docs/project/fixtures/analytics-cases.json`, run the pipeline through your adapters, expect the same outputs as `packages/analytics/src/pipeline.test.ts`.

### 10. Deployment (issue #124) - size **M** (mostly decisions)
- **Prepared:** everything in `deploy/` and `deploy/README.md`; `python scripts/check_deploy_config.py`; `python scripts/deploy_smoke.py <url> --expect-https`; `pnpm --filter @makarba/web exec playwright test e2e/csp.spec.ts` (production build under the required headers in a real browser). Container builds were not executed locally (no Docker).
- **You do:** provider/region/tile-provider/spend decisions with the owner, secrets in the platform store, `deploy/rollback.sh` platform commands, a real staging deployment, a recorded rollback and restore rehearsal. Add graceful shutdown and the readiness (database) check to `apps/api/src/server.ts`, and mount `publicApi`, `notFound`, `safeErrors` there.

### 11. Field sync scenarios (issue #62) - size **L** (the field app itself)
- **Prepared:** `packages/offline-sim` (`SyncAdapter` interface, simulator, 12 scenarios, 16 tests). **You implement** the field app's offline store and sync behind `SyncAdapter` and run `SCENARIOS` against it, then do the real-phone runs with `tools/offline-probe` and `python scripts/check_device_reports.py`.
