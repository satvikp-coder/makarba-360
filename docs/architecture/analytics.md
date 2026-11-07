# Analytics and public projection contract

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Input eligibility: submitted current interview revision, lead-reviewed/approved, valid research and aggregate consent, not withdrawn/rejected/duplicate, known immutable questionnaire version. Use per-topic answers only for their explicitly discussed place. Raw position is used only for private coverage processing; public place rating is not inferred from capture spot.

| Metric | Numerator / base | Missingness rule |
|---|---|---|
| Interview count | Distinct eligible interview UUIDs | Separate total collected from eligible analyzed |
| Stakeholder distribution | Distinct eligible by category / known or explicit category base | Show refused/unknown separately as policy permits |
| Rating distribution | Count 1–5 / valid numeric answers per subject/question | Unsure/refused/not-asked excluded from numeric base, counted separately |
| Perceived change | Better/worse/same / valid applicable responses | Do-not-know/short association separate, no measured-change claim |
| Reported issues | Selected or human-coded issue occurrences / responding interviews or topics, clearly named | Multi-select may sum >100%; coding provenance retained |
| Improvements/themes | Human-reviewed codebook counts / valid coded answers | Optional blank not counted as no concerns |
| Place comparisons | Per-topic valid answers with distinct respondent count | Cross-place totals overlap; no false independent population sample |
| Coverage | Eligible interview positions grouped in approved coarse grid | Missing/poor/out-of-area handled by recorded policy, no raw pin |

Each snapshot pins input revision hash, survey versions/concept mapping, codebook, policy version, period, numerator/base, valid n, missing/unsure/excluded counts and caveat. Do not pool incompatible instruments without explicit reviewed mapping. Counts are convenience-sample findings, not population estimates. Charts display accessible table, question/period/n and limits; downloadable chart preserves metadata.

Disclosure policy: provisional k≥5 for all releasable cohorts and grid cells; complementary suppression, totals and intersecting date/group/place filters tested against reconstruction. Only fixed reviewed cohorts/date windows, no arbitrary query builder. Publication fails closed when policy cannot approve. Threshold/grid alone does not guarantee anonymity; institutional review and contextual assessment required. Tiny official cohorts may need whole comparison withheld. Raw precise times/researcher identities never emitted.

Worker computes private candidate snapshot → disclosure check → independent review → immutable public payload; allowlisted columns only. Public coverage geometry is a broad approved cell, not point jitter or raw centroid. Withdrawal/revision invalidates affected snapshots and cache keys before new publication; jobs verify current input/consent revision at commit so race cannot republish revoked material. Reproducible independent synthetic expected counts test all exclusion and overlap cases.
