# Complete screen inventory

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Every screen is future implementation scope. Authenticated field/admin routes have independent guards; public routes never expose interview entry. Shared states: loading skeleton/status, empty explanation, actionable retry error, offline/stale warning, keyboard focus restoration and reduced motion.

| ID | Screen | Main content/actions | Required failure/accessibility state |
|---|---|---|---|
| P01 | Home | Hero with dated permitted photo, project purpose, featured places, Explore CTA | Photo unavailable → atlas illustration/typography; no fabricated imagery |
| P02 | Explore desktop | Left 256px search/layers; central map; right 360px expandable place details | Tile/WebGL error → searchable list; preserve attribution |
| P03 | Explore mobile | Full-screen map; floating search/layers; bottom sheet peek/half/full | Keyboard accessible expand/collapse buttons; list alternative |
| P04 | Search and layers | Name/alias search, category chips, streets/water/heritage/community/evidence toggles | No result with clear filters action; loading and stale snapshot label |
| P05 | Place profile | Name/category, source status, dates, gallery, condition observation, timeline, survey summary | Unpublished → safe 404; empty media/insights explicit |
| P06 | Then & Now | Date/source labels, matched slider and side-by-side toggle, change narrative | Unverified pair hidden; slider keyboard arrows and image descriptions |
| P07 | Panorama | Click-to-load viewer, capture date, credit, direction, static fallback | No coverage → dated photograph; no automatic third-party tracking |
| P08 | Community Voices | Approved quotations/themes, account/fact distinction, consent-compatible attribution | Withdrawn story disappears; never raw transcript by default |
| P09 | Urban Insights | Counts, issue/rating/change charts, safe cohort filters, period/method, accessible tables | Suppressed cell explanation; no-data ≠ zero |
| P10 | Guided location story | Ordered approved place stops, next/previous, evidence cards, map route if verified | Skip unavailable stop; rich tours deferred M12 |
| P11 | Research methodology | Questions, consent process, sampling, valid denominators, limitations | No invented team or response counts |
| P12 | Sources and credits | Citations, image licences, map attribution, last reviewed dates | Broken source flagged with retained citation |
| P13 | Accessibility and language | Keyboard/list help, English/Gujarati controls, Hindi availability | Missing translation clearly falls back; no mixed unlabeled script |
| F01 | Secure sign-in | Team identity, session errors, offline prerequisites | No public registration; expired session → reauth |
| F02 | Researcher dashboard | Assigned study, visit start/resume, queued count, last durable save | Offline readiness unavailable → clear blocker |
| F03 | Field visit | Start/end, assigned places, equipment checklist, progress | Cannot end with unexplained unsynced records |
| F04 | Consent | Plain script, language/version, voluntary decision, scope choices | No consent → stop, discard content/GPS |
| F05 | Participant metadata | Stakeholder, association duration, claimed official role | Official claim unverified pending evidence/lead |
| F06 | Interview position | Capture/recapture, age/accuracy, permission, map preview, manual reason | Denied/unavailable explicit; no subject-coordinate fallback |
| F07 | Subject selection | Search map/list point/road/area; add separate topic groups | Different interview spot highlighted; candidate enters review |
| F08 | Questionnaire | One topic block, short steps, required/unsure/refused choices, progress | Branch removes inactive answers from active validation, retains revision audit |
| F09 | Permitted media | Capture/select, scope consent, date/direction/credit, progress | Denied permission or partial upload keeps interview draft |
| F10 | Review and save | Interview spot vs subject labels, consent, answers, local-save and sync status | Validation links to exact field; no success before durable write |
| F11 | Offline drafts and queue | Saved/sending/rejected/conflict counts, explicit retry, recovery help | Quota/lock/expired session states preserve encrypted work |
| F12 | My submissions | Own records by visit/status, review comments, correction request | Submitted edit creates new revision; no self-approval |
| F13 | Candidate place | Name, proposed category/geometry, source and notes | Unverified/private until lead approves |
| A01 | Admin/research overview | Study-scoped review counts, queue age, publication warnings | Technical admin without data grant sees operational totals only |
| A02 | Accounts and roles | Invitation, deactivate, grants, expiry, training | Privilege escalation requires separate authority/audit |
| A03 | Visits and progress | Assignments, study coverage, target progress estimates | No targets presented as findings |
| A04 | Survey moderation | Consent/answer/version checks, duplicate candidates, change requests | Rejected records excluded from public aggregates |
| A05 | GPS review | Private accuracy/outlier map, raw/effective provenance, correction reason | Boundary overlap/poor estimate flagged, never auto-snapped |
| A06 | Location review | Candidate geometry/source comparison, name/category/access verification | No publish before boundary/source checks |
| A07 | History and media review | Source/date/rights, viewpoint, redaction and approval | Missing permission/date blocks relevant derivative |
| A08 | Publication preview | Exact public payload, cohort suppression, independent approval, revoke | Stale consent/input revision prevents release |
| A09 | Exports | Purpose, approved fields/cohort, expiring download, audit | No default exact GPS/raw identifiers in CSV/GeoJSON |
| A10 | Audit and withdrawals | Revision history, receipt lookup, revoke/purge status | Do not show payload in operational audit logs |
| A11 | Questionnaire versions | Draft/branch validation, preview, publish/retire, compatibility | Published form immutable; no silent answer migration |
| A12 | Operations and backups | Job retry/dead letter, backups/restore evidence, retention schedule | Restore needs restricted authorization and tombstone replay |
| F14 | Structured site observation | Visit/place, dated condition rubric, observer, evidence photos and review state | No participant respondent or consent record invented for a site audit; evidence labels stay distinct |
