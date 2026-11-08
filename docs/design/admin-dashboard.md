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

## Candidate location approval (issue #101, screen A06)

Rules model in `packages/place-content/src/candidate.ts` (48 package tests including 17 for candidates, synthetic geometry and a synthetic boundary around [10,10]). No admin screen, database table or route exists; Developer A's candidate review state (#94, #30) is a live prerequisite and is not claimed.

**Flow.** A researcher proposes a place (state `candidate`, private). A reviewer records four separate checks, each with written evidence: source, name, access, boundary (state becomes `in_review`). A different person approves; only then can it be published. Reject and Request changes need a reason. Approved, rejected and published candidates cannot be re-checked or edited; a published place is withdrawn through the content process, not rejected.

**Conditions for approval.** All four checks passed; no check made by the approver; approver is not the proposer; checks belong to the current revision. Editing name, category or geometry creates a new revision and clears every check, so an approved shape cannot be quietly swapped.

**Boundary is computed.** The boundary check is evaluated against the supplied study boundary, not asserted by the reviewer: a reviewer cannot record "passed" for a geometry with any vertex outside, and a missing boundary blocks the check. The boundary is an input; the verified Makarba boundary (#5) does not exist, so the tests use a synthetic square.

**Privacy.** The public view exists only for a `published` candidate and is re-checked against the boundary at the edge, so an out-of-boundary or rejected candidate is never visible even if data were corrupted. It contains id, name, category and geometry only: no proposer, reviewer, evidence or reasons. Approval of geometry is not approval of descriptions, history or photographs (see the versioned content model).

**Reviewer view.** `geometryDiff` summarises changes between revisions (type changed, vertex delta, moved) for the A06 comparison panel; nothing is overwritten by viewing it.

**Limits.** Source, name and access checks are human judgements recorded as evidence; software cannot verify them. Polygon holes and ring validity are not checked here (see `packages/gis-io`; PostGIS is the authority at write time).
