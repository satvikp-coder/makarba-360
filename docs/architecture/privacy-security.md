# Privacy, ethics and threat model

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Real participant collection is blocked until institutional research approval and applicable-law review are recorded by the authorised institutional owner. This is a verification task, not a claim of legal compliance. Check India's applicable DPDP framework, commencement, institutional policies, participant ages, hosting/transfers and notice/withdrawal obligations using current official sources with institutional counsel. No child-participant workflow until specifically approved. No ordinary respondent names, phones or addresses are required.

Consent is voluntary and versioned: research recording/aggregate analysis, quotation, identifiable attribution, photo, audio/video and publication are distinct scopes. Refusal stops responses and GPS; retain only nonidentifying refusal tally if approved. Withdrawal uses an optional participant-held random receipt, not public search by name; lead verifies request privately. Partial withdrawal revokes only relevant scopes and invalidates derived publication.

| Threat | Control | Verification |
|---|---|---|
| Anonymous raw-data query | Public DB role has no private grants; allowlisted DTO | Negative API/DB tests |
| Cross-researcher IDOR | Ownership and assigned study checks on every operation | Substitute valid other-owner IDs |
| Role escalation/session theft | OIDC authorization-code with PKCE through backend; secure HttpOnly SameSite cookies; server sessions; MFA for lead/admin | Revoked session, wrong role, CSRF tests |
| CSRF/XSS/injection | CSRF token+origin checks for cookie writes; CSP, output escaping, prepared queries, no arbitrary HTML | Malicious fixture + cross-site requests |
| Lost offline device | Device lock/encryption, protected vault, unlock expiry, least local data | Loss/recovery drill; document residual risk |
| Dangerous upload | MIME sniffing, bounded size, quarantine scanner, decoder isolation, no active SVG/HTML | Polyglot/oversize/malware fixtures |
| Re-identification | Coarse approved cohorts, minimum n, complementary suppression, limited filters | Differencing and intersection tests |
| Public media location leak | Separate derivatives, EXIF removal, face/plate review | Decode metadata and visual review |
| Insider publishing | Independent approval, immutable audit, consent at current revision | Self-approval and stale-revision rejection |
| Backup/log leak | Encrypted backups, restricted keys; no payload/GPS in logs | Restore/access and redaction tests |

TLS everywhere; encrypted storage through selected provider with separately controlled keys; secrets in deployment vault, never Vite client env. Rate limits for login, sync, export and public queries; bounded expensive geospatial queries. Private responses `Cache-Control: no-store`, no service-worker caching. Sanitized request IDs and metrics only; no raw answer analytics SDK.

Provisional retention for approval: unsynced vault max 7 days with escalation (no automatic unacknowledged deletion); acknowledged local drafts purge within 24 hours; raw interview/GPS/consent 12 months after accepted final report, then approved purge or approved justified extension; public derivatives until licence/consent expiry; operational logs 90 days; encrypted backups rolling 35 days; minimal non-content audit 2 years. Institutional retention may override these before collection. Withdrawal removes public copies promptly, queues database/media purge, records tombstone and reapplies tombstones on restore; backups age out under approved policy. No silent deletion of unsynced work.

Incident response: contain exposure, disable affected publication/session, preserve minimal restricted evidence, assess with institutional lead, notify through verified obligations, rotate keys, restore safe snapshot and record corrective tests. No fabricated notification deadlines.
