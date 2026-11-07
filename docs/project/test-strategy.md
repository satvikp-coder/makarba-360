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
