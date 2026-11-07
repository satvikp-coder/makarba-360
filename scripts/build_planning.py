"""Generate the reviewed planning baseline. No application implementation."""
from pathlib import Path
import json, hashlib, shutil
ROOT = Path(__file__).resolve().parents[1]
def put(path, text):
    p=ROOT/path; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text.strip()+'\n', encoding='utf-8')
def doc(path, title, body): put('docs/'+path, '# '+title+'\n\nPlanning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.\n\n'+body)

put('README.md', '''# Makarba 360°

Participatory Urban Mapping and Community Insights Platform for Makarba, Ahmedabad.

**Planning-first repository. No product features implemented.** Authorised researchers collect face-to-face interviews; public visitors only explore approved places, evidence, stories and aggregates. There is no public survey submission.

Interview position and discussed place are separate. Raw responses, exact interview GPS, consent and original media stay private. No geography or findings in this repository are verified field results.

Start with [requirements](docs/product/requirements.md), [architecture](docs/architecture/overview.md), [data model](docs/architecture/data-model.md), [UX screens](docs/product/screen-inventory.md), [roadmap](docs/project/roadmap.md), [issue index](docs/project/issue-index.md), and [setup progress](docs/project/setup-progress.json).

The supplied 23-page blueprint was read in full; see [source provenance](docs/source/README.md) and [traceability](docs/project/traceability-matrix.md). Original PDF redistribution is not assumed; its checksum and page summaries are retained.

Releases: A technical foundation; B private offline-capable fieldwork MVP; C approved public demonstration. Advanced work is optional. Institutional ethics/legal verification, a verified study boundary and offline security validation are external gates before real fieldwork.

Future layout: apps/web (public), apps/field (private PWA), apps/admin (research lead), apps/api (shared backend), packages/shared (contracts), packages/gis, packages/ui, infrastructure. These are documented architecture paths, not empty application scaffolding.

No source licence has been selected by the owner. Third-party data and media retain their own licences; repository privacy is not a data-protection substitute.
''')
put('AGENTS.md', '''# Future development sessions

Read README, the issue, linked architecture, dependency map and setup-progress before acting. This baseline is planning only. Never implement unrelated scope or treat planning documents as tested software.

1. Verify blockers are closed with completion evidence; use branch issue-<number>-<slug>.
2. Preserve researcher-only collection, independently stored interview and subject locations, private raw GPS, and allowlisted publication projection.
3. Never commit credentials, participant records, exact interview coordinates, protected media or institutional approval documents containing personal details. Use explicitly synthetic fixtures outside the real study area.
4. Read the dated ADRs; recheck maintained versions and provider terms before integration. No paid service activation without owner approval.
5. Add meaningful positive and negative tests; run relevant checks, update docs, commit, push and open a PR referencing the issue. Inspect CI, fix findings, and respect required review/branch protections. Do not bypass failed checks.
6. Merge only with session authorization and repository permissions; verify merged commit and close only with evidence. No force pushes or overwrites of unrelated work.
7. Do not invent geography, historical facts, survey findings, people, ownership assignments or approvals. No public survey forms.
8. If blocked, record durable state and exact limitation; do independent authorized work. Keep issue mappings idempotent.

Implementation report: Issue; Branch; Commit; PR; Changes; Tests (commands/results); Security review; Limitations; Verdict PASS / FIX REQUIRED / BLOCKED.

Planning automation: scripts/build_planning.py creates the baseline; do not rerun it over later edited documentation. scripts/publish_github.py resumes GitHub setup using stable catalogue IDs. scripts/verify_planning.py checks the catalogue and remote snapshot. Do not introduce real data to make a demo look complete.
''')
put('CONTRIBUTING.md', '''# Contributing

Follow AGENTS.md and docs/project/definition-of-done.md. Issues are unassigned until a real contributor accepts them. Priorities are sequencing guidance, not dates. One focused issue and independently reviewable PR at a time. Dependencies must be verified, not merely removed from the description. Branch naming: issue-<number>-<slug>; commit messages describe the outcome.

Planning changes need requirement, ADR, dependency and test impact review. Product PRs include synthetic test evidence, screenshots where useful, migration/backout notes, data exposure review and the standard implementation report. Do not bypass checks. A maintainer must deliberately configure protection once CI exists; this baseline does not claim protection is enabled.

No team email, institutional owner or code licence is invented. Discuss source licensing and appoint real maintainers before public redistribution.
''')
put('SECURITY.md', '''# Security

Never post raw interviews, consent evidence, credentials or exact interview GPS in issues. Report vulnerabilities through GitHub private vulnerability reporting if enabled; otherwise contact a repository owner through an existing private institutional channel. No contact address is supplied here because none is confirmed.

If sensitive information is exposed, restrict access, revoke affected credentials, notify the designated institutional lead through an approved channel, preserve minimal restricted evidence and follow the incident plan. Git deletion alone does not revoke secrets or remove copies. Production collection is gated by institutional ethics/legal verification and the security acceptance tests.
''')
put('.gitignore', '''node_modules/
dist/
coverage/
.env
.env.*
!.env.example
*.pem
*.key
data/
uploads/
backups/
*.sqlite*
*.log
.venv/
__pycache__/
.planning-tmp/
''')
put('.editorconfig', 'root = true\n\n[*]\ncharset = utf-8\nend_of_line = lf\ninsert_final_newline = true\nindent_style = space\nindent_size = 2\n\n[*.py]\nindent_size = 4')
pdf=ROOT.parent/'Makarba_360_Complete_Project_Blueprint.pdf'
doc('source/README.md','Source provenance',f'''Primary source: `Makarba_360_Complete_Project_Blueprint.pdf`, supplied in parent workspace. All 23 text-bearing pages read. SHA-256: `{hashlib.sha256(pdf.read_bytes()).hexdigest()}`. Date shown: November 2026. Text extraction used PyMuPDF. The full original remains outside Git; rights to redistribute it are not assumed. Diagrams are conceptual, not actual street geometry.

User master prompt supplements the blueprint and controls conflicts. In particular, p8's encrypted-draft aspiration must be validated rather than assumed for IndexedDB. The three-day first pass on p13 is a suggested collection sequence, not a committed schedule. Page 11's sample is fictional and must never become a result.

No source pages are missing. Page-level coverage is in the traceability matrix. Boundary, place access, site conditions, historical images and actual survey findings remain unverified external research dependencies.''')
doc('product/vision.md','Vision and scope','''Create an evidence-led urban atlas connecting verified public places, dated historical comparisons and field-collected community perspectives. Research questions: which places matter, what changes are remembered or evidenced, which environmental/transport/public-space concerns recur, where stakeholder accounts differ, and what improvements participants prioritise.

Core scope: verified map, place profiles, researcher interviews with consent/GPS/offline support, review, licensed media, dated history, approved aggregates and methodology. Public access is read-only. Out of scope: public crowdsourcing, precise respondent pins, population-representative claims, continuous Street View coverage, predictive official plans, payments and full-city digital twins. Guided tours have a basic screen specification now; rich tours are stretch delivery.

Success: end-to-end private capture → review → safe projection → understandable public evidence. Collection targets are estimates in the sampling plan, not software acceptance results. No minimum fabricated content quota can override evidence quality.''')
doc('product/personas.md','Personas and permission matrix','''Personas are role descriptions, not invented named people.

| Capability | Visitor | Researcher | Lead/editor | Administrator |
|---|---|---|---|---|
| Published map, stories, safe aggregates | Read | Read | Read | Read |
| Start visits/interviews | None | Own assigned visits | Own if also researcher | Only if separately assigned researcher |
| Raw records / exact interview GPS | None | Own assigned records | Assigned study review | No automatic research access |
| Correct submitted record | None | Request revision | Review revision | No automatic edit |
| Verify sources/consent and publish | None | Submit candidates | Review and approve | Infrastructure only |
| Accounts, backups, configuration | None | None | No account escalation | Manage with audit |
| Restricted export | None | None | Approved purpose and study | Operate job only if granted |

Roles are additive explicit grants, scoped to study and record ownership. Administrator is not a universal data reader. Researcher cannot approve their own public story; reviewer separation enforced for publication. Break-glass access requires reason, expiry and audit, never a silent bypass. Official respondent status is a separate verified evidence workflow, not an application role.''')
doc('product/user-journeys.md','User journeys','''Public: Home → Explore → filter/search → select place → profile → dated comparison/panorama → approved findings → methodology. Deep links restore place/filter; list view provides a map alternative. Visitors have no survey entry action or write endpoint.

Researcher: sign in online → start assigned visit → Start Interview → information/consent → participant category → capture GPS at interview spot → inspect/recapture or explicitly estimate → choose subject place(s) → answer per-place questions → optional separately permitted media → review → durable local save → queue → authenticated sync → submitted → review/correction. Declined consent ends collection without storing responses/GPS. Unavailable GPS never copies subject geometry.

Lead: queue → consent/completeness → GPS/boundary review → answer/place checks → source/media review → request changes or approve → publication preview → independent approval → release snapshot. Withdrawal immediately removes affected public derivatives, then runs restricted deletion review and scheduled purge. Administrator manages grants, jobs, backups and recovery without silently acquiring research access.''')
doc('product/acceptance-criteria.md','Product acceptance gates','''A public session cannot create interviews or retrieve raw surveys, exact interview coordinates, consent or original media. A researcher can record interview A about place B without either overwriting the other; one interview may contain distinct place-specific answer groups. Denied consent stops capture. GPS failure is explicit and does not generate coordinates. Concurrent retry creates one record and one logical audit event.

Publication requires consent-compatible scope, valid evidence, approved media, privacy-safe cohort and an approved snapshot. Withdrawal invalidates snapshots and CDN copies. Every chart shows question/version, valid n, missing/unsure accounting, period, method and sample limits. Small groups and complementary differences remain suppressed across allowed filters.

Release-specific gates, 20 critical test cases and issue-specific checklists form the executable handover contract. Planning QA validates documentation and remote configuration only; no product tests have run.''')

doc('architecture/overview.md','System architecture','''Use a TypeScript monorepo with React/Vite public, field and admin apps; Express API; PostgreSQL/PostGIS; private S3-compatible originals and separate approved public derivatives. Shared packages hold runtime validation/OpenAPI types, GIS rules and accessible UI primitives. Use Tailwind tokens and accessible primitives, ECharts with tables, Pannellum for owned panoramas. Select supported package versions and lockfiles during foundation work, not fictional version pins here.

A modular monolith keeps a student team deployable: auth, GIS, fieldwork, review, evidence, media, publication, analytics and exports are modules. A worker process from the same codebase handles media, aggregation, publication invalidation and exports via PostgreSQL-backed jobs; no Redis/Kafka/microservices initially. API schemas validate untrusted input server-side; generated client types are not validation.

Public API runs with a database role restricted to published projection tables. Private API performs scoped authorization and never serializes raw models to public routes. Worker owns restricted processing grants. Public copies contain no private IDs, exact interview times or EXIF GPS. Cookies are limited to private origins; public caching cannot cache private responses.

Flow: researcher → local protected draft → authenticated idempotent transaction → restricted relational records → lead review → aggregation/disclosure checks → immutable approved snapshot → allowlisted public API/CDN. Observations, opinions, historical claims and verified facts have distinct evidence types. See ADRs, data model, API and offline design for constraints.''')
doc('architecture/system-context.md','System context and trust boundaries','''```mermaid
flowchart LR
 V[Public visitor] --> P[Read-only public atlas]
 R[Authorised researcher] --> F[Private field PWA]
 L[Research lead] --> A[Private review dashboard]
 F --> API[Private authenticated API]
 A --> API
 API --> D[(Restricted PostGIS and originals)]
 D --> W[Review and publication worker]
 W --> S[(Approved public projection)]
 P --> Q[Read-only API]
 Q --> S
 P --> T[Licensed map tiles and optional panorama provider]
 I[Institutional ethics and source verification] -. release gates .-> W
```

External IdP authenticates team accounts; it never authorizes publication alone. Device, browser, internet, application, database, object storage and third-party viewers are separate trust boundaries. Tile/viewer providers can observe visitor network requests; third-party embeds load only after user action with privacy notice.''')
doc('architecture/component-diagram.md','Components and data flow','''```mermaid
flowchart TD
 subgraph Device
 UI[Field screens] --> Vault[Protected IndexedDB draft vault]
 Vault --> Queue[Operation queue and attachment manifests]
 end
 Queue --> Auth[Session and RBAC middleware]
 Auth --> Validate[Runtime validation and revision check]
 Validate --> Tx[Transaction: interview + answers + operation receipt]
 Tx --> DB[(PostGIS private schema)]
 DB --> Review[Review state machine]
 Review --> Media[Scan, redact, strip metadata]
 Review --> Agg[Versioned aggregation and disclosure checks]
 Media --> Approval[Independent publication approval]
 Agg --> Approval
 Approval --> Projection[(Public schema snapshot)]
 Projection --> Read[Public GET API and cache]
```

Failure boundaries: metadata transaction succeeds independently of attachment completion; missing media remains unpublished. Job claims use DB locking, bounded retries and dead-letter review. Jobs include input revision and unique operation key to prevent duplicate derivatives. Public invalidation occurs on edits, consent changes and withdrawal before replacement publication.''')
doc('architecture/api-design.md','API contracts','''Version prefix `/api/v1`. JSON over HTTPS, UUID IDs generated before offline capture, RFC3339 UTC timestamps plus original offset/device time; GeoJSON longitude-first EPSG:4326. Explicit pagination limits (default 50, max 200), bounded bbox and filter cardinality. Runtime schemas reject unknown sensitive fields on public DTOs. Errors: `{code,message,fieldErrors,requestId,retryable}` with no raw values or stack traces.

| Route | Access | Contract / result |
|---|---|---|
| GET /public/locations?bbox=&category=&q= | Public projection role | Published feature summaries; ETag; no interview IDs |
| GET /public/locations/:slug | Public | Approved evidence, media derivatives, safe summary |
| GET /public/insights?snapshot=&cohort= | Public | Preapproved cohort only; n/missing/unsure/method metadata |
| GET /public/study-area | Public | Verified published boundary, provenance, attribution |
| GET /session; POST /logout | Team session | CSRF protected logout; no refresh tokens in browser storage |
| POST /field-visits | Researcher | Assigned study, start timestamp; UUID receipt |
| GET /survey-versions/:id | Team | Immutable instrument and branch rules |
| POST /sync/operations | Own study | operationId, interviewId, baseRevision, surveyVersion, consent, positions, subjectGroups, answers, attachment manifests |
| GET /sync/operations/:id | Owner/reviewer | Durable receipt without repeating writes |
| POST /media/upload-intents | Owner | Validated MIME/size/hash; short lived private upload target |
| POST /media/:id/complete | Owner | Verify object/hash; queue quarantine scan |
| POST /reviews/:id/decision | Assigned lead | Expected revision; reason; immutable decision |
| POST /publication-snapshots | Publisher | Approved input revisions and policy version; cannot publish own unreviewed content |
| POST /withdrawals | Lead | Restricted receipt reference; invalidate affected copies |
| POST /exports | Lead with purpose grant | Async approved columns/cohort, expiry, audited download |

Success sync receipt: operationId, entityId, serverRevision, serverReceivedAt, status and missingAttachmentIds. 401 requires online reauthentication; 403 never retried automatically; 409 distinguishes changed payload under same operation key vs stale base revision; 413 oversize; 422 validation/instrument retired; 429/503 backoff. Unknown/removed place returns explicit review-required status, not silent relinking. Safe not-found responses prevent identifier enumeration. API contract and transaction idempotency precede field sync implementation.''')

doc('architecture/gis-design.md','GIS design','''No official boundary, exact coordinates or road geometry is supplied as verified. Candidates include Sarkhej Roza, Makarba Lake and Sarkhej Pond; each requires study-boundary, naming, access and source checks. Boundary is a versioned research extent, not automatically an administrative limit.

Import workflow: inventory source/licence/date/CRS → retain restricted provenance → transform to EPSG:4326 → reject empty/nonfinite/out-of-range/invalid geometry → compare with appropriate municipal or ward source where available → field-check name, access and position → independent reviewer → publish versioned feature. Never trace restricted Google imagery. OSM IDs/version/extract date and ODbL attribution travel with imported roads; public tile services are not offline caches.

Store Point, MultiLineString and MultiPolygon with dimensional/type checks and GiST indexes; use ST_IsValid and explicit non-null checks, ST_Covers for edge-inclusive study membership, ST_Intersects for bbox and geography calculations for metre distances. Keep original imported CRS metadata; Web Mercator is display only. Invalid repairs create a reviewed new version, never a silent geometric change.

Initial 20–30 places fit bounded GeoJSON; cluster points client-side and highlight by stable public feature ID. Roads/large layers move to bounded server vector tiles only if profiling warrants it. Search normalised English/Gujarati/Hindi names and aliases via indexed database search; avoid public external geocoder dependence. Point clusters do not cluster lines/polygons.

Coverage uses private interview positions inside controlled aggregation; topic charts use linked subject places. Fixed approved broad grid cells (initial 500 m candidate) require k≥5 interviews, minimum 2 researchers/visits where feasible, complementary suppression and cross-filter disclosure tests. Grid size and thresholds require institutional review; 500 m/k5 are provisional policy choices, not anonymity guarantees. Publish static approved coverage snapshots without precise points or arbitrary date/geometry query endpoints.

Historic raster overlays require dates, georeferencing control points, residual uncertainty, licence and matched bounds. Walkability is an observed corridor audit with date/rubric, not inferred pedestrian accessibility. Optional satellite/terrain/building layers require provider permission, coverage and budget; 3D extrusion is not street-level photography.''')
doc('architecture/offline-sync.md','Offline capture and synchronization','''Decision gate: prototype PWA against real Android Chrome and iOS Safari storage, key recovery, GPS and background restrictions before real collection. IndexedDB is not inherently encrypted, persistent or eviction-proof. If device-policy and key-management controls cannot satisfy institutional risk review, use ODK Collect/Central or approved KoboToolbox with an import adapter; custom offline collection remains blocked until proven.

Proposed vault: AES-GCM authenticated encryption with random IV per draft/blob, per-device random data key wrapped by researcher passphrase-derived key; key is unlocked only in memory and locks on inactivity/app background. No persistent plaintext key or tokens; no recovery by bypassing passphrase. XSS during unlocked use remains a risk. Require device encryption, screen lock, minimal collection, same-day sync and managed devices where feasible. Forgotten key or browser eviction may lose drafts; require researcher training, quota checks and a recovery drill, never claim guaranteed durability. Request persistent storage but handle denial. Backups of unsynced data only through institution-approved encrypted transfer.

Online sign-in and assigned cached immutable forms/places are required before departure. Offline unlock only for previously enrolled researcher within a provisional 24-hour offline window; cannot create accounts, approve/publish, export or silently extend authentication. Server cannot instantly revoke an offline device; local collection after revocation is quarantined on reconnect. Expired offline session locks sensitive screens while retaining encrypted drafts; online reauth required to sync.

States: editing → locally_saved → queued → sending → server_received → submitted → under_review → approved / changes_requested / rejected; media has independent pending/uploading/quarantined/approved states. Save shows success only after IndexedDB transaction completion; autosave has visible last-save time, never a misleading green badge before persistence. Quota and write errors stop starting additional interviews and preserve existing drafts.

Each interview UUID and operation UUID is generated client-side. Server unique(operation_id, actor_id) with request hash and receipt; unique(interview_id). One transaction locks/creates interview, verifies base_revision and form version, writes answers/position/subject links/audit, then stores receipt. Same key+hash returns receipt; same key+changed payload is 409. Concurrent sends yield one write; response lost after commit is recovered by receipt lookup. No time-based duplicate rule deletes genuine similar interviews.

Edits use new operation IDs and baseRevision; submitted records require correction revision. Conflicts preserve both revisions and show lead resolution; never last-write-wins on consent/GPS/answers. Retry transient failures with exponential jitter and cap; persistent rejection is actionable and retained. On reconnect verify account, form compatibility and pending server withdrawals before upload. Attachment manifests are content-hashed, resumable multipart where available, and independently retried. Interview may sync before photo; publication waits for approved complete derivatives. Clear local payload only after acknowledged server checksum/revision and retention policy; device-loss and clean-browser tests prove limitations.

Service worker caches only shell, permitted reference map data and immutable forms, never private API responses/original uploads. Do not bulk-download standard OSM tiles. Background Sync is an enhancement; foreground queue resume and explicit retry are required. Fallback importer preserves source instance UUID, form version, exact interview/subject distinction, consent and audit; malformed submissions are quarantined, never silently coerced.''')
doc('architecture/privacy-security.md','Privacy, ethics and threat model','''Real participant collection is blocked until institutional research approval and applicable-law review are recorded by the authorised institutional owner. This is a verification task, not a claim of legal compliance. Check India's applicable DPDP framework, commencement, institutional policies, participant ages, hosting/transfers and notice/withdrawal obligations using current official sources with institutional counsel. No child-participant workflow until specifically approved. No ordinary respondent names, phones or addresses are required.

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

Incident response: contain exposure, disable affected publication/session, preserve minimal restricted evidence, assess with institutional lead, notify through verified obligations, rotate keys, restore safe snapshot and record corrective tests. No fabricated notification deadlines.''')
doc('architecture/media-pipeline.md','Media and immersive content','''Originals are private. Upload-intent validates owner/study, allowed JPEG/PNG/WebP, supported panorama images and explicitly approved audio/video; proposed caps 15 MB image, 80 MB panorama, 100 MB recording are configurable and piloted. Sniff content, verify digest/size, quarantine, scan malware, decode/re-encode images in isolated worker, strip EXIF/GPS, review faces/plates/voices and rights. No public original URL. Short-lived signed private review URLs; approved derivatives use a separate bucket/prefix and nonidentifying keys.

Metadata: location link (public place, not automatically interview position), capture date precision, direction/viewpoint, creator, licence, consent scope, permission expiry, checksum, source asset, review revision and alt text/transcript. Historical dates can be approximate but precision/uncertainty must be visible. Comparison pair requires matched feature/viewpoint, two cited dates, permitted images and an evidence-quality label; unsupported dates block publication.

Prefer self-captured Pannellum equirectangular panoramas with static photo fallback, captions and keyboard controls. Marzipano is a feasible alternative for complex tours but adds authoring needs. Google Street View requires officially supported embed/API, available coverage, current terms, restricted keys and billing/quota review; do not scrape/cache restricted imagery. Static API and interactive panorama products have different pricing and terms. Mapillary requires developer access/terms verification (documentation login restricted during planning); not promised in MVP. 3D building extrusion/terrain is optional cartographic data, never advertised as panorama coverage. No provider has been activated or paid.

On consent expiry/withdrawal, revoke public derivative and invalidate CDN/snapshots; retain deletion manifest and trace derivatives back to source/consent. Failed scan/upload stays private and retryable, with no half-published image.''')
doc('architecture/deployment.md','Deployment, costs and observability','''```mermaid
flowchart LR
 B[Browser] --> CDN[HTTPS static hosting and approved media CDN]
 B --> Proxy[HTTPS reverse proxy]
 Proxy --> API[Express public/private routes with separate DB pools]
 API --> PG[(Managed PostgreSQL + PostGIS)]
 API --> Obj[(Private object storage)]
 Worker[Same-codebase worker] --> PG
 Worker --> Obj
 Worker --> Pub[(Approved public media)]
 PG --> Backup[Encrypted backups and restore target]
 API --> IDP[OIDC provider]
```

Deployment options: managed static host + small managed container + managed PostGIS + S3-compatible storage offers lower operations; institution-hosted Linux VM with containers reduces vendor coupling but requires patching, monitored backups and on-call responsibility. Avoid assuming free tiers support PostGIS, no sleep, recovery or data residency. Public and private origins use separate cookie scope/CORS allowlist; same API deployment may route both with separate DB credentials. Staging uses synthetic data only, separate secrets and buckets. Production collection is disabled until gates pass.

No prices or accounts purchased. Cost model/month: static hosting + API/worker compute + database storage/backup + private/public object GB + bandwidth + map tile requests + optional panorama API. Candidate planning envelope INR 2,000–6,000/month is an unquoted budget hypothesis, not provider pricing; actual approved quotes, taxes, limits, region and spending cap required before purchase. Low-cost alternative is institution resources with explicit maintenance ownership. Set billing alerts/quotas and document free-tier expiry; optional Google/imagery costs default disabled.

Deploy migrations as a controlled job after backup; additive changes first, compatibility rollout, destructive changes only after retention review. Readiness validates DB/schema; liveness avoids expensive DB calls. Roll back code only if schema compatible; forward repair or restore rehearsal for destructive migrations. Public read-only outage has static methodology/fallback; field app shows saved vs synced truthfully.

Observe latency/error rate, queue backlog/retry age, failed scans, sync rejection/conflict rate, stale snapshots, backup age and disk/quota. No raw payload/GPS in logs. Provisional alerts: unsynced queue >24h, failed backup >24h, publication invalidation failures immediately. Role names describe responsibility; named maintainers and incident coverage must be assigned before launch.''')

adrs=[
('001','Modular monolith and TypeScript','React/Vite apps and Express API with shared runtime contracts','Separate microservices or Next.js full stack','Lower operational load and clear private/public boundaries','Several apps need coordinated contract releases; Express requires explicit validation/auth middleware','Revisit if team scale or SSR/search indexing needs justify complexity','https://expressjs.com/en/advanced/best-practice-security/'),
('002','PostGIS and publication projection','PostgreSQL/PostGIS restricted source schema plus explicit published tables','Document DB, raw-table public views, hosted BaaS direct queries','Spatial validation and transactional idempotency; separate least-privilege public role','Requires migration discipline and verified publication invalidation','Revisit provider only after PostGIS, backup and grant tests','https://postgis.net/docs/ST_IsValid.html'),
('003','MapLibre and licensed tiles','MapLibre with a separately licensed tile provider; own bounded GeoJSON','Google-only maps, default OSM tiles as production/offline service','Custom atlas layers and portable data','Tiles, attribution and offline terms are separate dependencies','Revisit provider on coverage, quotas or budget change','https://maplibre.org/maplibre-gl-js/docs/'),
('004','Offline feasibility gate','Conditional protected PWA; ODK/Kobo fallback with deterministic importer','Unencrypted IndexedDB, online-only form, native custom app','Shared web skills and explicit security decision before collection','Browser eviction/XSS/key recovery; fallback adapter and Android logistics','Select fallback if real-device security/durability gate fails','https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria'),
('005','Owned panoramas first','Pannellum with approved own images; optional provider viewer after approval','Marzipano complex tours, universal Google Street View promise','Simple self-hosting and content control','Capture permissions, WebGL limits and media size','Revisit for multi-scene tours or verified provider coverage','https://pannellum.org/documentation/overview/'),
('006','Identity and server sessions','Maintained OIDC provider, backend exchange, opaque server sessions','Custom passwords, browser localStorage JWT','Delegates credential/MFA operations, revocable scoped sessions','Provider setup and offline revocation delay remain','Revisit if institution provides SSO or provider residency unsuitable','https://expressjs.com/en/advanced/best-practice-security/'),
('007','Safe aggregates','Preapproved versioned cohorts and public snapshots with suppression','Arbitrary query builder, random jitter on raw points','Reproducible counts and reduced differencing surface','Less flexible filters, institutional disclosure review still required','Revisit only with reviewed risk analysis and regression tests','https://www.w3.org/TR/WCAG22/')]
for num,title,decision,alt,adv,dis,risk,source in adrs:
    doc('architecture/adr/'+num+'.md','ADR '+num+': '+title,f'''Status: proposed baseline, adopted for planning; implementation validation pending.

Decision: {decision}.

Alternatives: {alt}.

Advantages and rationale: {adv}.

Disadvantages and risks: {dis}.

Revisit conditions: {risk}.

Evidence checked 2026-11-07: [{title} reference]({source}). Source describes technology capability, not proof this project is secure or legally compliant.''')

doc('source/technical-references.md','Dated technical research','''Checked 2026-11-07 using official documentation. These references support proposed capabilities; package maintenance, exact prices and institutional legal applicability must be rechecked at implementation.

| Source | Planning consequence |
|---|---|
| [MDN Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) | Permission and secure-context handling required; no accuracy guarantee |
| [MDN storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) | Browser eviction/quota failures require explicit recovery limits |
| [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/) | No bulk/offline standard tile download |
| [OSM copyright](https://www.openstreetmap.org/copyright) | Attribution/ODbL review; data licence differs from tile service |
| [MapLibre](https://maplibre.org/maplibre-gl-js/docs/) | Map renderer; provider/data remain separate choices |
| [PostGIS ST_IsValid](https://postgis.net/docs/ST_IsValid.html) | Validate 2D geometry and handle null explicitly |
| [Express security](https://expressjs.com/en/advanced/best-practice-security/) | HTTPS, validation and hardened deployment remain application work |
| [Pannellum](https://pannellum.org/documentation/overview/) | Self-hosted panorama viewer; media rights remain project responsibility |
| [Street View billing](https://developers.google.com/maps/documentation/streetview/usage-and-billing) | Optional billed integration; quote and permission needed |
| [ODK Collect](https://docs.getodk.org/collect-intro/) | Android offline-capable collection fallback |
| [ODK encrypted forms](https://docs.getodk.org/encrypted-forms/) | Finalized submissions can encrypt; in-progress drafts still need device protection |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | AA target plus manual testing |
| [MeitY framework](https://www.meity.gov.in/data-protection-framework) | Institutional legal review must verify current law/commencement; page had no extractable body |
| [Mapillary developer docs](https://www.mapillary.com/developer/api-documentation/) | Login restricted; terms/cost/coverage unresolved, integration optional |

Blueprint also references KoboToolbox GPS and mapping documentation; fallback selection issue must validate those current capabilities and institutional approval before choosing it. No paid integration activated.''')

if __name__=='__main__': print('Core planning baseline generated')
