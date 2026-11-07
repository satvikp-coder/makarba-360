# Risk and decision register

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

| Risk/assumption | Impact | Mitigation / unresolved owner gate |
|---|---|---|
| Institutional ethics/legal status unverified | Real fieldwork cannot start | 00.11; authorised institutional lead must decide, no invented approval |
| Study extent/candidate facts uncertain | Misleading map | Verify source/field evidence, version boundary, omit unverified features |
| Browser eviction/key loss/XSS | Lost or exposed drafts | Device/vault/expiry/recovery gate; ODK/Kobo fallback; no guaranteed PWA durability |
| Offline account revocation delay | Unauthorized device collection | Short approved offline window, device control, quarantine on reconnect |
| Convenience sample/uneven coverage | Overstated conclusions | Sampling log, denominators, caveats, no population claim |
| Small groups and filter differencing | Re-identification | Approved cohorts, complementary suppression and institutional review |
| Historical/imagery rights unavailable | Incomplete comparison/360 | Prefer own permitted media, explicit unavailable states |
| Provider price/terms change | Budget/availability failure | No activation now; dated quotes, quota/billing caps and fallback |
| Student project operational capacity | Unpatched/lost service | Modular monolith, supported packages, actual maintainers and restore drill |
| Public invalidation race | Revoked content reappears | Revision checks, lineage, tombstones, atomic publish and cache purge |
| GitHub Projects token lacks scopes | Optional board unavailable | Verified API denial, milestones/labels/catalogue still authoritative |
| Source licence/team contacts unconfirmed | Handover/public source blocked | Owner confirms real contacts/licence before redistribution |

All owners are role requirements, not assigned fictitious people. Open questions belong in their issue and gate; no committed dates. Automatic readiness labels must be refreshed when dependencies close; initial blocked labels reflect the current unimplemented backlog.
