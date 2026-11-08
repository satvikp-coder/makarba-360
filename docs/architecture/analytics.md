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

## Aggregate analysis modules (issues #85, #86, #87, #89)

Implemented as `packages/analytics` (pure TypeScript, 27 tests, synthetic interviews; expected counts are written by hand in the tests, not produced by the code). This is the calculation layer only. The worker that reads Developer A's tables and snapshots (#84), the disclosure service (#92) and the publication step are not built here, so nothing is live; the real worker must reproduce these results.

**Eligibility (all four).** Same rules as above: approved, current revision, research and aggregate consent, not withdrawn, inside the period, one record per interview id. Each exclusion is counted under its own reason (`duplicate_record`, `not_approved`, `superseded_revision`, `no_research_consent`, `no_aggregate_consent`, `withdrawn`, `outside_period`) so "collected" and "analysed" are both reportable.

**#85 Stakeholder distribution.** Distinct eligible interviews per category, so an interview about three places counts once. Unknown or refused is a separate figure, shown only if at least k, else absent (null), never 0. Fewer than k eligible interviews: nothing released.

**#86 Reported issues.** Two separate tables: categories the respondent selected, and themes an analyst coded (with codebook versions and number of coders). One interview counts once per category even if it names the issue for several places. The base is responding interviews; a blank answer is outside the base (not "no concerns") while an explicit "none" is inside it. Percentages can add up to more than 100% and the result carries the multi-response note.

**#87 Ratings and perceived change.** For one place only: a topic answer is used only when its subject is that place, so an interview held at A about B rates B and never A (tested both ways). Reports respondents, valid n (integers 1 to 5), unsure, refused, not asked and invalid separately; unsure is never a zero. Different questionnaire versions are separate groups; they are pooled only through an explicit reviewed `version -> concept` mapping, and the group then says it was pooled. Perceived change keeps "don't know" separate and carries "remembered change is not measured change and says nothing about cause". Association duration shows as context with the same suppression. `ratingGroupToCohort` projects a group to the public contract `Cohort`; if hiding a cell would stop ratings adding up to the valid base, the whole cohort is suppressed instead, and the result validates against the shared contract.

**#89 Location summaries.** Counts distinct interviews that discussed the place wherever they were held, with issues taken only from that place's topic blocks. Always states that counts for different places overlap and must not be added. The "also discussed other places" figure is shown only when both it and the single-place remainder are at least k, so subtraction cannot reveal a small group.

**Disclosure.** k = 5 (provisional, per the policy above). Cells under k are hidden, never emitted as 0; if exactly one cell is hidden the smallest remaining shown cell is hidden too (complementary suppression). With two or more hidden cells their total is derivable but not any single value, which the policy accepts. Reconstruction through intersecting date/group/place filters is not covered here: only fixed reviewed cohorts and windows may be requested, enforced by the disclosure service (#92).

**Permissions and states.** Inputs are private; outputs are the only thing that can cross to the public projection and only after independent review. Failure states are explicit: `released: false, reason: "BELOW_K"`, empty cells, null figures. No result mixes rows from unapproved interviews.

**Limits.** k = 5 is a provisional policy, not proof of anonymity. Convenience sample: nothing here is a population estimate. Performance on real volumes untested. Place comparisons beyond overlap, coverage grids and trend analysis are out of scope.
