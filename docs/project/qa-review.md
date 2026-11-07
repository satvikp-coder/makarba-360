# Planning QA review

Review date: 2026-11-07. This checks the planning package and actual GitHub setup; it is not a product security, GPS or offline reliability certification.

Automated verification (`python scripts/verify_planning.py`) read the actual GitHub repository, all paginated issues, milestones and labels. Result: **zero errors**. The machine-readable result is [qa-results.json](qa-results.json); [remote-snapshot.json](remote-snapshot.json) records the inspected assignments.

| Check | Actual result |
|---|---|
| Blueprint | All 23 pages read; checksum recorded; 23 page mappings verified |
| Requirements | 25 functional groups plus 10 measurable non-functional targets; sources and assumptions documented |
| Issue backlog | 136 distinct local and remote tasks; no duplicate catalogue markers or titles |
| Required issue sections | All 18 nonempty sections and at least four acceptance checkboxes per issue |
| Milestones | 13 actual GitHub milestones; all 136 issues assigned to the expected one |
| Dependencies | 303 real-number blocker references; no missing IDs, self-dependencies or cycles |
| Labels | 45 repository labels including retained GitHub defaults; no required definition or issue label missing |
| Ready/blocked | 1 initially ready; 135 blocked by listed implementation dependencies, not setup failures |
| Screens | 39 distinct public/researcher/admin specifications |
| Tests | All 20 requested critical scenarios have explicit reproduction and expected result |
| Local Markdown links | No broken repository-relative links |
| Publication integrity | Every remote issue body exactly matches its local Markdown contract |
| Planning automation | Python compilation passed; first pushed baseline passed GitHub Actions planning integrity |
| Credential pattern scan | No matching GitHub token, AWS key or private-key patterns in 213 then-present planning files; lightweight check, not a formal secret audit |

Architecture review covered researcher-only entry, independently stored interview and subject geography, restricted precise GPS and raw answers, allowlisted public projection with separate DB grants, versioned consent/questionnaires, official claim verification, offline storage loss/key risks, idempotent concurrent sync, secure media, historical evidence, safe counts/suppression, withdrawal races and backup tombstone replay. Structured observations and conditional fallback import were added as separate issues after this review.

The supplied inventory contains 133 tasks; three focused additions make 136. The two additions created after initial issue publication have actual issue numbers recorded in the mapping; milestone order must not be inferred from issue numbers. No issue was closed simply because a planning document exists.

Manual evidence review also corrected the initial palette guidance: teal on terracotta/lake blue fails normal-text AA. Contrast is measured in contrast-audit.md; future actual interfaces still need manual testing.

Known limits: no product code, real field dataset, institutional approval, verified study geometry, paid hosting or provider accounts have been created. Product tests are specified, not executed. Exact privacy thresholds, retention, bilingual consent and device policy require institutional approval before real collection. GitHub Projects was denied for insufficient token scopes; milestones, labels and indexed issues remain usable. No board URL or branch-protection enforcement is claimed.

Final publication checks: run `python scripts/verify_push.py` after the final commit/push to compare HEAD with the actual GitHub main commit and every tracked blob, then inspect the latest GitHub Actions result. The JSON QA snapshot records the commit observed when queried, which naturally precedes the audit commit containing that snapshot; it is not a claim to embed its own final commit SHA.
