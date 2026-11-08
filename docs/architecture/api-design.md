# API contracts

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Version prefix `/api/v1`. JSON over HTTPS, UUID IDs generated before offline capture, RFC3339 UTC timestamps plus original offset/device time; GeoJSON longitude-first EPSG:4326. Explicit pagination limits (default 50, max 200), bounded bbox and filter cardinality. Runtime schemas reject unknown sensitive fields on public DTOs. Errors: `{code,message,fieldErrors,requestId,retryable}` with no raw values or stack traces.

The two-developer v1 planning handoff refines these shapes and public history/media descriptors in [developer-handoffs.md](../project/developer-handoffs.md), with executable synthetic fixture checks. #9 reviews/freezes contracts and #10 implements shared runtime/TypeScript validators and mock API mode. These documents are not a claim that the API exists.

| Route | Access | Contract / result |
|---|---|---|
| GET /public/locations?bbox=&category=&q= | Public projection role | Published feature summaries; ETag; no interview IDs |
| GET /public/locations/:slug | Public | Approved evidence, media derivatives, safe summary |
| GET /public/insights?snapshot=&cohort= | Public | Preapproved cohort only; n/missing/unsure/method metadata |
| GET /public/study-area | Public | Verified published boundary, provenance, attribution |
| GET /session; POST /logout | Team session | CSRF protected logout; no refresh tokens in browser storage |
| POST /field-visits | Researcher | Assigned study, start timestamp; UUID receipt |
| GET /survey-versions/:id | Team | Immutable instrument and branch rules |
| POST /sync/operations | Own study | operationId, interviewId, baseRevision, surveyVersion, consent, positions, subjectGroups, answers, attachment manifests |
| GET /sync/operations/:id | Owner/reviewer | Durable receipt without repeating writes |
| POST /media/upload-intents | Owner | Validated MIME/size/hash; short lived private upload target |
| POST /media/:id/complete | Owner | Verify object/hash; queue quarantine scan |
| POST /reviews/:id/decision | Assigned lead | Expected revision; reason; immutable decision |
| POST /publication-snapshots | Publisher | Approved input revisions and policy version; cannot publish own unreviewed content |
| POST /withdrawals | Lead | Restricted receipt reference; invalidate affected copies |
| POST /exports | Lead with purpose grant | Async approved columns/cohort, expiry, audited download |

Success sync receipt: operationId, entityId, serverRevision, serverReceivedAt, status and missingAttachmentIds. 401 requires online reauthentication; 403 never retried automatically; 409 distinguishes changed payload under same operation key vs stale base revision; 413 oversize; 422 validation/instrument retired; 429/503 backoff. Unknown/removed place returns explicit review-required status, not silent relinking. Safe not-found responses prevent identifier enumeration. API contract and transaction idempotency precede field sync implementation.

## Database-backed public API (issue #81)

`apps/api/src/pg-public-repository.ts` implements `PublicRepository` over the `published` schema only: locations (PostGIS to GeoJSON, keyset pagination by id), history, media, the single current insights snapshot, and stories. Migration `0007_published_projection.sql` adds `published.history`, `published.media`, `published.insights_snapshots` (a partial unique index allows one current snapshot) and `published.stories`; rows hold already-validated public DTOs as jsonb and are written only by the worker role. Withdrawal is deletion, so the next request answers the same 404 as an unknown place. `apps/api/src/server.ts` mounts it at `/api/v1/public` when `PUBLIC_DATABASE_URL` (a connection string for the `makarba_public_api` role, never `DATABASE_URL`) is set, mounts `notFound` and `safeErrors` last, and shuts down gracefully.

**Evidence:** `apps/api/src/pg-public-repository.test.ts` (7 tests, CI `database` job, real PostGIS, synthetic fixtures) runs the shared 11-check conformance suite against the database-backed router and proves role isolation, withdrawal, pagination, single-current-snapshot and the contract guard. **Not covered:** the publication worker that writes these tables (issues #84, #103, #105), real published content, and browser journeys against this server (the existing Chromium suite still uses the mock).
