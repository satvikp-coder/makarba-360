# Workload balance and estimation

Generated from developer-issue-allocation.json. No dates, product implementation or participant data. GitHub B assignment is pending invitation acceptance; labels reserve B work as requested. Issue #1 was completed concurrently in PR #137 and is preserved; remaining work begins at #6.

Estimate method: S=1, M=3, L=5, XL=8. Score implementation, uncertainty, testing and integration from 0–2 each. Scores 0–1 → S, 2–3 → M, 4–5 → L, 6–8 → XL. Per-issue factors and concrete delivery rationale are in JSON. Estimates are relative engineering effort, not hours; external approval waiting time is a separate risk. Re-estimate after first vertical slices. XL labels flag uncertainty; split only if actual review reveals independent deliverables, not to balance numbers. No issues were invented or split for arithmetic.

| Metric | A | B |
|---|---:|---:|
| Open issues | 62 | 73 |
| Effort points | 308 | 338 |
| Effort share | 47.68% | 52.32% |
| Core M00–M11 points | 300 | 286 |
| P0 issues | 23 | 4 |
| P1 issues | 34 | 24 |
| XL risk issues | 14 | 11 |
| Foundation | 3 | 0 |
| Parallel | 45 | 58 |
| Integration | 14 | 15 |
| Technically ready now | 2 | 4 |
| Hard-blocked by other stream before / after replan | 25 / 20 | 48 / 32 |

Total: 646 points. Overall point ratio 1.097; core ratio 1.049. Both are within 10% relative effort. Counts are deliberately unequal because A owns more private/offline complexity. Stretch work is reported separately so it does not conceal an overloaded core workstream.

A retains more P0 security/field tasks by architectural necessity. B owns substantial risk in #41 adversarial tests, #54 offline feasibility, #62 recovery tests, #113 E2E, #115 quality gates, #117 devices and #124 deployment. A must review B offline decision and production grants. B owns content-domain models, non-sensitive GIS tooling and reporting over approved aggregates; this is not access to raw survey data. Testing and operations are shared, not assigned entirely to A. Institutional/legal and field evidence remain external uncertainties; research and rights validation cannot be estimated as guaranteed turnaround.

Assignment completion is separate from balance: A GitHub assignments are applied and verified during publication; all 73 B reservations remain pending GitHub assignment by explicit instruction while the invitation is unaccepted. This requires a PARTIAL final verdict, not PASS.
