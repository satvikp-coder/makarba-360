# Dependency preparation progress (open Developer B issues)

Checklist per issue: **Impl** = code that does not need the live dependency exists; **Tests** = automated tests exist and pass; **Adapter** = reusable connection point with an injected dependency; **Live** = verified against a real service; **Human** = real-world evidence or approval. Values: yes / partial / no / n/a. No percentages are given because the missing parts (live services, people, devices) are not measurable as a share of code. Generated status of record: `CLAUDE_DEVELOPER_B_PROGRESS.md`.

| Issue | Impl | Tests | Adapter | Live | Human | Status |
|---|---|---|---|---|---|---|
| #5 study extent | partial (import checks `gis-io`, candidate rules) | yes (25) | n/a | no | no | BLOCKED-HUMAN: an authorised person must supply and verify the boundary; nothing is invented |
| #28 road corridors | partial (same tooling) | yes | n/a | no | no | waits on #5 |
| #41 threat model | yes (register, 23 tests, `safe-errors.ts`) | yes | partial | no | no (matrix #6 unapproved) | BLOCKED-LIVE-SERVICE + BLOCKED-HUMAN |
| #54 offline | yes (`tools/offline-probe`) | yes (5, desktop only) | n/a | n/a | no | BLOCKED-DEVICE |
| #62 field network tests | no | no | no | no | no | waits on #54 |
| #80 history and voices | yes (Voices page, strict parser) | yes (9) | yes (`/stories` in public-api) | no | no | contract adoption + endpoint |
| #82 responsive map | yes | yes (Chromium) | n/a | n/a | no | BLOCKED-DEVICE |
| #113 end-to-end journeys | yes (dual-mode harness) | yes (20; live mode skipped) | yes (`LiveAdapter`, preflight) | no | no | BLOCKED-LIVE-SERVICE: 5 private routes missing |
| #114 accessibility | yes (axe, keyboard, zoom, motion) | yes (33) | n/a | n/a | no | BLOCKED-HUMAN |
| #115 CI/security gates | yes (policy, audit, budgets, conformance step) | yes | n/a | n/a | no (ruleset not applied; budgets not agreed) | BLOCKED-HUMAN |
| #117 mobile compatibility | partial (probe, viewport tests) | partial | n/a | n/a | no | BLOCKED-DEVICE |
| #118, #119 training and pilot | no | no | n/a | n/a | no | BLOCKED-HUMAN (ethics approval, trained researchers) |
| #120 verified places and roads | partial | yes | n/a | no | no | BLOCKED-HUMAN |
| #123 source audit | yes (`auditPublication`) | yes (6) | yes | no | no | BLOCKED-HUMAN: no real content |
| #124 deployment | no (provider undecided) | no | no | no | no | BLOCKED-HUMAN: provider and budget |
| #126, #127 release and handover | no | no | n/a | n/a | no | blocked by #115, #117, #120, #123, #125 |
| #128-#135 stretch | no | no | n/a | n/a | no | blocked by #126 (and #28, #90, #92, #105 where listed); no speculative prototypes were built |

Not claimed anywhere: live integration, field-pilot readiness, production readiness. The public API router, conformance suite and journey harness are built so that connecting the repository and the five private routes is the remaining work (`VARUN_MINIMAL_CONNECTION_TASKS.md`).
