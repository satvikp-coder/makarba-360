# Historical evidence and fact review

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

For every claim retain citation/creator, source type, access date, original date and precision, rights, geographic relevance, reviewer and evidence quality. Preferred primary records/dated imagery; secondary sources can contextualise with explicit confidence. Resident memories are accounts, not proven chronology. Officials are attributed only after status/authority and publication scope verification.

Target around 2021 vs 2026 only if evidence exists. Check same feature/viewpoint and record direction/position privately as appropriate, source dates and mismatch limitations. Slider images need rights and reviewed dates; approximate date visible as approximate, unsupported date cannot masquerade as exact. Timelines require supporting source per event; disputed accounts can coexist with labels. Georeferenced historic maps need control points/error notes and licence. Separate measured changes from visible differences and opinions. Editorial reviewer signs the current revision; stale source/permission revokes dependent publication.

## Versioned place content model (#63)

Implemented as `packages/place-content` (TypeScript + zod, synthetic tests). Mock/domain-level only: no database table or API route exists yet, so this is not a live integration (live prerequisite #27 and Developer A's schema review remain).

**Kinds.** `description` (editorial text, no dated claim) and `observation` (dated statement with an evidence kind: researcher observation, respondent account, historical claim, reviewer-checked fact). Each revision carries its own state, evidence quality, sources, rights flag and quote-consent flag. Dates are `{value, precision}` or both null; a value without precision is invalid and an unknown date is never replaced by a guessed year.

**Geometry is a different record.** `GeometryApproval` (per location and geometry revision) has no field on content, and `checkPublishable` accepts no geometry input. Approving the map shape therefore cannot approve any text or image.

**Lifecycle.** candidate → reviewed → approved → published → archived/withdrawn. Review cannot be skipped; published revisions are immutable (an edit creates a new candidate revision with review cleared and `supersedes` set); withdrawn and archived are terminal.

**Publication gate (all must hold).** state is approved; recorded reviewer who is not the author; revision is the latest; rights cleared; quote consent where there is a quote; for observations a known date, an evidence kind, at least one source, and every source verified and not withdrawn. A later source withdrawal removes the content from the public projection (`toPublicContent`), which also never includes author or reviewer identity.

**Errors/permissions.** Failures return a list of plain reasons (suitable for the editor UI). Who may review or publish is enforced by Developer A's role system when integrated; this package only encodes the rule that reviewer differs from author.

**Proposed storage (not applied).** `private.place_content_revisions(location_id, locale, kind, revision, state, body, observed_value, observed_precision, evidence_kind, evidence_quality, source_ids, contains_quote, quote_consent, rights_cleared, author_id, reviewed_by, reviewed_at, supersedes)` with a unique (location_id, locale, kind, revision) and a published-immutability trigger, separate from `audit.location_geometry_revisions`. No migration is added here because `packages/db` is Developer A's and its tests pin the migration list; propose through the handoff process.

**Limitations.** Reviewer-differs-from-author is the only separation-of-duties rule encoded. Translations are separate locale rows and must each be reviewed. No real content exists; fixtures are synthetic.
