"""Additional reviewed design and operational planning baseline."""
from build_planning import ROOT, put, doc

entities = [
('users','id UUID; oidc_subject TEXT UNIQUE; display_name TEXT; active BOOL','Identity mapping; no passwords; restricted staff data; deactivate before retention purge'),
('roles','id TEXT; capabilities JSONB','Named capability set; no implicit admin research access'),
('user_roles','user_id FK users; role_id FK roles; study_area_id FK study_areas; expires_at TIMESTAMPTZ','Composite PK; explicit scoped grant and audited revocation'),
('researcher_profiles','user_id PK/FK users; training_version TEXT; trained_at TIMESTAMPTZ','Training prerequisite, no invented team assignments'),
('study_areas','id UUID; version INT; name TEXT; geometry MultiPolygon(4326); source_id FK historical_sources; verified_by FK users; state TEXT','Versioned research extent; UNIQUE(id,version); geometry not official unless verified'),
('location_categories','id TEXT; labels JSONB; icon TEXT','Stable codes and localized labels; archived not deleted when referenced'),
('locations','id UUID; study_area_id FK; category_id FK; name JSONB; aliases JSONB; geometry Geometry(4326); evidence_id FK historical_sources; revision INT; state TEXT; last_reviewed_at TIMESTAMPTZ','Point/MultiLineString/MultiPolygon only; valid/nonempty; geometry revisions in audit; unverified candidates private'),
('field_visits','id UUID; researcher_id FK users; study_area_id FK; assigned_locations UUID[]; started_at TIMESTAMPTZ; ended_at TIMESTAMPTZ; state TEXT','Ownership enforced; operational itinerary private; assignments validated against locations'),
('survey_versions','id UUID; code TEXT UNIQUE; schema_hash TEXT; state TEXT; valid_from TIMESTAMPTZ','Immutable published form; retire stops new capture but follows explicit stale-draft policy'),
('survey_questions','id UUID; version_id FK survey_versions; code TEXT; kind TEXT; required BOOL; branch JSONB; labels JSONB; options JSONB','UNIQUE(version_id,code); branches validated acyclic; stable concept code supports comparisons'),
('respondent_categories','id TEXT; labels JSONB; archived BOOL','Resident/shopkeeper/worker/student/visitor/commuter/official/other; no identity inference'),
('interviews','id UUID; researcher_id FK users; field_visit_id FK; survey_version_id FK; respondent_category_id FK; interviewed_at TIMESTAMPTZ; device_offset INT; synced_at TIMESTAMPTZ; revision INT; state TEXT; withdrawal_token_hash TEXT','Restricted raw metadata; UUID not participant identity; consent required before accepted content'),
('interview_positions','id UUID; interview_id FK; raw_point Point(4326) NULL; effective_point Point(4326) NULL; accuracy_m NUMERIC NULL; captured_at TIMESTAMPTZ NULL; method TEXT; permission_status TEXT; quality_status TEXT; manually_corrected BOOL; correction_reason TEXT NULL; provenance JSONB; researcher_id FK users; field_visit_id FK; synced_at TIMESTAMPTZ; review_status TEXT; supersedes_id FK self','Immutable capture/correction revisions; unavailable has null point/accuracy; estimated manual point never gets fabricated GPS accuracy; exact positions restricted'),
('consent_records','id UUID; interview_id FK; script_version TEXT; scope TEXT; decision TEXT; recorded_at TIMESTAMPTZ; recorded_by FK users; supersedes_id FK self; evidence_ref TEXT NULL','Append-only scope decisions, current effective scope computed; withdrawal not overwritten; no signatures required by default'),
('survey_location_links','id UUID; interview_id FK; location_id FK; topic_group_id UUID; relation TEXT','Unique interview/place/topic group; supports multiple subjects without copying every answer to all places'),
('survey_answers','id UUID; interview_id FK; question_id FK; subject_link_id FK survey_location_links NULL; value JSONB NULL; missing_reason TEXT NULL; revision INT','Typed per question/version; absent/refused/unsure/not_applicable separate from numeric value; UNIQUE(interview,question,subject_link) using null-safe uniqueness'),
('official_verifications','id UUID; interview_id FK; claim TEXT; authority_evidence_ref TEXT; verified_by FK users NULL; verified_at TIMESTAMPTZ NULL; attribution_scope TEXT; state TEXT','Restricted evidence; official category alone cannot produce verified statement'),
('field_observations','id UUID; visit_id FK; location_id FK; observer_id FK users; rubric_version TEXT; observed_at TIMESTAMPTZ; values JSONB; evidence_type TEXT','Direct observations separate from respondent answers and measured facts'),
('issue_categories','id TEXT; labels JSONB; coding_rule TEXT; rubric_version TEXT','Stable taxonomy for multi-coded issues; human codebook review'),
('answer_issue_codes','answer_id FK survey_answers; issue_category_id FK; coder_id FK users; confidence TEXT','Composite PK; distinguishes respondent choice from analyst coding'),
('media_assets','id UUID; owner_id FK users; location_id FK NULL; interview_id FK NULL; source_id FK historical_sources NULL; private_key TEXT; derivative_key TEXT NULL; hash TEXT; mime TEXT; bytes BIGINT; captured_date TEXT; date_precision TEXT; viewpoint JSONB; credit TEXT; state TEXT; source_asset_id FK self NULL','Original restricted; derivative separately redacted; interview link never emitted publicly'),
('media_permissions','id UUID; media_id FK; consent_id FK consent_records NULL; licence TEXT NULL; scope TEXT; expires_at TIMESTAMPTZ NULL; state TEXT','Must have appropriate rights/participant permission; licence does not replace identifiable-person consent'),
('historical_sources','id UUID; citation TEXT; uri TEXT NULL; access_date DATE; source_type TEXT; date_text TEXT; date_precision TEXT; licence TEXT; verification_state TEXT; verified_by FK users NULL','Claims and sources separate; URL alone insufficient; retain rights and provenance'),
('historical_events','id UUID; location_id FK; source_id FK; date_start DATE NULL; date_end DATE NULL; precision TEXT; statement TEXT; evidence_quality TEXT; state TEXT','Unknown dates allowed privately; disputed/account labels retained publicly after review'),
('comparison_pairs','id UUID; location_id FK; before_media_id FK media_assets; after_media_id FK; matching_notes TEXT; evidence_quality TEXT; state TEXT','Dated licensed viewpoint-matched evidence required; no automatic 2021 date'),
('community_stories','id UUID; location_id FK; interview_id FK NULL; consent_id FK NULL; source_id FK NULL; text JSONB; attribution TEXT; evidence_type TEXT; state TEXT','Anonymous theme vs approved quotation vs verified fact clearly typed'),
('publication_approvals','id UUID; entity_type TEXT; entity_id UUID; revision INT; reviewer_id FK users; decision TEXT; reason TEXT; at TIMESTAMPTZ','Polymorphic reference validated transactionally; independent reviewer and current consent/evidence'),
('published_content','id UUID; kind TEXT; slug TEXT UNIQUE; payload JSONB; snapshot_id FK aggregation_snapshots NULL; approved_revision INT; published_at TIMESTAMPTZ; expires_at TIMESTAMPTZ NULL','Public schema allowlisted payload only; source private reference kept in restricted lineage table'),
('publication_lineage','publication_id FK published_content; entity_type TEXT; entity_id UUID; source_revision INT','Private composite key; enables withdrawal invalidation without exposing raw IDs'),
('aggregation_snapshots','id UUID; instrument_versions UUID[]; cohort_code TEXT; policy_version TEXT; input_revision_hash TEXT; counts JSONB; suppressed BOOL; built_at TIMESTAMPTZ; state TEXT','Worker validates valid denominators and disclosure rules; only approved payload copied to public'),
('audit_logs','id UUID; actor_id FK users NULL; action TEXT; entity_type TEXT; entity_id UUID; revision INT; reason TEXT; at TIMESTAMPTZ; request_id TEXT','Append-only restricted metadata, no answer/GPS payload; restricted revisions stored separately where required'),
('sync_operations','id UUID; actor_id FK users; interview_id FK; request_hash TEXT; base_revision INT; receipt JSONB; committed_at TIMESTAMPTZ','UNIQUE(actor_id,id); receipt and write atomic; no raw payload in logs'),
('export_jobs','id UUID; requested_by FK users; purpose TEXT; columns JSONB; policy_version TEXT; state TEXT; private_object_key TEXT NULL; expires_at TIMESTAMPTZ','Approved export allowlist, audited access, short expiry; GeoJSON contains public subjects or approved coarse coverage only'),
('background_jobs','id UUID; kind TEXT; operation_key TEXT UNIQUE; input_revision INT; attempts INT; available_at TIMESTAMPTZ; state TEXT','DB-backed bounded retry/dead-letter; idempotent workers'),
('withdrawals','id UUID; interview_id FK; scopes JSONB; verified_by FK users; requested_at TIMESTAMPTZ; state TEXT; purge_manifest JSONB','Private correction/withdrawal workflow; restore reapplies tombstones')]

doc('architecture/data-model.md','Conceptual and logical database design','''All identifiers UUID unless stable taxonomy codes; all instants TIMESTAMPTZ UTC with original capture offset retained where relevant. Restricted schema stores source material; public schema is a separately written, allowlisted projection, not SELECT * over interviews. RLS is defense in depth; scoped service authorization and separate DB roles are mandatory. All FKs indexed; GiST on geometry, B-tree(state,study_area_id), (researcher_id,interviewed_at), (interview_id,revision), questionnaire code/version and job claim indexes. GIN/trigram names only if query profiling needs it.

```mermaid
erDiagram
 users ||--o{ field_visits : collects
 study_areas ||--o{ locations : contains
 field_visits ||--o{ interviews : groups
 users ||--o{ interviews : owns
 survey_versions ||--o{ survey_questions : defines
 survey_versions ||--o{ interviews : pins
 interviews ||--o{ interview_positions : records
 interviews ||--o{ consent_records : authorizes
 interviews ||--o{ survey_location_links : discusses
 locations ||--o{ survey_location_links : subjects
 interviews ||--o{ survey_answers : answers
 survey_questions ||--o{ survey_answers : validates
 survey_location_links o|--o{ survey_answers : scopes
 interviews ||--o{ official_verifications : claims
 locations ||--o{ media_assets : illustrates
 media_assets ||--o{ media_permissions : permits
 historical_sources ||--o{ historical_events : supports
 locations ||--o{ historical_events : dates
 locations ||--o{ comparison_pairs : compares
 interviews ||--o{ community_stories : contributes
 publication_approvals ||--o{ published_content : releases
 published_content ||--o{ publication_lineage : traces
 interviews ||--o{ sync_operations : synchronizes
 interviews ||--o{ withdrawals : withdraws
```

Logical details for every entity follow in the data dictionary. ER approval edge represents release association, enforced through approval identifiers in payload/release transaction; lineage polymorphism needs transaction checks. Schema implementation must choose explicit join tables if integrity cannot be guaranteed by the module boundary.

Geometry is 2D EPSG:4326; interview points can be null only with explicit unavailable/denied state. Accuracy nonnegative when device supplied; no estimate inserted for manual pins. Preserve raw and effective coordinate separately and immutable provenance. Validate latitude/longitude ranges, capture/interview time divergence and out-of-area status without silently moving data. Study boundary changes trigger re-evaluation against a recorded boundary version.

Answers referencing a subject must belong to the same interview and questionnaire version; enforce composite FKs or transaction validation plus integration tests. Subject-level answer blocks avoid double-counting one opinion across multiple locations. An interview can have several topics, but stakeholder counts count distinct interview IDs; per-place totals can overlap and say so.

Lifecycle: draft → submitted → review → approved/changes_requested/rejected; places/media/history have candidate → reviewed → approved → published → archived/withdrawn. Published content is immutable per revision; edits invalidate and rebuild. Soft-delete referenced places (retain tombstone/name privately), reject newly linking archived places, preserve original interview semantics. Hard purge private participant material after approved retention/withdrawal review, respecting minimal noncontent audit and backup expiry; no cascade that unexpectedly removes unrelated place history.

Migrations: numbered SQL with checksum, transaction where supported, tested empty-db and upgrade paths, explicit extension provisioning and least-privilege roles; synthetic fixtures only. Expansion/compatibility before destructive contraction. Query patterns: bounded published bbox, normalized alias search, own visit interviews, lead review state/GPS quality, valid answers by subject/question/version, lineage invalidation on withdrawal, job retries. Public credentials cannot read raw tables even if API code is compromised.''')
doc('research/data-dictionary.md','Data dictionary','''Common conventions: PK=id UUID except documented code/composite keys; FK notation identifies referenced entity. NULL means explicitly optional/unknown, never an invented value. Created/updated timestamps and revision metadata on mutable aggregates; taxonomy records archive instead of deleting referenced codes. Every sensitive table inherits study/owner authorization through its parent interview/visit. Detailed retention policy is in privacy-security.md; public content retains only consent/licence-compatible derivatives.

| Entity | Keys, fields and types | Meaning, restrictions and lifecycle |
|---|---|---|
'''+ '\n'.join('| '+n+' | '+f+' | '+d+' |' for n,f,d in entities)+'''

Retention classes: users/profiles retain while active then institution-approved minimal attribution; interviews/positions/answers/consent/official evidence/linked raw media use approved research retention; published content and derivatives expire with permission/licence; audit/sync receipts use minimal operational retention; jobs/exports expire after delivery and audit. Exact respondent coordinates are never in public tables, file names, public logs or GeoJSON exports. Generic publication references require allowlisted entity types and referential validation; they do not permit arbitrary data serialization.''')

screens = [
('P01','Home','Hero with dated permitted photo, project purpose, featured places, Explore CTA','Photo unavailable → atlas illustration/typography; no fabricated imagery'),
('P02','Explore desktop','Left 256px search/layers; central map; right 360px expandable place details','Tile/WebGL error → searchable list; preserve attribution'),
('P03','Explore mobile','Full-screen map; floating search/layers; bottom sheet peek/half/full','Keyboard accessible expand/collapse buttons; list alternative'),
('P04','Search and layers','Name/alias search, category chips, streets/water/heritage/community/evidence toggles','No result with clear filters action; loading and stale snapshot label'),
('P05','Place profile','Name/category, source status, dates, gallery, condition observation, timeline, survey summary','Unpublished → safe 404; empty media/insights explicit'),
('P06','Then & Now','Date/source labels, matched slider and side-by-side toggle, change narrative','Unverified pair hidden; slider keyboard arrows and image descriptions'),
('P07','Panorama','Click-to-load viewer, capture date, credit, direction, static fallback','No coverage → dated photograph; no automatic third-party tracking'),
('P08','Community Voices','Approved quotations/themes, account/fact distinction, consent-compatible attribution','Withdrawn story disappears; never raw transcript by default'),
('P09','Urban Insights','Counts, issue/rating/change charts, safe cohort filters, period/method, accessible tables','Suppressed cell explanation; no-data ≠ zero'),
('P10','Guided location story','Ordered approved place stops, next/previous, evidence cards, map route if verified','Skip unavailable stop; rich tours deferred M12'),
('P11','Research methodology','Questions, consent process, sampling, valid denominators, limitations','No invented team or response counts'),
('P12','Sources and credits','Citations, image licences, map attribution, last reviewed dates','Broken source flagged with retained citation'),
('P13','Accessibility and language','Keyboard/list help, English/Gujarati controls, Hindi availability','Missing translation clearly falls back; no mixed unlabeled script'),
('F01','Secure sign-in','Team identity, session errors, offline prerequisites','No public registration; expired session → reauth'),
('F02','Researcher dashboard','Assigned study, visit start/resume, queued count, last durable save','Offline readiness unavailable → clear blocker'),
('F03','Field visit','Start/end, assigned places, equipment checklist, progress','Cannot end with unexplained unsynced records'),
('F04','Consent','Plain script, language/version, voluntary decision, scope choices','No consent → stop, discard content/GPS'),
('F05','Participant metadata','Stakeholder, association duration, claimed official role','Official claim unverified pending evidence/lead'),
('F06','Interview position','Capture/recapture, age/accuracy, permission, map preview, manual reason','Denied/unavailable explicit; no subject-coordinate fallback'),
('F07','Subject selection','Search map/list point/road/area; add separate topic groups','Different interview spot highlighted; candidate enters review'),
('F08','Questionnaire','One topic block, short steps, required/unsure/refused choices, progress','Branch removes inactive answers from active validation, retains revision audit'),
('F09','Permitted media','Capture/select, scope consent, date/direction/credit, progress','Denied permission or partial upload keeps interview draft'),
('F10','Review and save','Interview spot vs subject labels, consent, answers, local-save and sync status','Validation links to exact field; no success before durable write'),
('F11','Offline drafts and queue','Saved/sending/rejected/conflict counts, explicit retry, recovery help','Quota/lock/expired session states preserve encrypted work'),
('F12','My submissions','Own records by visit/status, review comments, correction request','Submitted edit creates new revision; no self-approval'),
('F13','Candidate place','Name, proposed category/geometry, source and notes','Unverified/private until lead approves'),
('A01','Admin/research overview','Study-scoped review counts, queue age, publication warnings','Technical admin without data grant sees operational totals only'),
('A02','Accounts and roles','Invitation, deactivate, grants, expiry, training','Privilege escalation requires separate authority/audit'),
('A03','Visits and progress','Assignments, study coverage, target progress estimates','No targets presented as findings'),
('A04','Survey moderation','Consent/answer/version checks, duplicate candidates, change requests','Rejected records excluded from public aggregates'),
('A05','GPS review','Private accuracy/outlier map, raw/effective provenance, correction reason','Boundary overlap/poor estimate flagged, never auto-snapped'),
('A06','Location review','Candidate geometry/source comparison, name/category/access verification','No publish before boundary/source checks'),
('A07','History and media review','Source/date/rights, viewpoint, redaction and approval','Missing permission/date blocks relevant derivative'),
('A08','Publication preview','Exact public payload, cohort suppression, independent approval, revoke','Stale consent/input revision prevents release'),
('A09','Exports','Purpose, approved fields/cohort, expiring download, audit','No default exact GPS/raw identifiers in CSV/GeoJSON'),
('A10','Audit and withdrawals','Revision history, receipt lookup, revoke/purge status','Do not show payload in operational audit logs'),
('A11','Questionnaire versions','Draft/branch validation, preview, publish/retire, compatibility','Published form immutable; no silent answer migration'),
('A12','Operations and backups','Job retry/dead letter, backups/restore evidence, retention schedule','Restore needs restricted authorization and tombstone replay')]
doc('product/screen-inventory.md','Complete screen inventory','''Every screen is future implementation scope. Authenticated field/admin routes have independent guards; public routes never expose interview entry. Shared states: loading skeleton/status, empty explanation, actionable retry error, offline/stale warning, keyboard focus restoration and reduced motion.

| ID | Screen | Main content/actions | Required failure/accessibility state |
|---|---|---|---|
'''+ '\n'.join('| '+' | '.join(s)+' |' for s in screens))
doc('design/design-system.md','Visual design system','''Identity: a warm digital urban atlas combining geography, archival evidence and restrained photography. Avoid generic admin ornament and fabricated map art. Typography: locally hosted licensed Noto Sans for English plus Noto Sans Gujarati/Devanagari, with Noto Serif headings only if script coverage tested. Body 16px/1.5; captions 14px; headings fluid 28–48px. Dates/numbers align with tabular numerals. Spacing scale 4/8/12/16/24/32/48/64px, 8px panel radius, subtle single shadow, maximum prose width 70ch.

Tokens: background ivory #F6F2E9; primary text/deep teal #163D3B; accent terracotta #D27A55; sandstone #E6BC6C; lake #4C91A3. Use teal text on light accent fills; do not use light accent text on ivory for body copy. Contrast calculations below are generated using WCAG sRGB luminance; normal text ≥4.5:1, large text ≥3:1, focus/UI boundary ≥3:1. Dark focus outline with offset on light surfaces; light outline on teal. Marker icon+shape+label distinguishes category without color alone.

Breakpoints: <768 mobile, 768–1199 compact, ≥1200 desktop. Desktop header 64px, layers 256px, details 360px; map flexes. Compact uses collapsible drawers. Mobile header 56px, safe-area padding, 44px preferred touch targets, sheet peek 112px / half 50vh / full under header; drag gesture has equivalent buttons. No essential action depends on hover or dragging.

Controls: visible labels, input help and inline errors plus summary, real disabled reasons, save/sync statuses as text. Photo grids keep stable aspect ratio and date/credit; alt text describes evidence, never assumes historical cause. Charts use patterns/tooltips plus data tables. 160–220ms panel transitions, no compulsory map fly-through; reduced motion disables nonessential movement. Error red and success green are additional verified tokens to choose with AA contrast during design issue review; no status relies on color alone.''')
def lum(h):
    vals=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    return sum(w*(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v,w in zip(vals,[.2126,.7152,.0722]))
palette={'teal':'#163D3B','ivory':'#F6F2E9','terracotta':'#D27A55','sandstone':'#E6BC6C','lake':'#4C91A3'}
rows=[]
for a,b in [('teal','ivory'),('teal','terracotta'),('teal','sandstone'),('teal','lake'),('terracotta','ivory'),('lake','ivory')]:
    x,y=sorted([lum(palette[a]),lum(palette[b])]); r=(y+.05)/(x+.05); rows.append(f'| {a} / {b} | {r:.2f}:1 | {"Pass" if r>=4.5 else "Fail: decorative/large only if ≥3"} |')
doc('design/contrast-audit.md','Initial palette contrast audit','| Pair | Calculated contrast | Normal text AA |\n|---|---|---|\n'+'\n'.join(rows)+'\n\nCalculated locally from sRGB tokens. Test actual focus, controls, overlay opacity and photography backgrounds during implementation; token contrast alone is not a full accessibility audit.')
doc('design/public-website.md','Public UX and wireframes','''Implement screens P01–P13 in the inventory. Main navigation: Explore, Then & Now, Community Voices, Urban Insights, Research. Search/layers use URL state with privacy-safe filters; no raw interview parameter. Place selection announces name and moves focus only on explicit details action; closing returns focus to marker/list item.

```text
DESKTOP ≥1200
+-----------------------------------------------------------+
| MAKARBA 360 | Explore | Then & Now | Insights | Research    |
+-------------+---------------------------+-----------------+
| Search      |                           | Name / category |
| Layers      |       INTERACTIVE MAP     | Photos / dates  |
| Categories  |       selected feature    | Evidence tabs   |
| List toggle |                           | Safe findings   |
+-------------+--attribution / zoom-------+-----------------+
MOBILE
+---------------------------+
| Search        Layers      |
|           MAP       + / - |
|                           |
| attribution               |
| [Place name   Expand]     |
| [sheet content / collapse]|
+---------------------------+
```

Home uses a permitted image and clear research purpose. Then & Now offers slider plus side-by-side and text descriptions; date/source/evidence quality visible beside each image. Panorama opens on demand with static fallback and source date. Voices labels quotation, recollection, analyst theme and verified evidence separately. Insights shows valid n, excluded/missing/unsure, period and sample caveat next to chart, not only in footer. Guided story has ordered stops and accessible list; no invented route. Sources/credits and accessibility/language settings always reachable. Empty research findings explain collection status; demo fixtures are unmistakably synthetic and not mixed with production.''')
doc('design/fieldwork-app.md','Fieldwork UX and wireframes','''Implement F01–F13. One-handed large controls, short steps, readable outdoors, persistent saved/sync status. Standard interview target 5–8 minutes, measured in pilot rather than asserted. No consent defaults or leading answer defaults. English/Gujarati scripts are reviewed by fluent humans; language can switch without losing answers.

```text
[Visit name] [Offline: 2 saved] [Lock]
Step 1 Consent → 2 Participant → 3 Interview GPS
→ 4 Subject place → 5 Questions → 6 Media → 7 Review

INTERVIEW GPS                 SUBJECT PLACE
[Capture] [Recapture]         [Search verified places]
Estimate: 35m / Check         Discussing: <selected place>
Captured: <time>              [Add topic for another place]
[Private map preview]         Not automatically this GPS spot
[Manual pin + reason]

Review: consent scopes | private interview spot | subject topics
[Save draft locally] [Submit when online]
Saved at <time> / Not synced / receipt after upload
```

Consent refusal ends without GPS/answers. Manual pin has explicit estimated label and reason, retains original fix; GPS denied is not a blocked whole form when approved unavailable fallback exists. Separate topics ask which answers apply where; do not duplicate responses to every linked place. Candidate places remain private pending review. Draft recovery prompts unlock and shows last durable save. Partial media upload never destroys interview; sync status differentiates record receipt from attachment completion. Correction UI compares old/new values, requires reason and creates a revision, not a hidden overwrite.''')
doc('design/admin-dashboard.md','Research management UX','''Implement A01–A12, distinguishing researcher lead and technical administrator capabilities. Desktop table filters: study, visit, collector, form version, consent, record state, quality. Mobile presents review cards and detail steps, not squeezed full-width tables. Bulk actions require preview, scope count and per-record eligibility; no bulk public approval without consent/evidence checks.

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

GPS review is private and shows capture vs manual correction provenance; poor accuracy and out-of-area points are flags requiring contextual assessment. Official attribution requires verification evidence and scope. Exports require stated purpose, column allowlist, expiry and download audit. Withdrawal view traces all affected publications/media/snapshots, displays invalidation status and purge/backups deadlines. Questionnaire editor validates branching and preview before immutable version publication.''')
doc('design/accessibility.md','Accessibility and localization','''Target WCAG 2.2 AA with manual review. Keyboard users can search/filter/select via equivalent list; map canvas is never the only path. Escape closes overlays, focus is trapped only in true modals and restored; skip links and landmarks; status announcements use polite live region without GPS spam. Controls have 44px preferred targets, 24px WCAG minimum exceptions assessed explicitly; contrast 4.5 text/3 UI and visible focus. 200% zoom and 320px reflow without lost form controls. Tables/captions accompany charts; transcripts/captions accompany audio/video. Slider has arrow keys and non-drag alternative. Reduced motion removes fly-to/automatic panorama rotation. Screen reader tests on NVDA/Chrome and VoiceOver/Safari are manual release gates.

Localization baseline: externalized keys/plural/date/number formatting, `lang` attributes, English and reviewed Gujarati core navigation/consent/form content. Hindi expansion is M12; do not advertise untranslated screens. Keep raw respondent language, transcription and translation separately with reviewer/provenance. Missing translations show labeled English fallback; no machine-only legal/consent translation. Names have multilingual aliases; search does not transliterate source evidence destructively.''')

doc('research/methodology.md','Research methodology','''Mixed-method, purposive/convenience field sample plus place observation and historical-source research. Questions and evidence types follow vision.md. Recruit across verified routes, stakeholder roles and collection periods; document refusals only as nonidentifying approved tallies, missed groups and recruitment context. Ratings describe collected respondents, not Makarba population estimates. Do not infer causality from remembered change or quantify traffic growth without measurement.

Keep four evidence classes: initial researcher observation (date/rubric/observer), respondent account (instrument/topic/consent), historical claim (citation/date/quality), verified fact (reviewer/supporting evidence). Official claims need role/attribution verification independently of category. Conflicting accounts remain labeled with source/context rather than silently resolved as truth.

Ethics, study boundary, recruitment/age policy, languages, device protection and consent script must be approved before real participants. Research plan changes receive version and rationale; convenience-sample uncertainty cannot be repaired by decorative confidence intervals.''')
doc('research/survey-questionnaire.md','Versioned survey instrument v1 draft','''Status: draft for institutional and bilingual pilot review; not approved for collection. Version every published wording/branch/option change, pin interview to version/hash, preserve original answers and separately map comparable concepts. Basic duration target 5–8 minutes.

| Code | Prompt / field | Type/options and branch |
|---|---|---|
| META | Interview UUID, collector, visit, time/offset, instrument | Automatic, editable time correction audited |
| C01 | Project explained and voluntary consent? | Yes/no required; no stops capture, no answers/GPS retained |
| C02 | Permission for anonymous aggregate research use? | Explicit approved scope; refusal follows approved termination policy |
| R01 | Stakeholder role | Resident/shopkeeper/worker/student/commuter/visitor/official/other; unsure/refused |
| R02 | Association with area | <1y / 1–5y / >5y / unsure / refused |
| R03 | Official role claim? | Only if official; claim recorded privately, verification pending lead |
| G01 | Interview position | Device fix/accuracy/time/permission or explicit manual/unavailable reason |
| S01 | Which place is discussed? | Existing point/line/polygon or private candidate; one topic group per place |
| S02 | Same spot or another location? | Researcher confirmation; never derives one coordinate from the other |
| S03 | Most recent visit | Today/this week/this month/longer/unsure/refused |
| S04 | Visit frequency | Daily/weekly/monthly/less often/first visit/unsure/refused |
| Q01 | What is good about this place? | Multi-select heritage/environment/activity/access/social/other/none + optional own words |
| Q02 | Current condition | Integer 1 very poor → 5 very good / unsure / refused |
| Q03 | Biggest issue | Traffic/walking/sanitation/water/safety/maintenance/public space/none/other/unsure/refused |
| Q04 | Perceived change over five years | Better/worse/same/do not know/not enough association/refused; optional example |
| Q05 | First desired improvement | Optional text; preserve words; later analyst coding is separate |
| Q06 | Additional comments | Optional text; not automatically published |
| Q07 | Optional quotation | Text plus distinct quotation and attribution consent; translation review |
| C03 | Photo/audio/video recording and publication | Separate opt-in scopes per medium and identifiable use; no preselected permission |
| END | Review and save | Consent, interview spot, subject topics, missingness and save/sync status |

Q01–Q07 repeat only for explicitly discussed topic groups, not automatically for every linked place. Missing reasons: not_asked (branch), skipped, refused, unsure, not_applicable; unsure is not numeric 0. Required fields can support explicit refusal when ethically necessary; consent is never bypassed. Long interviews use a separate optional protocol and recording scope, not unbounded mandatory text fields.''')
doc('research/consent-protocol.md','Consent and withdrawal protocol','''Draft script for institutional and fluent-language review: “We are conducting an academic study of places and experiences in Makarba. Participation is voluntary. You may skip a question or stop. We record answers and the interview location privately; approved results may be published as grouped findings. We do not need your name, phone or home address. Photos, recordings, quotations and attribution need separate permission. You may ask about correction or withdrawal through the approved project contact/process.”

Do not invent a contact: institutional lead must provide approved contact/information sheet and participant-held random receipt process before collection. Explain purpose, access, retention, risks, publication scopes and withdrawal limits in chosen language. Record script version, scope/decision/time/collector. No consent → no survey or GPS/media collection. Only approved nonidentifying refusal tally if allowed.

Identifiable quotation/name/photo/voice permissions are separate from anonymous aggregate use. Officials require verified role and authority to attribute a statement. Do not approach minors without approved procedure. No coercion, leading promises or claims the platform is an official grievance resolution service. Participant may stop without explanation; researcher saves only permitted partial data. Withdrawal verifies receipt privately, immediately unpublishes affected derivatives, recomputes safe aggregates and follows approved raw-data/backup retention. Never collect extra identity merely to make withdrawal easier.''')
doc('research/sampling-plan.md','Sampling and targets','''Planning targets only: 20–30 verified places; 80–120 documented photos; 5–10 panoramas; 80–120 short surveys; 12–20 longer interviews; 8–12 dated comparisons; 4–6 road corridors. Counts are not measured findings or a reason to fabricate evidence. Replace impossible comparisons with transparent unavailable evidence.

Suggested first pass (not dates): heritage/older streets, then lake/community spaces, then roads/shops/services/transport. Confirm safe routes/access and study-boundary coverage first. Vary weekday/time periods and stakeholder mix. Track recruitment context, eligible categories reached and gaps; avoid duplicate interviewing without storing personal identifiers. Ask whether already interviewed, flag possible repeats for review without automatic deletion. Do not invent random sampling probabilities or statistical population claims. Longer interviews can be a consented subset of short interviews, counted separately with overlap explained. Research lead sets realistic route assignments only after map verification and team availability.''')
doc('research/gps-protocol.md','GPS field protocol','''1. Explain consent before location capture. Capture only while at the actual interview spot, not at end of day.
2. HTTPS mobile browser permission prompt; explain deny/error/timeout. Request fresh high-accuracy fix, retain acquisition timestamp, reported metres, permission and device method; test actual timeout/maxAge in pilot.
3. Show pin, age and accuracy: ≤20m good estimate; >20–50m check; >50m low quality/recapture. Thresholds are project choices, not guaranteed truth.
4. Check surroundings safely; recapture outdoors if possible. Do not move participant into traffic for GPS.
5. If unavailable/denied, record cause and null coordinate or explicitly estimated manual point if approved. Never use subject centroid as interview point or invent accuracy.
6. Manual adjustment preserves original fix, effective point, reason, actor/time and provenance. Reviewer sees both. Flag outside current verified boundary using inclusive intersection/coverage and uncertainty context.
7. Select discussed place separately; multiple places use per-topic observations. Review interview time, capture time and subject association.
8. Save locally and verify durable confirmation. Sync timestamp is separate from capture/interview time. Review poor/old/out-of-area fixes; do not silently auto-correct. Exact points remain private; any public coverage uses approved coarse aggregation.''')
doc('research/field-visit-sop.md','Field visit SOP and media checklist','''Before departure:

- [ ] Confirm institutional permission, approved script/languages, age policy and safe access.
- [ ] Verify study boundary, candidate routes/places, field assignments and check-in plan.
- [ ] Charge phones/power bank/camera; test GPS permission, offline unlock, sample save/recovery and upload.
- [ ] Cache only licensed reference maps, immutable forms and required verified places; check storage quota.
- [ ] Confirm participant information/receipt process and no public survey entry.

At each place:

- [ ] Confirm name, category, geometry and safe access; candidate changes are review-only.
- [ ] Capture dated photos from permitted viewpoints; record direction, credit, licence and location ID.
- [ ] Avoid identifiable bystanders; permission/redaction review for faces, plates, voices and private premises.
- [ ] Separate condition observations from opinions/historical claims; use consistent rubric.
- [ ] Obtain voluntary consent; capture actual interview GPS and quality, select subject separately.
- [ ] Ask neutral questions, allow refusal/unsure, attach only permitted media, review before save.
- [ ] Verify last durable save and sync state; never assume a spinner means uploaded.

Back at base:

- [ ] Reauthenticate, sync and reconcile UUID counts/receipts including attachments; inspect rejected/conflict queue.
- [ ] Review consent, missingness, timestamps, duplicates, GPS and subject links.
- [ ] Check media source/date/rights, historical citations and official attribution.
- [ ] Publish only through approval/projection; back up restricted records and plan revisits.

Panoramas: confirm camera permission, stitch quality, horizon/view direction, date, no identifiable people, suitable resolution and static fallback. Then & Now: obtain dated licensed older evidence, match viewpoint/feature, record uncertainty and observed change without inventing causal explanation.''')
doc('research/historical-evidence.md','Historical evidence and fact review','''For every claim retain citation/creator, source type, access date, original date and precision, rights, geographic relevance, reviewer and evidence quality. Preferred primary records/dated imagery; secondary sources can contextualise with explicit confidence. Resident memories are accounts, not proven chronology. Officials are attributed only after status/authority and publication scope verification.

Target around 2021 vs 2026 only if evidence exists. Check same feature/viewpoint and record direction/position privately as appropriate, source dates and mismatch limitations. Slider images need rights and reviewed dates; approximate date visible as approximate, unsupported date cannot masquerade as exact. Timelines require supporting source per event; disputed accounts can coexist with labels. Georeferenced historic maps need control points/error notes and licence. Separate measured changes from visible differences and opinions. Editorial reviewer signs the current revision; stale source/permission revokes dependent publication.''')
doc('research/quality-assurance.md','Research data quality procedure','''Daily reconciliation compares device interview UUID manifests, sync receipts and server counts; unresolved discrepancies block device clearing. Check consent scopes, questionnaire hash, timestamp anomalies, independent subject links, GPS quality/provenance and duplicate candidates. Never delete similar responses automatically. Record correction reasons with old/new revisions.

Media QA verifies checksum, date/precision, direction, place link, creator, rights, identifiable-person consent and derivative redaction. Evidence QA triangulates historical claims and distinguishes observation/account/fact. Analytics QA reruns frozen fixtures, counts distinct interviews and topic answers with explicit denominators, missing/unsure and suppression. Lead reviews discrepancies and signs release snapshot; audit logs record decision metadata without copying sensitive payloads. Targets track progress, not truth. No dataset is complete because a spreadsheet has no blanks.''')

doc('operations/local-development.md','Windows development plan','''Future implementation setup (not installed by planning run): Git, supported Node LTS/pnpm, Docker Desktop/WSL2 or native PostgreSQL with PostGIS, institution-approved local OIDC/test provider and S3 emulator. Verify virtualization/network/port constraints on Windows before choosing Docker. Use PowerShell-native paths and documented .env.example without real secrets. Pin runtime/tool versions and lockfile in foundation issue.

Proposed workflow after scaffold issue: pnpm install → start database/storage/identity development services → apply versioned migrations → load clearly synthetic non-Makarba fixtures → run API/worker and web/field/admin → relevant unit/integration/browser checks. Commands must be finalized and tested by setup issue; they are not runnable product commands today. Mobile device access needs HTTPS on a trusted local/staging origin for GPS; localhost exceptions do not make LAN HTTP secure. Never use real participant data in local dev or CI.''')
doc('operations/backups.md','Backup and disaster recovery','''Proposed RPO ≤24h restricted data, RTO ≤8h after incident authorization; verify feasibility against selected host, do not claim achieved. Daily encrypted database backups plus object versioning/manifest checks; rolling 35-day retention pending institutional policy; separate keys/access from production app. Protect consent and lineage together with source records.

Monthly and pre-release isolated restore drill: provision restricted target → restore DB/extensions/roles and object manifests → verify checksums/record counts/permissions → replay withdrawal/deletion tombstones before allowing access → test publication integrity and restricted-role denial → record actual RPO/RTO → destroy restricted test target under policy. Never restore directly into public-serving environment. Backup deletion ages out under approved policy; withdrawal manifests survive sufficiently to reapply restrictions. Key loss is tested as a documented unrecoverable failure unless approved escrow exists.''')
doc('operations/security-checklist.md','Operational security checklist','''Before collection: ethics/legal owner approval; least-privilege roles/ownership; strong identity/MFA lead/admin; no public write; secure cookies/CSRF/CSP; secrets scan; upload quarantine; protected device/offline test; retention/withdrawal script; encrypted backup/restore drill. Before public launch: negative raw-data tests, public DTO/EXIF review, cohort differencing tests, independent approval, rights/source audit, no production test data and billing limits. After launch: supported dependencies, account review, backup alerts, publication invalidation/withdrawal drills, incident contacts and handover ownership. These are release gates, not claims checks already passed.''')
doc('operations/field-deployment.md','Field pilot and handover','''Pilot only after approved method/consent, field MVP checks and device security decision. Train researchers using synthetic data, then consent-approved small pilot: GPS at A/discuss B, denied permission, poor fix, airplane mode, app suspension/restart, expiring session, partial uploads and duplicate reconnect. Reconcile saved UUIDs/receipts and capture actual timing/usability issues. Stop real collection on loss, unexpected public exposure or unreliable saves; approved fallback may resume only after mapping/consent validation.

Handover includes actual maintainers, deployment accounts ownership, secret transfer through approved vault, restore evidence, data/rights inventory, source limitations, operating costs, renewal schedule, instrument versions, known defects and an end-to-end demonstration. Source repository may become public only after owner-led privacy/security/licence review; private default remains until then.''')

print('Detailed design and operations generated')
