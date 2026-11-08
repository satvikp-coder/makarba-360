# Test strategy and explicit expected results

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

This is a future executable test specification; product tests have not run in planning. Use synthetic coordinates outside Makarba and fictional nonidentifying answers marked test-only. Test fixtures are not research results. Unit: validation/consent/quality/counting; integration: actual PostGIS, grants, transactions, upload quarantine; browser: Playwright; accessibility: axe + manual; device: physical Android/iOS with network faults.

| Case | Reproduction / fixture | Expected result |
|---|---|---|
| T01: Interview at A discusses B | Capture synthetic A and choose distinct B | Private point=A, topic link=B, B rating only; no public A |
| T02: GPS permission denied | Deny prompt before acquisition | Explicit denied status; approved null/manual fallback; no invented fix |
| T03: Poor accuracy | Return >50m reported estimate | Low-quality flag and recapture/review, not exact-position claim |
| T04: Manual correction | Move pin with stated reason | Raw fix immutable; effective point/manual provenance retained, no fake accuracy |
| T05: Online start offline finish | Disconnect mid interview and restart app | Acknowledged local draft recovers; no false synced badge |
| T06: Retry identical survey | Lose server response and resend same key/hash | Same receipt and single logical interview write |
| T07: Concurrent sync | Send 10 simultaneous same-key operations | One transaction effect; consistent receipt, no duplicate audit effect |
| T08: No publication permission | Research-only consent and attempted identifiable story | Private research may remain under approved scope; story/media publication denied |
| T09: Anonymous raw request | GET raw interview/GPS with no session | 401/403 or safe not-found; no sensitive payload/log/cache |
| T10: Researcher invokes admin action | Valid collector session calls role-grant endpoint | 403, no mutation; security audit metadata |
| T11: Deleted/unpublished subject | Archive selected place before sync | Reference preserved or explicit review-required error; no silent relink/public leak |
| T12: Missing or unsure answer | Submit null with unsure/refused/not_asked reasons | Not numeric zero; denominator/exclusion rules correct |
| T13: Tiny stakeholder cohort | Attempt category/date/place filter differencing | Unsafe cohort and complementary reconstruction suppressed |
| T14: Undated historical photo | Comparison lacks verified date/source | Pair stays unpublished; honest unavailable state |
| T15: Panorama unavailable | 404/provider denial/WebGL loss | Static approved photo/text with date/source; no false continuous coverage |
| T16: Outside study area | Capture outside verified polygon/at edge | Outside flag; boundary edge policy tested; lead review, no auto-snap |
| T17: Half media upload | Interrupt upload before completion then retry | Interview preserved, asset private/pending; digest checked after resume |
| T18: Official claim unverified | Choose official category without verification | Label claim pending; no official attributed statement |
| T19: Participant withdrawal | Withdraw while publication job retries and after restore | Affected public content invalidated; job cannot republish; tombstones replay |
| T20: Invalid/unpublished chart input | Include rejected/duplicate/withdrawn/unreviewed records | Only eligible approved current records counted; exclusions explicit |

Additional gates: empty/upgrade migration, same operation key changed payload 409, revoked account sync, unknown questionnaire branch, storage quota/eviction/key loss, CSV formula injection, image polyglot/malware, EXIF metadata stripping, stale publication revision, failed backup and unsupported translation. Run negative tests before exposure; do not rely only on snapshots mirroring implementation.

Each test report records issue/commit, fixture, environment/device/version, command or manual steps, expected/actual result, artifact and limitation. CI gates selected domain tests, integration/privacy regressions, type/lint, secret/dependency scans and browser checks when available; required checks are configured only after real workflows exist. Performance uses N05/N06 fixtures, does not mix provider tile latency with API latency. Field/device/security/restore gates need evidence beyond passing compilation. Code changes trigger relevant checks; do not repeatedly run unrelated suites without new risk.

## Unit-test harness and mutation guard (#106)

**Run:** `pnpm test` (all packages, Vitest) and `python scripts/mutation_check.py`. CI runs both (`node` and `conformance` jobs).

**Boundary tests** (`packages/contracts/src/boundaries.test.ts`, synthetic fixtures only, coordinates outside Makarba) sit exactly on each rule edge: cohort n=4 rejected / n=5 accepted (provisional k=5), valid+missing+unsure equal to n accepted / n+1 rejected, ratings must sum to the valid-answer count, null counts are rejected rather than read as 0, suppressed cohorts must carry null counts, a reason and no detail, and restricted-field names are matched regardless of case or punctuation.

**Mutation guard** (`scripts/mutation_check.py`): deliberately edits a rule in `packages/contracts/src/index.ts` (k 5→4, denominator slack, allowing leaked suppressed counts, tolerating null counts), runs the tests, restores the file, and fails if any mutation leaves tests green. Repro for the "tests fail on changed rule" criterion: `python scripts/mutation_check.py` prints `killed` for each mutation. Last local run: 4 of 4 killed.

**Limitations:** The mutation list is hand-written and covers the cohort rules only; add an entry when a new privacy or missingness rule is added. Fixtures are synthetic; a passing run proves the rules enforce what the contract states, not that the k=5 threshold is the right policy (that is a research-lead decision).

## Spatial invariants and migration paths (#108)

Tests: `packages/db/src/spatial.test.ts`, run by the CI `database` job against a PostGIS container (they are skipped locally when `TEST_DATABASE_URL` is not set, and were not run on the author's machine; the CI result on the pull request is the evidence). Synthetic geometry around [10,10].

**Migration paths.** (1) Applying versions 0001 to latest one at a time produces exactly the same tables and columns as applying them all at once, and a further run applies nothing. (2) Starting from every intermediate version, upgrading reaches the latest and the ledger has one row per migration. (Existing tests already cover the empty database, tampered checksums and rollback of a failing migration.)

**What cannot reach the published projection.** Valid point, route and area in EPSG:4326 are accepted. Rejected: a missing geometry (NOT NULL), geometry in another coordinate system (3857, 32643, unknown SRID 0), a self-crossing polygon, an empty geometry, a plain (non-multi) polygon, a geometry collection, longitude 181 and latitude -91 (check constraints), and 3D geometry. A location in state `published` or `approved` without a review date is refused, a candidate is accepted.

**Edge membership rule.** A point exactly on the study-area edge or corner counts as inside (`ST_Covers`), a point 0.000001 degrees outside is outside, a route that leaves the area is not covered while one running along the edge is, and `ST_Contains` would wrongly exclude the edge. This is the same rule as the application's point-in-ring check (`packages/place-content`, candidate boundary check), so the two cannot disagree on boundary points.

**Limits.** Real Makarba boundary and road data do not exist (#5, #28), so the area is a synthetic square; sub-metre edge behaviour in a projected CRS is not tested. Live import tooling (#31) is covered separately in `packages/gis-io` and is not connected to the database.

## Performance, dependency and CI-policy gates (#115)

All run in the CI `conformance` job unless noted; failures block the job. None of them uses `continue-on-error` or `|| true`.

**CI policy** (`scripts/check_ci_policy.py`, unit-tested in `scripts/test_ci_gates.py`): fails if any workflow contains `continue-on-error` (other than `false`), `|| true` / `|| exit 0`, or a permanently disabled step (`if: false`), or if a required job is missing (`ci/node`, `ci/conformance`, `ci/browser`, `ci/database`, `planning/planning`). It prints the five job names to require in branch protection.

**Required status checks.** At the time of writing `main` has no branch protection at all (the GitHub API answers "Branch not protected"). Making the five checks above required, so that a failing check actually prevents merge, is a repository-owner setting and was deliberately not changed by this work (AGENTS.md: no new mandatory protection rule without the owners). Until it is set, "failing required checks prevent merge" holds by process, not by GitHub enforcement. See human action H-CI.

**Dependency advisories** (`scripts/check_dependency_audit.py`, baseline `docs/project/audit-baseline.json`): runs `pnpm audit` and fails on any advisory that is not in the reviewed baseline, on a baseline entry past its `review_by` date, and on an entry without owner, reason or review date. The first run found 20 advisories (4 critical, 2 high). The web app's own were fixed by upgrading maplibre-gl 4 to 6 (critical sanitizer bypass), vite 5 to 6, vitest 2 to 3 and react-router 6 to 7 (this also changed how the production build starts the map worker, which the new production-build browser run caught and fixed). The remaining 16 are in Developer A's packages (vitest in `apps/api`, zod in `packages/config`, typescript-eslint) and are listed in the baseline with owner `developer-a` and review date 2026-12-31. The zod one is a runtime dependency (memory exhaustion on oversized constrained collections) and needs a zod 4 upgrade by Developer A. This check needs the npm registry; it retries three times and fails if the registry stays unreachable.

**Performance budgets** (`scripts/check_budgets.py`): gzip sizes of the production build: entry JS 120 KB (now 88.5), map chunk 340 KB (286.8, loaded only on the explorer), map worker 170 KB (144.0), CSS 15 KB (11.5), panorama JS 25 KB (17.2) and CSS 5 KB (2.5); fixture bundle 200 KB (4.9); mock API p95 300 ms over 120 requests, 8 at a time. An asset that is in no category fails, so a new bundle is a conscious decision. Making the map lazy cut the home-page JavaScript from 385 KB to 91 KB gzip. **The numbers are proposed defaults chosen from current sizes with headroom; they have not been agreed by the team (H-CI).** Real-device and real-network performance, and a load test of the real API, are not measured.

**Production-build browser tests.** The CI `browser` job now runs the Playwright suite against `vite preview` of the production build (`E2E_TARGET=preview`), so a bundling problem such as the map worker cannot hide behind the dev server.

## Synthetic journey: capture at A about B, review, safe public snapshot (#113, partial)

`packages/journeys` (12 tests) composes the real rule modules: the field interview rules (`field-flow`), review authorisation (`admin-screens` with Developer A's `Authorizer` and the proposed capability matrix), aggregation and disclosure (`analytics`) and the shared public contract (`contracts`). A small adapter in the test stands in for the submission pipeline. **This is a composition of models, not an end-to-end run through the field app, API and database, which do not exist yet**, so #113 stays open.

**Positive path.** Twelve invented interviews are driven through the field rules (consent, participant, interview position captured at street-A, discussed place lake-B, answers, durable write, server receipt), approved by a lead, and aggregated. lake-B gets 12 interviews (10 valid ratings, 1 unsure, 1 refused); street-A gets nothing because nobody discussed it. The review screen model shows "Where this interview was held (private)" and "Discussed: lake-B" separately. The resulting snapshot validates against the shared contract, contains no interview position, held-at place, interview id or restricted field (checked against the exact generated coordinates), and is byte-identical on a second run (same SHA-256).

**Negative paths.** Refused consent ends the interview with no position and nothing submitted; a record that is saved locally but not yet received by the server is not submitted; unreviewed interviews appear in no figure; withdrawal after approval removes the person, and if that leaves a rating cell under 5 the whole group becomes suppressed with no residual counts; technical administrators, researchers, a lead of another study and anonymous callers cannot approve; missing aggregate consent keeps an approved interview out of public figures; an interview about two places is counted once overall and once per place with the overlap warning.

**Not covered.** Live API, database, publication job, the real field app, offline queue and sync, browser journeys across the public site (those are in `apps/web/e2e`), and real devices. Remaining live prerequisites of #113: #82, #105, #112.
