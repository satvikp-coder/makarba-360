# Research management UX

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Implement A01–A12, distinguishing researcher lead and technical administrator capabilities. Desktop table filters: study, visit, collector, form version, consent, record state, quality. Mobile presents review cards and detail steps, not squeezed full-width tables. Bulk actions require preview, scope count and per-record eligibility; no bulk public approval without consent/evidence checks.

```text
[Study] [Review queue  ] [Publication warnings]
Queue | Consent | GPS | History/media | Exports | Audit
ID    status    missing checks    assigned reviewer
[Open record]
  Left: private source/revisions  Right: checks and decision
  [Request changes + reason] [Approve current revision]
Publication preview: exactly what visitors will see
  [Disclosure result] [Independent approval] [Revoke]
```

GPS review is private and shows capture vs manual correction provenance; poor accuracy and out-of-area points are flags requiring contextual assessment. Official attribution requires verification evidence and scope. Exports require stated purpose, column allowlist, expiry and download audit. Withdrawal view traces all affected publications/media/snapshots, displays invalidation status and purge/backups deadlines. Questionnaire editor validates branching and preview before immutable version publication.
