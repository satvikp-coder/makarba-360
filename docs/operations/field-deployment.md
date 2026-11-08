# Field pilot and handover

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Pilot only after approved method/consent, field MVP checks and device security decision. Train researchers using synthetic data, then consent-approved small pilot: GPS at A/discuss B, denied permission, poor fix, airplane mode, app suspension/restart, expiring session, partial uploads and duplicate reconnect. Reconcile saved UUIDs/receipts and capture actual timing/usability issues. Stop real collection on loss, unexpected public exposure or unreliable saves; approved fallback may resume only after mapping/consent validation.

Handover includes actual maintainers, deployment accounts ownership, secret transfer through approved vault, restore evidence, data/rights inventory, source limitations, operating costs, renewal schedule, instrument versions, known defects and an end-to-end demonstration. The planning source repository is public following the owner's explicit request recorded in visibility-decision.md. Future contributions must preserve the no-real-research-data rule; source/media licensing and private application authorization remain separate.

## Historical source and media attribution audit (#123, tool delivered; audit of real content pending)

`packages/place-content/src/audit.ts` (6 tests) takes everything that is about to be public (claims, comparison pairs, panoramas, stories, and the asset records they use) and produces a report: for each item pass, fail or unavailable, the trace back to its evidence (public copy to private original to source) and the reasons. It reuses the same rules that gate publication (claim chronology, comparison pairs, public media copy, stories), so the audit cannot be easier than publication.

**Unavailable is not a failure.** If the historical image, the date or the panorama image is absent, the item is reported *unavailable*, is not in the `publishable` list and must not be shown; nothing is filled in. A missing right, withdrawn consent, unverified source, stale story revision, missing reviewer or broken derivative chain is a *fail*, and the report verdict is FAIL while any item fails.

**How to run the audit before a release.** Build the snapshot from the approved content tables, run `auditPublication`, attach the report to the release check (#126), fix or unpublish every failing item, and publish only the `publishable` list. Re-run after any withdrawal.

**What is not done.** No real historical source, photograph, panorama or quote exists yet, so no real content has been audited and the issue stays open: the audit has to be run on the actual pilot content, by the research lead for rights and consent judgement (human action H9). The tool reads records; it cannot tell whether a recorded licence, permission or verification is genuine, and it does not read the images themselves. Wiring it to the database is Developer A's integration.
