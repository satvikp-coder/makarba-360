"""Detailed issue catalogue, stable IDs and dependency-aware roadmap."""
from build_planning import ROOT, put, doc
import json

milestone_titles=[
'Requirements, Research and Repository Foundation','UI/UX and Design System','GIS, Map Data and Spatial Foundation','Authentication, Privacy and Data Security','Field Survey and GPS Collection','Offline Fieldwork, Synchronisation and Media','Heritage, Historical Evidence and 360° Content','Public Interactive Website','Community Insights and Survey Analytics','Research Administration and Publication Management','Quality Assurance, Accessibility and Performance','Field Pilot, Launch and Final Handover','Advanced and Stretch Features']
# title | delivery contract | technical approach | negative/edge test | stable blockers
raw=[
'''Establish repository governance|Branch/PR rules, ownership vacancies and planning-only boundary are documented|Review AGENTS, contribution/security policy and licence decision register|No real team or source licence invented|-
Trace all source blueprint requirements|Every one of 23 pages maps to requirements, documents and issue IDs|Checksum supplied PDF and maintain page-level traceability|Missing/fictional source content never becomes a fact|00.01
Approve product vision and boundaries|Public atlas and private research scope are signed off with explicit exclusions|Review vision and release A/B/C boundaries against source|Public survey submission excluded from every journey|00.02
Validate research questions and methodology|Sampling, evidence classes and neutral interview questions have research review|Version methodology and record convenience-sample limitations|Respondent opinion cannot be relabeled measured fact|00.03
Specify and verify geographical study extent|Boundary authority/source and research extent review procedure are recorded|Compare available municipal records, basemap and field verification plan|No invented official polygon or broad Ahmedabad assumption|00.04
Approve stakeholder capability matrix|Every action has role, study scope and ownership policy|Review visitor/researcher/lead/admin grants and separation of duties|Admin role alone cannot view all research records|00.03
Baseline functional requirements catalogue|Every core workflow has stable requirement ID and release allocation|Cross-link field/public/admin/GIS/content functions and screens|A discussion about B captured at A remains distinct|00.02 00.06
Baseline non-functional requirements|Performance, accessibility, reliability and privacy targets are measurable|Define datasets, test devices, load and gate evidence in requirements|Targets distinguished from achieved measurements|00.07
Review architecture diagrams and ADR baseline|Context, component, deployment and trust boundaries have review evidence|Review monolith, PostGIS, offline and public projection decisions|No optional provider capability silently promised|00.08
Scaffold development setup and CI governance|A clean Windows checkout can start synthetic development services using documented steps|Create pnpm workspace and lockfiles, local service definitions and planning/product CI as appropriate|Missing env values fail clearly; no secrets in browser bundle|00.09
Obtain institutional ethics and legal verification|Authorised institutional decision covers recruitment, age, consent, retention and hosting|Record restricted approval reference and nonpersonal gate status; verify current applicable law|No real participant collection before approval; no claimed legal certification|00.04 00.06''',
'''Define visual identity and accessible tokens|Approved palette/typography/spacing has tested contrast and licensed fonts|Turn design-system and contrast audit into reviewed token specification|Accent text failing AA is rejected|00.03
Design public information architecture|Navigation, URLs and list alternative cover all public evidence routes|Review P01–P13 sitemap and empty/loading/error states|No public Submit Survey entry or anonymous write journey|01.01 00.07
Specify home page wireframes|Responsive hero, introduction, featured places and Explore CTA have annotated states|Produce low-fidelity frames with media/date/credit slots|Unavailable permitted image uses honest fallback|01.02
Specify desktop map-first layout|Layer panel, map and expandable place detail work at desktop/compact widths|Annotate focus, URL state, attribution and selected-feature behavior|WebGL failure reaches equivalent list|01.02
Specify mobile map bottom sheet|Peek/half/full sheet, floating controls and keyboard alternative are reviewed|Prototype safe areas, orientation changes and expand/collapse controls|Soft keyboard or expanded sheet cannot hide save/search action|01.04
Design place profile interface|Sources, history, media and safe sample summaries are readable with missing content|Annotate P05 evidence tabs and accessibility order|Unpublished place has no preview leak|01.04
Design Then and Now comparison|Dated sources, evidence quality and matched-view slider have keyboard alternative|Specify side-by-side and text description states|Unknown historical date cannot display as exact 2021|01.06
Design Community Insights dashboard|Every chart includes n, period, missingness and suppression explanation|Specify chart/table pairs and allowed cohort filters|Small groups and no-data never rendered misleadingly as zero|01.02 00.04
Design accessible field interview screens|Consent → GPS → separate subjects → answers → durable save is usable on phone|Review F01–F13 with bilingual script and offline/permission states|Denied consent stops capture; A/B place distinction survives review|01.01 00.06
Design responsive research management|A01–A12 include review decisions, public preview and withdrawal state|Prototype tables/cards, role-limited navigation and bulk-action preview|Unscoped administrator cannot open raw data review|01.01 00.06''',
'''Provision PostGIS migrations and roles|Empty and prior-version databases migrate with explicit restricted/public grants|Version SQL, extensions, constraints, spatial indexes and synthetic fixtures|Public connection cannot query private interview tables|00.10 03.05
Store and validate versioned study boundary|Verified research extent stores source/version/reviewer and geometry validity|Implement MultiPolygon 4326 validation and version-aware ST_Covers checks|Invalid polygon or unknown source cannot publish|00.05 02.01
Select basemap provider and attribution|Provider terms, ODbL attribution, request budget and offline permissions are recorded|Compare licensed tile services and institution hosting; configure attribution|Standard OSM tiles not bulk-cached offline|00.09
Integrate initial MapLibre map|Synthetic verified fixture layers render with source attribution and list fallback|Create shared map adapter, bounds configuration and selected ID state|Renderer/context loss preserves accessible navigation|02.02 02.03 01.04
Implement location category taxonomy|Stable localized category codes and distinct icons have review path|Migrate categories and expose approved read model|Referenced category can archive without breaking history|02.01 01.01
Support point route and polygon locations|Location geometry CRUD validates type, CRS, range and provenance|Implement typed geometries, GiST/bbox/distance query contracts|Empty/self-intersecting/mislabeled CRS rejected|02.01 02.05
Import and verify road corridors|Source-dated licensed street geometries pass field/reviewer checks|Stage OSM extracts with IDs/version/licence and validation report|Restricted imagery tracing or unverified road names blocked|02.02 02.06
Provide reusable spatial search and clustering|Bounded search/filter contracts and point clustering return stable feature IDs|Index aliases and categories; separate line/polygon layers from point clusters|Zero matches, antimeridian-invalid bbox and excessive bounds handled|02.04 02.06
Implement geographic candidate editing|Researchers submit private proposed geometry and lead reviews changes|Version edit proposals, source evidence and reviewer decision|Unreviewed candidate never appears in public layers|02.06 03.04
Implement validated GIS import and export|CRS/source/licence checks produce explicit accept/reject report|Stage GeoJSON and approved export formats with limits and audit|Malformed geometry or private coordinate export rejected|02.06 03.04''',
'''Integrate identity provider and secure sessions|Team sign-in/logout, expiry, revocation and MFA policy have verified behavior|OIDC code/PKCE backend exchange, opaque server sessions and cookie/CSRF policy|Cross-site login state mismatch and expired session denied|00.06 00.10
Implement researcher invitation and deactivation|Only authorised trained invited users can collect in assigned studies|Map IdP identity to profile, training and scoped grants|Deactivated account cannot sync as active user|03.01
Implement role and study authorization|Every private route evaluates role, study and record ownership|Central authorization service with deny-by-default capabilities|Researcher cannot read another study or grant admin role|03.01 00.06
Enforce capability matrix across API and UI|UI actions and API handlers agree with approved capabilities|Add route guards, ownership checks and explicit admin separation|Hidden button alone never substitutes server authorization|03.03
Harden database access and migration credentials|Runtime roles cannot run DDL or read forbidden schemas|Define grants/RLS design, deployment migrator separation and pool settings|Public role and field role escalation attempts fail|00.09
Implement scoped versioned consent records|Recording, aggregate and identifiable media/story permission are independent|Append-only consent decisions linked to interview, script and revision|Consent withdrawal or refusal cannot be overwritten by checkbox|03.04 00.11
Protect raw interview and GPS endpoints|Exact positions, timestamps and answers require scoped private access|Use separate public DTOs/DB pools, no-store private responses and IDOR checks|Anonymous or wrong-owner query returns no sensitive fields|03.04 03.05
Implement security audit events|Access-sensitive decisions record actor/action/revision/reason without payload leaks|Append-only events and request IDs; protected reader grants|Logs never include GPS, raw answers or session tokens|03.04 03.05
Configure secure secrets and environments|Local/staging/production secrets are isolated and validated at startup|Env schema, deployment vault, example config and secret scanning|Vite bundle and CI output contain no server secret|00.10
Test security threat model and privacy boundaries|Reviewed abuse cases map to automated negative tests and residual risks|Exercise CSRF/XSS/IDOR/rate limits/upload threat paths|Valid authentication cannot bypass consent or publication review|03.07 03.08 03.09''',
'''Implement survey question and answer schema|Typed questions and explicit missing reasons persist against version|Migrations/runtime schemas for choice/text/scale/topic links|Unsure/refused are not numeric zero or empty-string answers|02.01 00.04
Implement immutable questionnaire versions|Old responses retain original wording/options and schema hash|Publish/retire form versions with compatible concept mappings|Edited published form rejected; stale drafts explicitly reviewed|04.01
Implement field visit sessions|Own assigned visits have start/end, study and status history|Visit API with assignment validation and scoped ownership|Ending visit with pending drafts prompts reconciliation|03.04 02.02
Implement interview start workflow|Start Interview creates client UUID only after authorised visit and consent step|Phone flow F02–F04 with instrument/version pin and draft lifecycle|Repeated tap cannot start duplicate logical interview|04.02 04.03 01.09
Capture participant categories and official claims|Stakeholder/duration values support uncertainty and separate official verification|Render versioned options and restricted claim record|Official dropdown never emits verified official attribution|04.01 04.04
Record consent and interview metadata|Interview time/collector/visit and consent script/scope are independently retained|Bind consent service to interview state and branch termination|Declined consent discards answer/GPS content|03.06 04.04
Capture mobile geolocation and permission state|Fresh capture stores reported accuracy/time/method and permission/error status|HTTPS Geolocation adapter with timeout, denied and unavailable states|No fabricated coordinate after denied or failed capture|04.06 01.09
Display GPS quality recapture and corrections|Quality bands, fix age and manual correction reason are visible and auditable|Use ≤20, >20–50, >50m labels; preserve raw/effective fix revisions|Manual pin never receives invented device accuracy|04.07 02.04
Store independent interview and subject geography|One interview position can reference different point/route/area topic groups|Separate position table and survey_location_links with same-interview constraints|Interview at A discussing B never moves A to B; multiple subjects not blanket-copied|04.01 02.06 04.08
Render and validate versioned questions|Branching, refusal/unsure and per-subject responses validate consistently|Shared runtime schema plus mobile form renderer and server validation|Inactive branch or mismatched form answer not counted|04.02 04.05 04.09
Implement interview review and durable save|Review shows consent, private spot, discussed subjects and exact save/sync state|Persist local transaction then queue submit with validation summary|App close during save does not falsely report success|04.10 04.06 05.02
Implement own submission history and corrections|Researchers see own receipt/status and submit reasoned correction revision|Revision comparison and lead change-request integration|Submitted record cannot be silently overwritten|04.11 05.04''',
'''Validate offline approach and fallback|Real-device storage/key/recovery test evidence selects PWA or approved ODK/Kobo path|Threat assessment, quota/eviction prototype and fallback import contract|Unencrypted browser storage never claimed inherently safe|00.11 00.09 01.09
Persist protected recoverable local drafts|Draft saves acknowledge only successful vault transactions and survive restart within tested limits|IndexedDB protected vault, autosave marker, quota alarms and key-unlock design|Quota failure/key loss/eviction produce honest recovery limits|05.01 04.01
Implement offline session and device lock policy|Previously enrolled researcher can unlock only within approved offline window|Memory-only unlocked key, idle/background lock and online reauth before sync|Offline revoked account cannot be assumed instantly revoked; reconnect quarantines|05.01 03.01
Implement idempotent transactional sync|Repeated/concurrent same-operation requests return one durable receipt/write|Unique operation/interview IDs, request hash, base revision and atomic receipt transaction|Same key changed payload gets 409; response loss retry adds no duplicate|04.02 04.09 03.07 05.03
Handle sync retries conflicts and rejections|Queue preserves failures and both conflicting revisions with clear action|Jittered bounded retries, 401 reauth, 409 resolution and rejected record state|No last-write-wins on consent/GPS; offline-to-online partial failure retained|05.04 05.02
Prevent duplicates without deleting genuine interviews|Operation uniqueness enforced and similar records flagged for human review|DB concurrency locks/constraints plus reviewer duplicate candidates|Two similar genuine respondents retained; double tap/retry one record|05.04
Implement quarantined resumable media uploads|Only complete verified safe files can produce public derivatives|Signed private upload intent, size/MIME/hash checks, scan and idempotent jobs|Half upload, executable/polyglot and scanner failure remain private|03.09 03.07 05.04
Manage photo metadata credit and permissions|Date/direction/place/creator/rights and participant consent trace every derivative|Media permissions, EXIF removal and face/plate redaction review|Unknown rights or withdrawn consent blocks public copy|05.07 03.06
Test field network and device-loss recovery|Approved devices recover acknowledged drafts or document unrecoverable cases|Airplane mode/restart/low-storage/key loss/foreground resume test script|Never clear local source before verified server receipt and attachment reconciliation|05.05 05.06 05.08''',
'''Implement versioned place content model|Profile content separates description, dated observation and evidence state|Localized content revisions and last-reviewed metadata linked to locations|Unreviewed content cannot inherit geometry approval as publication approval|02.06
Implement editorial place description workflow|Descriptions are sourced, revisioned and reviewed for current publication|Draft/review/approve transitions with category/history/media references|Stale revision or invented site condition rejected|06.01 03.04
Implement historical evidence provenance|Every claim stores citation/date precision/rights and verification state|Source schema and reviewer UI/API preserve disputed accounts|Missing source/date cannot become verified chronology|06.01 00.04
Implement sourced timeline events|Events show supported date range/precision and evidence quality|Events reference location and source; ordered display handles approximate dates|Unknown date not coerced to exact year or current date|06.03
Implement historical comparison pair model|Matched images have independently verified dates, rights and viewpoint notes|Link before/after assets and quality review at current revision|Missing historical date or mismatched place blocks publication|06.03 05.08
Build accessible Then and Now component|Keyboard slider and side-by-side fallback show dates/sources and limits|Responsive image comparison with text description and lazy media|Unsupported pair hidden; image failure preserves narrative|06.05 01.07
Integrate owned panorama viewer|Approved self-captured panorama displays date/credit with static fallback|Lazy Pannellum adapter, keyboard controls and permitted derivative URLs|WebGL failure/large texture does not block place page|05.08 01.06
Evaluate third-party street imagery licensing|Coverage/API/terms/privacy/cost comparison yields explicit enable-or-defer decision|Check supported Google viewer/embed and Mapillary access without scraping|No billing activation or continuous coverage promise without approval|02.03 00.09
Publish verified location stories and accounts|Reviewed stories distinguish fact, memory and official statement with permitted attribution|Consent-linked editorial revision and source verification workflow|Unverified official claim or revoked quote remains unpublished|06.02 06.04 03.06''',
'''Build public shell and accessible navigation|Public routes expose atlas navigation, language shell and list alternative|React/Vite public app and responsive shared UI primitives|Anonymous page has no survey entry route/action|00.10 01.02
Build evidence-led home page|Introduction and approved featured places lead to map without fabricated findings|Responsive P01 layout using public projection and permitted media|No approved hero/media gives honest fallback|07.01 01.03 07.10
Build public map explorer|Visitors browse verified features and select details with stable URL state|Integrate shared MapLibre and published GeoJSON; list fallback|No private interview source/layer in network requests|02.04 07.01 07.10
Build map layer and category controls|Layer toggles/filter chips have keyboard and selected-state behavior|Bind approved categories/layers to URL and map source filters|Empty result retains reset/list controls and attribution|07.03 02.05
Build public location search|Multilingual aliases find only published places and restore map selection|Consume bounded spatial/name query contracts with request cancellation|Rapid stale response cannot overwrite newer search; private candidate hidden|02.08 07.10 07.03
Build location profile pages|Profiles show approved description, geometry, dates, sources and safe summaries|Deep-link P05 using public DTO with modular evidence sections|Withdrawn/unpublished place has safe 404 and no cached source leak|07.10 01.06 06.02
Build approved photo gallery|Responsive gallery/lightbox exposes derivative, credit, date and alt text|Accessible focus-managed gallery with lazy image sizes|Original object URL/EXIF never exposed; missing asset fallback|05.08 07.06
Present panorama and unavailable coverage states|Place page loads approved panorama on demand or honest static fallback|Connect owned viewer and optional approved external integration decision|Unavailable provider/denied third-party load leaves usable profile|06.07 06.08 07.06
Integrate public history and Community Voices|Profiles/history/voices routes show reviewed dates, sources and permitted accounts|Compose timeline, comparison, quote/theme evidence with distinct labels|Withdrawal invalidation removes stale attributed content|06.06 06.09 07.06
Implement read-only public projection API|Public credentials and allowlisted DTOs expose only approved snapshots/content|Separate public DB pool/schema and GET-only routes with cache invalidation|Anonymous write/raw survey/exact interview GPS requests fail|03.07 09.08 08.09
Verify responsive public map journeys|Desktop drawers and mobile bottom sheet preserve all essential controls|Implement approved responsive frames, safe areas and focus behavior|320px/zoom/orientation/soft keyboard do not hide navigation|07.03 07.06 01.05
Publish methodology sources and accessibility pages|Visitors can inspect sampling/counting/privacy limits, citations and language help|Build P11–P13 from versioned approved content and attribution registry|No invented team/contact, unverified results or unsupported translation claim|07.01 00.04 01.02''',
'''Implement reproducible valid-answer aggregation|Each metric pins question/version, denominator, missing/unsure and eligibility rules|Worker aggregates only reviewed consent-compatible nonwithdrawn revisions|Invalid/unpublished/branch-inactive answers excluded; unsure not zero|04.02 09.04 03.06
Aggregate stakeholder distributions|Counts represent distinct eligible interviews per category and collection period|Versioned snapshot count/query and denominator metadata|Multi-place interview not counted repeatedly in overall distribution|08.01
Analyze reported issues with codebook|Issue counts separate selected categories from analyst-coded themes|Stable taxonomy, multi-label coding provenance and valid-base rule|Percentages may exceed 100 only with explicit multi-response note|08.01 04.10
Analyze ratings and perceived changes|Distributions show valid n, unsure/missing and association context|Scale/ordinal counts and question-version mappings; no unsupported causal claims|Rating unsure not zero; incompatible versions not silently pooled|08.01
Build stakeholder comparison chart tables|Allowed comparison cohorts display counts, disclosure state and limits|ECharts + accessible tables consuming fixed approved snapshots|Small category suppressed including complementary cell reconstruction|08.02 08.04 08.09 01.08
Publish location-level sample summaries|Topic analysis uses subject location and explains overlapping respondents|Aggregate scoped answer/topic groups and distinct interview bases|Interview at A discussing B contributes to B topic, not A rating|08.01 04.09 08.09
Build safe survey coverage snapshots|Coverage uses private interview positions only to emit coarse approved cells|Fixed grid/policy version and suppression pipeline with no raw centroid export|Low-n cells/out-of-area fixes do not reveal precise individuals|08.01 08.09 02.02
Implement constrained dashboard cohorts and dates|Filters select preapproved periods/groups with visible active cohort metadata|Allowlisted cohort routes, cache keys and no arbitrary intersection query|Unsupported filter combination cannot bypass suppression via API|08.02 08.03 08.04 08.09
Enforce disclosure and small-sample controls|Policy checks minimum n, complementary/differencing risk and restricted fields|Versioned fixed cohorts and privacy tests; institutional approval of provisional k5/grid|Suppressed cell cannot be reconstructed by totals/date differences|08.01 03.10
Verify analytics with reproducible fixtures|Frozen synthetic cases reproduce every numerator/base/exclusion and suppression|Independent expected tables and question/method notes beside each metric|Missing, rejected, withdrawn, duplicate and multi-place fixtures handled|08.02 08.03 08.04 08.07 08.08''',
'''Build role-limited research dashboard|Lead/admin navigation and scoped queue totals respect assigned capabilities|Private app shell and study selector with capability checks|Technical administrator sees no raw records without explicit grant|03.04 01.10
Build account and training administration|Authorised admin manages invitations, grants, expiry and training state|Reuse account service with audited reason/confirmation and role separation|Self-escalation and cross-study grant denied|09.01 03.02
Monitor visits and research progress|Assigned visits show reviewed collection counts vs estimates and unresolved queue|Scoped progress queries with stale/device-status caveats|Unknown offline drafts not falsely counted as synced|09.01 04.03
Build survey moderation and validation queue|Lead reviews consent/completeness/duplicates/version and requests revisions|Review state machine with current revision checks and eligibility flag|Self approval or stale decision cannot make record public-eligible|09.01 04.10 03.08
Review private GPS quality and outliers|Reviewers inspect raw/effective fixes, accuracy/time and boundary context|Private map/list flags with reasoned correction revision workflow|Poor accuracy cannot be silently snapped to subject place|09.04 04.08 02.02
Approve candidate locations and geometry|Verified source/name/access/boundary checks precede place approval|Candidate review state, geometry diff and reviewer evidence|Rejected/out-of-boundary candidate remains private|09.01 02.09
Review historical evidence and media rights|Lead checks date/source/viewpoint/permission/redaction before editorial approval|Unified evidence/media queue with independent consent/rights checks|Unknown rights, unverified official attribution or missing date blocks item|09.01 06.03 05.08
Implement publication preview approval and revoke|Independent reviewer approves exact public payload from current eligible revisions|Versioned snapshots, allowlisted lineage and atomic publish/invalidate jobs|Stale consent, self approval or withdrawal invalidates affected public copies|09.04 09.06 09.07 03.08
Implement purpose-limited anonymised exports|Approved CSV/GeoJSON field lists remove raw identifiers and exact interview GPS|Async export job, formula-safe CSV, private expiring download and audit|Spreadsheet injection, low-n export and unauthorized download rejected|09.04 08.09 02.10
Implement correction withdrawal and retention workflows|Requests invalidate publication, retain audit and schedule approved private purge|Receipt verification, lineage traversal, tombstones and backup restore replay|Withdrawal while jobs run cannot republish revoked content|09.08 03.06 03.08''',
'''Establish meaningful unit test harness|Shared validation and domain invariants execute in CI with readable fixtures|Vitest and coverage focused on consent/GPS/version/count logic|Tests fail on intentionally changed boundary/missingness rule|00.10
Test API integration and validation|Private/public routes validate auth, schema, error codes and transaction behavior|Ephemeral PostGIS/API integration fixtures using real HTTP contracts|Unknown fields, stale revisions and excessive query limits rejected|10.01 05.04 07.10
Test migrations and spatial invariants|Empty/upgrade database and geometry/CRS/edge membership cases pass|PostGIS test fixtures and least-privilege migration checks|Invalid polygon/null geometry/wrong CRS cannot publish|10.01 02.10
Test authorization abuse paths|Anonymous, revoked, wrong-owner and wrong-study requests are denied|Negative API/session/CSRF capability matrix test suite|Researcher cannot invoke admin or another collector record|10.02 03.10
Test private-to-public exposure boundary|No raw coordinates/answers/consent/EXIF/private IDs escape any public route|DTO schema snapshots, DB grant tests and media metadata inspection|Public cache/export/search errors cannot leak private fields|10.02 09.08 09.09
Test GPS permission quality and correction edges|Denied/timeout/stale/poor/manual/out-of-boundary cases match protocol|Mock geolocation adapter plus physical-device capture checklist|Manual correction preserves raw fix and no fabricated accuracy|04.09 10.01
Test offline to online sync reliability|Lost responses/concurrent retry/app restart yield one interview and recoverable state|Fault injection, queue/vault tests and server transaction concurrency|Two simultaneous operation sends commit once; rejected attachments retained|05.09 10.02
Test end-to-end public field and review journeys|Synthetic capture A/discuss B → review → safe public snapshot is reproducible|Playwright browser flows with test identity and synthetic fixtures|No consent/withdrawal/unauthorized request blocks intended exposure|07.11 09.10 08.10 10.07
Audit keyboard screen reader and localization access|Core public/field/admin journeys meet AA target with recorded manual evidence|axe checks plus NVDA/VoiceOver, contrast/zoom/reflow/reduced-motion testing|Canvas-only navigation, focus trap loss and untranslated consent flagged|07.11 09.01 01.09
Enforce performance security and CI gates|Agreed fixture/load budgets, dependency/secret scans and required check policy exist|CI jobs, bundle/network budget and reviewable exception process|Failing required checks prevent merge; no blanket allow-failure|10.04 10.05 10.08 10.09
Rehearse encrypted backup and restore|Isolated restore proves grants/object integrity and withdrawal tombstone replay|Restore DB/media manifests, measure RPO/RTO and record evidence|Revoked data cannot reappear publicly after restore|09.10 11.07
Validate real mobile browser compatibility|Supported Android/iOS devices complete GPS/vault/map/upload paths|Record actual OS/browser/device matrix and tested limitations|Storage eviction, background suspension and WebGL loss documented|10.06 10.07 10.09''',
'''Train researchers and rehearse field checklist|Collectors demonstrate consent, A/B geography, save/retry and incident process|Synthetic interview exercise using SOP and approved scripts|Researcher unable to recover/identify unsynced draft not cleared for field|00.11 04.12 05.09
Run consent-approved small field usability pilot|Observed interview timing/error findings drive reviewed corrections before expansion|Small approved pilot across stakeholder contexts and safe locations|No real participant pilot before ethics/offline/security gates|11.01 10.04 10.12
Verify candidate places and road data|20–30 target places and 4–6 target corridors have evidence or explicit gaps|Source/field/boundary QA and independent geometry review|Unverified target omitted rather than fabricated to hit quota|02.07 09.06
Run real GPS and offline pilot|On-site A/B/airplane-mode/restart/recapture scenarios reconcile saved vs server IDs|Physical-device checklist and per-failure recovery evidence|Location capture away from interview spot or lost draft blocks expansion|11.02 10.07
Audit survey consent and data quality|Eligible records have current consent, valid version, topic links and review|Reconcile counts/duplicates/missingness and exclusion reasons|Unverified official claim never passes as verified statement|11.04 09.04 09.05
Audit historical sources and media attribution|Published comparisons/panoramas/quotes have source/date/rights and permission|Trace every derivative and historical claim back to approved evidence|Absent historical image/date yields unavailable feature, not fake content|09.07 06.06 06.07
Provision staging and production deployment|Approved host/region/budget, secrets, HTTPS and release rollback are documented and tested|Deploy container/static apps, PostGIS, storage and backup jobs with production collection disabled initially|No paid activation without approval; staging contains synthetic data only|03.09 00.09 10.03
Validate final research dataset and snapshots|Approved dataset reproduces counts and lists unresolved research limitations|Freeze reviewed revision set, run QA and retain exclusion/rights inventory|Targets unmet recorded honestly; no demo fixtures in real findings|11.05 11.06 08.10
Verify release readiness and demonstrate end to end|Public demonstration passes privacy, sources, accessibility, restore and performance gates|Release checklist and synthetic private capture plus real approved public evidence|Missing mandatory gate blocks release; no unlicensed media or invented results|11.08 10.10 10.11 11.03
Complete handover and maintenance ownership|Actual maintainers receive runbooks, costs, rights, recovery evidence and known limits|Owner-approved vault transfer, renewal schedule and standard final report|No imaginary support owner or untested restore claim|11.09''',
'''Build rich guided map tours|Approved ordered stops support accessible narrative and verified optional routes|Tour schema and map/list navigation with editorial sources|Unpublished stop skipped without exposing private content|11.09 07.09
Expand English Gujarati and Hindi localization|Fluent-reviewed UI/content/consent expansion preserves source language provenance|Translation catalogs, script fonts, search aliases and localized tests|Missing translation has labeled fallback; machine-only consent rejected|11.09 10.09
Analyze surveyed walkability and accessibility|Dated corridor audits expose rubric, coverage and access limitations|Verified crossings/footpath/shade geometry and evidence-linked analysis|No automated accessibility promise from incomplete map data|11.09 02.07
Create consented community audio archive|Approved recordings have transcripts, scope, credit and withdrawal lineage|Accessible media archive with restricted originals and reviewed derivatives|Revoked voice consent removes public audio and related transcript scope|11.09 06.09 09.10
Prototype clearly hypothetical future scenarios|Viewer labels proposals as illustrative ideas with assumptions and uncertainty|Separate scenario data/model from measured or official planning evidence|Scenario never rendered as official prediction or current fact|11.09 12.03
Evaluate advanced 3D data and performance|Evidence-backed feasibility decision covers licensed buildings/terrain and devices|MapLibre extrusion/terrain prototype with budget and non-WebGL fallback|No claim 3D geometry provides panoramic street coverage|11.09 06.08
Build privacy-safe reported-issue hotspot views|Hotspots reflect sampled reports and pass additional disclosure review|Coarse approved spatial aggregation with sensitivity/coverage notes|Low-n and filter differencing cannot expose interview points|11.09 08.07 08.09
Export approved research report and charts|Report contains cited snapshots, dates, denominators and sample caveats|Accessible PDF/CSV/SVG export from versioned public evidence|Suppressed cells remain suppressed; map attribution retained|11.09 09.09
Evaluate human-reviewed qualitative AI assistance|Only approved deidentified input can produce reviewed labeled draft themes|Privacy/model/vendor approval, human coding comparison and provenance|No raw interviews sent to external model or unsourced summaries auto-published|11.09 08.03 09.10'''
]
raw[4]+='\nCapture structured field observations separately from interviews|Researchers can save dated place-condition audits independently of respondent opinions|Implement observation rubric/version, visit-place linkage, mobile observation form and review state|Observation without a participant never creates a survey respondent or invented consent|04.03 02.06 03.04 01.09'
raw[5]+='\nImplement conditional approved external collection importer|If ODK or Kobo is selected, approved submissions import once with preserved consent GPS topics and form version|Map immutable source instance IDs to sync UUIDs, validate forms and subject links, quarantine incompatible rows; document not-applicable decision if PWA selected|Reimport creates no duplicate; subject geometry never substitutes interview GPS; unapproved vendor receives no data|05.01 05.04 04.02'
areas=['devops','frontend','gis','privacy','survey','offline','historical','frontend','analytics','admin','devops','devops','frontend']
types=['docs','design','feature','security','feature','feature','feature','feature','feature','feature','test','research','feature']
refs=['docs/product/requirements.md','docs/design/design-system.md','docs/architecture/gis-design.md','docs/architecture/privacy-security.md','docs/research/survey-questionnaire.md','docs/architecture/offline-sync.md','docs/research/historical-evidence.md','docs/design/public-website.md','docs/architecture/analytics.md','docs/design/admin-dashboard.md','docs/project/test-strategy.md','docs/operations/field-deployment.md','docs/project/release-plan.md']
users=['project contributor','public visitor','GIS reviewer','authorised team member','field researcher','field researcher','research editor','public visitor','research reader','research lead','quality reviewer','research lead','public research reader']
privacy=[
'Documentation contains no credentials, real participant records, invented approvals or exact interview coordinates.',
'Screens distinguish private capture from public reading; design examples must be clearly synthetic.',
'Only verified public place geometry can publish. Interview positions remain restricted even in GIS exports.',
'Deny by default and minimize retained personal data; current consent and scoped study grants are authoritative.',
'Raw answers and interview GPS remain private. Subject place is separately linked; consent refusal stops capture.',
'Local drafts are sensitive; protection, storage loss and offline revocation limitations must be explicit.',
'Dates, provenance, rights and identifiable-media/quote consent are independent publication requirements.',
'Consume only allowlisted published projection. No survey entry, private IDs, raw coordinates or original media.',
'Aggregate only eligible records; show valid denominators and enforce approved cohort/suppression policy.',
'Review access is study-scoped. Approval/revocation/export actions are audited and consent-compatible.',
'Tests use synthetic non-Makarba fixtures; CI artifacts must not contain real research data or credentials.',
'Real collection requires institutional gate, secure devices and consent. Public launch uses only approved evidence.',
'Stretch features cannot weaken core privacy, evidence, accessibility or rights controls.']

issues=[]
for m,block in enumerate(raw):
    for n,line in enumerate(block.splitlines(),1):
        title,scope,approach,edge,dep=line.split('|')
        key=f'{m:02d}.{n:02d}'; deps=[] if dep=='-' else dep.split()
        priority='P3' if m==12 else ('P0' if m in [0,3] or (m==5 and n in [1,2,3,4]) or (m==10 and n in [4,5,7]) else 'P1' if m in [2,4,5,9,10,11] else 'P2')
        status='status:blocked' if deps else 'status:ready'
        labels=[f'type:{types[m]}',f'area:{areas[m]}',f'priority:{priority.lower()}',status]
        if m==12: labels+=['stretch-goal']
        if m==11 or key in ['02.02','04.07','04.08','05.09','10.12']: labels+=['field-validation-required']
        if key in ['00.11','05.01','03.07','08.09','09.08','11.09']: labels+=['milestone-blocker']
        size='S' if m in [0,1] or key in ['02.03','06.08'] else 'M'
        issue=dict(id=key,title=f'[{areas[m].upper()}] {title}',milestone=f'M{m:02d} — {milestone_titles[m]}',milestone_key=f'M{m:02d}',summary=scope,approach=approach,edge=edge,dependencies=deps,priority=priority,size=size,labels=labels,doc=refs[m],user=users[m],privacy=privacy[m])
        issues.append(issue)

def body(i, mapping=None):
    def link(k):
        if mapping and k in mapping: return f"#{mapping[k]['number']} ({k})"
        return k
    deps='; '.join(link(k) for k in i['dependencies']) or 'No issue blockers; verify repository access and planning baseline'
    return f'''<!-- makarba-catalog-id:{i['id']} -->
### Summary
{i['summary']}.

### Why this is needed
{i['title'].split('] ',1)[1]} enables the {i['milestone'].split(' — ',1)[1].lower()} workstream while preserving the researcher-led evidence chain. Without this deliverable: {i['edge'][0].lower()+i['edge'][1:]} is not established or verified.

### User story
As a {i['user']}, I need this reviewed capability so that {i['summary'][0].lower()+i['summary'][1:]}.

### Scope
- {i['summary']}.
- Implement/review the associated contract and observable error states described in `{i['doc']}`.
- Capture evidence for the negative case: {i['edge']}.

### Out of scope
Other backlog issue deliverables, unrelated refactors, real data committed to Git, and unapproved paid-provider activation. Planning/design/research issues produce reviewed artifacts rather than application code; implementation issues build only the stated capability.

### Technical approach
{i['approach']}. Follow `{i['doc']}`, `docs/architecture/data-model.md` and the relevant ADR. Keep migrations, runtime validation and UI contracts consistent where this task changes them. Document a justified alternative before changing architecture.

### Data and privacy considerations
{i['privacy']} Do not copy sensitive inputs into issue comments, test artifacts or operational logs.

### Dependencies
{deps}. Blockers require verified completion evidence before implementation. External institutional/provider gates in the linked documents remain effective even when issue blockers close.

### Implementation steps
1. Read linked design, verify blocker evidence and identify the exact files/contracts affected.
2. {i['approach']}.
3. Cover the positive contract “{i['summary']}” and failure condition “{i['edge']}”.
4. Update the linked documentation and record verification commands/results or reviewed research evidence in the PR.

### Acceptance criteria
- [ ] {i['summary']}.
- [ ] {i['edge']}.
- [ ] The PR includes a reproducible demonstration or independently reviewable artifact proving the stated contract, with no real participant data.
- [ ] Associated permissions, lifecycle/error states and source limitations are documented in `{i['doc']}`.

### Required tests
- Positive contract: demonstrate {i['summary'][0].lower()+i['summary'][1:]} using an explicit fixture/checklist and expected outcome.
- Negative/edge contract: verify “{i['edge']}” with a failing-path fixture or documented independent review.
- {'Document review: check source citations, traceability and concrete acceptance evidence; no mirror-of-document unit tests.' if i['milestone_key'] in ['M00','M01'] else 'Run relevant domain unit checks and API/database/browser or real-device checks for the components changed; record exact commands, fixtures and expected versus actual results.'}
- Privacy check: {i['privacy']}

### Edge cases
{i['edge']}. Also inspect absent/retired source data, unauthorized access where applicable, interrupted operation, and stale revision rather than substituting fabricated values or silently dropping work.

### Documentation
Update `{i['doc']}` and any affected requirements/ADR/test case. Record verification evidence, unresolved external dependency and compatibility/rollback impact in the implementation report.

### Definition of Done
All acceptance boxes have evidence; relevant tests/reviews pass; changes stay within scope; security/privacy and source accuracy are reviewed; documentation is current; PR/commit and CI results are linked. Compilation alone is insufficient. Follow `docs/project/definition-of-done.md`.

### Priority
{i['priority']} — {'release/privacy/foundation blocker' if i['priority']=='P0' else 'core delivery sequence' if i['priority']=='P1' else 'public experience/content delivery' if i['priority']=='P2' else 'optional after core release'}.

### Size
{i['size']} — {'one focused reviewed planning/design artifact' if i['size']=='S' else 'one bounded capability and its contract/failure checks; split if review reveals more than one independent behavior'}.

### Labels
{', '.join(i['labels'])}.

### Milestone
{i['milestone']}
'''

def render(mapping=None):
    for i in issues: put('docs/project/issues/'+i['id']+'.md', body(i,mapping))
    catalog=[]
    for i in issues:
        item=dict(i); item['body_path']='docs/project/issues/'+i['id']+'.md'
        if mapping and i['id'] in mapping: item.update(github=mapping[i['id']],dependency_numbers=[mapping[d]['number'] for d in i['dependencies']])
        catalog.append(item)
    # JSON is a strict YAML 1.2 subset and avoids an additional runtime dependency.
    put('docs/project/issue-catalog.yaml',json.dumps(catalog,ensure_ascii=False,indent=2))
    lines=['# Issue index','',f'{len(issues)} focused issues: the supplied minimum inventory totals 133; separate ethics/legal, structured observation and conditional fallback-import tasks make 136. No product issue is completed by this planning run. Stable IDs make publishing resumable.','']
    for m,title in enumerate(milestone_titles):
        lines += [f'## M{m:02d} — {title}','']
        for i in issues:
            if i['milestone_key']==f'M{m:02d}':
                target=mapping[i['id']]['url'] if mapping and i['id'] in mapping else 'issues/'+i['id']+'.md'
                lines.append(f"- [{i['id']} {i['title']}]({target}) — {i['priority']}; blockers: "+(', '.join(('#'+str(mapping[d]['number'])) if mapping and d in mapping else d for d in i['dependencies']) or 'none'))
        lines.append('')
    put('docs/project/issue-index.md','\n'.join(lines))
    deps={i['id']:dict(issue=mapping.get(i['id']) if mapping else None,blockers=[dict(id=d,number=mapping[d]['number'] if mapping and d in mapping else None) for d in i['dependencies']]) for i in issues}
    put('docs/project/issue-dependencies.json',json.dumps(deps,indent=2))
    # Kahn order / longest path, with unit weights (not estimated durations).
    by={i['id']:i for i in issues}; done=[]; paths={}
    while len(done)<len(issues):
        ready=[i for i in issues if i['id'] not in done and all(d in done for d in i['dependencies'])]
        if not ready: raise ValueError('cycle or missing dependency')
        for i in ready:
            prefix=max((paths[d] for d in i['dependencies']),key=len,default=[])
            paths[i['id']]=prefix+[i['id']]; done.append(i['id'])
    core=max((paths[i['id']] for i in issues if i['milestone_key']!='M12'),key=len)
    fmt=lambda k: '#'+str(mapping[k]['number']) if mapping and k in mapping else k
    text='''Milestones overlap and are not a strict numbered waterfall: foundational M03 database grant design precedes M02 provisioning; M08 disclosure policy and M09 publication precede M07 live public API. Implementation DAG is authoritative; a milestone containing early and late work must not be treated as a single atomic dependency node.

```mermaid
flowchart LR
 M00 --> M01
 M00 --> M03
 M03 --> M02
 M01 --> M02
 M02 --> M04
 M03 --> M04
 M04 --> M05
 M05 --> M06
 M04 --> M09
 M06 --> M09
 M09 --> M08
 M08 --> M07
 M09 --> M07
 M07 --> M10
 M05 --> M10
 M10 --> M11
 M11 --> M12
```

Diagram is the coarse delivery-gate graph, not a substitute for issue edges (e.g. M08 eligibility requires early M09 review; M09 export requires later M08 suppression). Do not add blanket milestone edges to the issue graph.

Machine-readable complete edges: issue-dependencies.json. Every issue body links its actual blockers. Initial blocked status means dependencies await implementation, not a tool failure. Independent early workstreams after requirements: identity/grants, visual design, source/licence research and offline feasibility; later content collection, map presentation and field forms parallelize only after their listed dependencies.

Earliest safe implementation order (topological, not dates):

'''+ ' → '.join(fmt(k) for k in done)+ '\n\nLongest core dependency chain by issue count (no durations supplied, so this is a structural critical path, not a calendar estimate):\n\n'+' → '.join(fmt(k) for k in core)+ '\n\nMVP A/B/C and stretch scope: release-plan.md. First implementation verifies foundation issue '+fmt('00.01')+'; existing planning work is reviewed as evidence before closing, not automatically marked implemented.\n'
    doc('project/issue-dependencies.md','Dependencies, workstreams and critical path',text)
    return core

milestones=[]
for m,title in enumerate(milestone_titles):
    subset=[i for i in issues if i['milestone_key']==f'M{m:02d}']
    ext=sorted({d for i in subset for d in i['dependencies'] if not d.startswith(f'{m:02d}.')})
    scope='; '.join(i['title'].split('] ',1)[1] for i in subset)
    desc=f'''Objective: deliver {title.lower()}.
Research/business value: {'safe reproducible research' if m in [0,3,4,5,8,9,10,11] else 'clear evidence-led exploration'}.
Scope: {scope}.
Entry requirements/dependencies: issue-level blockers {', '.join(ext) or 'repository access and source blueprint'}; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all {len(subset)} assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: {'unapproved institution/provider dependency or uncertain field evidence' if m in [0,2,5,6,11,12] else 'contract drift, privacy regressions and device/accessibility limitations'}.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.'''
    milestones.append(dict(key=f'M{m:02d}',title=f'M{m:02d} — {title}',description=desc))
put('docs/project/milestones.json',json.dumps(milestones,ensure_ascii=False,indent=2))
doc('project/milestones.md','Milestone specifications','No committed dates. Issue-level dependencies govern overlapping milestones.\n\n'+'\n\n'.join('## '+x['title']+'\n\n'+x['description'] for x in milestones))

if __name__=='__main__':
    render(); print(f'Generated {len(issues)} issue specifications and {len(milestones)} milestones')
