# Definition of Done and implementation reports

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

For each issue: dependency evidence checked; approved scope satisfied; acceptance checklist proven by reproducible artifact; relevant positive/negative tests pass; security/privacy/consent/source accuracy reviewed; migration/rollback and compatibility documented; no secrets/real records in Git; documentation current; reviewable PR references issue; CI inspected and findings fixed. Respect required checks/branch protection and session merge authorization; confirm merged commit before issue closure. Planning artifacts alone do not prove implemented features.

Standard report:

```text
Issue: <real number/URL>
Branch: <issue branch>
Commit: <SHA>
PR: <real URL>
Changes: <scope and outcome>
Tests: <commands/fixtures/environment, expected vs actual>
Security review: <permissions, data exposure, consent/media effects>
Limitations: <remaining external dependencies or supported-device limits>
Verdict: PASS / FIX REQUIRED / BLOCKED
```

Workflow: read issue/architecture → verify blockers → branch → implement scoped change → tests → docs → commit/push → PR → inspect CI → review/fix → merge only when authorised/checks allow → verify merge → close with evidence → update roadmap. Do not bypass failed checks, self-certify missing research approvals or label compilation as completion.
