# Architecture review evidence (issue #9)

Review date: 2026-11-07. Status: **ENGINEERING REVIEW RECORDED; INDEPENDENT HUMAN REVIEW PENDING.** This review was performed by the Developer A engineering agent against the planning documents and automated checks. It is not a stakeholder approval and not a second-person human review; none is claimed. No real participant data, credentials or exact interview coordinates were used.

## Method and limitations
Documents read: `overview`, `system-context`, `component-diagram`, `deployment`, `data-model`, `gis-design`, `offline-sync`, `media-pipeline`, `analytics`, `privacy-security`, `api-design`, ADR 001–007, `docs/project/developer-handoffs.md`. Executable evidence: `python scripts/check_architecture_review.py` and its tests. Limitations: no running system exists; trust-boundary claims are design claims, not penetration-tested facts.

## Provisional authorisation assumptions
The capability matrix (#6) is **PROPOSED — AWAITING STAKEHOLDER APPROVAL**, so this review uses it only as a soft input. Assumptions used here, to be revalidated after approval: (1) administrator has no implicit raw-research read; (2) lead/reviewer may or may not be distinct roles; architecture does not depend on the answer; (3) all private routes authorise on role, study and record ownership server-side; (4) public routes use a separate database role limited to published projection tables. Nothing in this review activates production grants.

## Boundary review

| Boundary | Evidence | Finding |
|---|---|---|
| Context (who touches what) | `system-context.md` flowchart: visitor→read-only public API and, separately, third-party tile/embed providers; researcher/lead→private API | Consistent by design. No first-party public route reaches restricted storage; tile/embed providers can observe visitor requests (see third parties). |
| Components | `component-diagram.md`: validation → transaction → private schema → review → publication → public snapshot | Consistent by design; unbuilt. Finding F1 below. |
| Deployment | `deployment.md`: separate DB pools/credentials, separate cookie scope/CORS, synthetic-only staging, production collection disabled until gates pass | **Residual risk (F4):** one API process serves public and private routes; separation rests on database grants (#22/#36), not process isolation, and is unverified until those tests exist. Finding F2 below. |
| Trust: device | Protected draft vault, unlock expiry (`privacy-security.md`) | Conditional on #54 feasibility (ADR 004). |
| Trust: identity | OIDC through backend, opaque server sessions (ADR 006); IdP never authorises publication alone | Design intent; implementation is #32. |
| Trust: database | Restricted private schema vs explicit published tables (ADR 002) | Design intent; grants and negative tests are #22/#36/#110. |
| Trust: object storage | Private originals vs separately derived public media (`media-pipeline.md`) | Design intent (incl. short-lived signed private review URLs); quarantine is #60. |
| Trust: third parties | Tile/viewer providers can observe visitor requests; `system-context.md` gates only third-party *embeds* on user action, while map tiles load on every visit | Provider undecided; tile exposure must be in the privacy notice (F5). |
| Trust: worker | `overview.md`/`deployment.md`: the same-codebase worker holds restricted processing grants and writes the public projection and media, so it spans both zones | Highest-privilege component; own grant review in #22/#36 (F6). |
| Edge: CDN and proxy | `deployment.md`: approved media CDN and reverse proxy; withdrawal invalidation depends on the CDN | Invalidation path untested; #103/#110. |
| Edge: backups and logs | `privacy-security.md`: encrypted backups, no payload/GPS in logs, tombstone replay on restore | Design intent; restore drill is #116. |
| Edge: offline revocation | `offline-sync.md`: server cannot instantly revoke an offline device; post-revocation data is quarantined on reconnect | Accepted residual risk, documented. |
| Edge: exports and withdrawals | `api-design.md`: private `POST /withdrawals` and `POST /exports` | Private routes outside C01–C06; grants and purpose checks in #104/#109/#110. |

## Interface ownership (producer / consumer / contract)

| Interface | Producer | Consumer | Contract |
|---|---|---|---|
| C01 Location API | A | B | `docs/project/developer-handoffs.md#c01-location-api` |
| C02 Map/GeoJSON | A | B | `docs/project/developer-handoffs.md#c02-map-data` |
| C03 Public insights | A | B | `docs/project/developer-handoffs.md#c03-public-insights-and-read-only-reporting` |
| C04 History/content | B | A | `docs/project/developer-handoffs.md#c04-historical-content` |
| C05 Public media | A | B | `docs/project/developer-handoffs.md#c05-media` |
| C06 Private field interfaces (incl. withdrawals/exports in `api-design.md`) | A | A | `docs/project/developer-handoffs.md` (C06 row; no public route) |

## Optional-provider register (nothing silently promised)

| Capability | Status | Source |
|---|---|---|
| Third-party panorama / Google Street View | Optional, disabled until written approval and cost/terms review; owned Pannellum panoramas are the baseline | ADR 005, `media-pipeline.md` |
| Paid imagery / Google services | Optional, default disabled | `deployment.md` |
| Licensed map tile provider | Required decision, provider not chosen, no account purchased | ADR 003 |
| ODK/Kobo offline fallback | Conditional, only if the PWA feasibility gate (#54) fails | ADR 004 |
| Marzipano tours | Alternative only, not promised | ADR 005 |
| Redis, Kafka, microservices | Not used initially | `overview.md` |
| Satellite/terrain/building layers, Mapillary | Optional, not promised in MVP; need provider permission, coverage and budget | `gis-design.md`, `media-pipeline.md` |
| Managed hosting, OIDC provider, CDN, malware scanner | Needed third-party services, but no provider chosen and no account purchased; cost/terms review precedes selection | `deployment.md`, ADR 006 |

The checker fails if any of these providers appears in the architecture documents without an optional/disabled/alternative qualifier on the same line, or if this register omits one.

## Findings
Independent pass: a separate read-only reviewer agent (not the author, and not a human) cross-checked this document against the sources; its valid objections (overstated "Sound" verdicts, missing worker/CDN/backup/export boundaries, incomplete provider register, free-text and capture-date channels) produced F4–F7 and the softened verdicts above.

- **F1 (component diagram vs ADR 004):** the diagram draws the protected IndexedDB vault as fact, while `offline-sync.md` and ADR 004 already call it proposed/conditional (diagram-only gap). Resolution: the vault is a *provisional* component until #54 passes; recorded here and in `docs/product/requirements.md`.
- **F2 (deployment):** worker access to the identity provider is not drawn. Acceptable: workers use service credentials, not user sessions; recorded here as an assumption.
- **F4 (shared API process):** public and private routes share one process with separate DB pools; mitigated only by grants and tested by #110. Residual risk accepted for now; revisit if the threat model changes.
- **F5 (tile exposure):** tile requests expose visitor IP/viewport to the provider on every visit; the privacy notice and provider terms must say so before launch.
- **F6 (worker privilege):** the worker spans restricted and public zones; its grants need separate review and it must write only allowlisted projection rows.
- **F7 (public free text and dates):** published quotes/stories and media capture dates are re-identification channels; redaction rules and date-precision limits remain open for #71/#92/#102 and are not solved by the current contracts.
- **F3 (handoff):** C06 has no external consumer; confirmed no public route may expose it (enforced later by #110).

## H0 contract freeze (A → B)
Contract version `1.0.0`. Frozen synthetic fixtures: `docs/project/contracts/fixture-bundle.json`.
fixture-bundle sha256: `51971fa62170037581255246c88ca6edf53df43c77ec146775bbe60f503f7d28`
Change rule: any fixture or DTO change must update this hash and the contract version in the same PR, stay backward compatible where practical, and be called out for B. B can build public screens from these fixtures with no private database, identity provider or production credential.

## Remaining human review
A named independent reviewer (not assigned yet; see `docs/project/governance.md`) should confirm F1–F3, the assumptions above and the boundary table before real-data work. #11 still gates real participants.
