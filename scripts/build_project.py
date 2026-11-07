from build_planning import ROOT, put, doc
from build_backlog import issues, milestone_titles
import json

requirements=[
('R01','Researcher-led participation; no public submission','M00 M03 M04 M07','00.03 00.06 04.04 07.01 07.10','P/F/A'),
('R02','Verified study boundary, categories and source-dated point/line/polygon map','M02 M09 M11','00.05 02.02 02.05 02.06 02.07 09.06 11.03','P02 P03 A06'),
('R03','Desktop map-first, mobile bottom sheet, search/filters/clustering/highlight/list fallback','M01 M02 M07','01.04 01.05 02.08 07.03 07.04 07.05 07.11','P02 P03 P04'),
('R04','Place profiles, condition observations, evidence, photos and last review','M06 M07','06.01 06.02 07.06 07.07','P05'),
('R05','Dated licensed Then & Now, matching viewpoint, history precision and timelines','M06','06.03 06.04 06.05 06.06','P06 A07'),
('R06','Real owned panoramas, third-party licence/cost review, honest fallback and optional 3D','M06 M07 M12','06.07 06.08 07.08 12.06','P07'),
('R07','Secure login, scoped roles, visits, assignments and researcher training','M03 M04 M11','03.01 03.02 03.03 03.04 04.03 11.01','F01 F02 F03 A02'),
('R08','Informed consent, separate publication scopes and no-response termination','M00 M03 M04','00.11 03.06 04.06','F04 A04'),
('R09','Versioned stakeholder/association/visit/rating/issues/change/improvement questions; missing/branch handling','M04','04.01 04.02 04.05 04.10','F05 F08 A11'),
('R10','Independent private interview point and multi-subject topic geometry links','M04 M08','04.09 08.06 10.06','F06 F07 F10'),
('R11','GPS permission/quality/times/manual provenance/recapture/out-of-area review; never fabricate','M04 M09 M10','04.07 04.08 09.05 10.06','F06 A05'),
('R12','Protected offline drafts, lock/recovery limits, stable IDs, transactional idempotency/conflicts','M05','05.01 05.02 05.03 05.04 05.05 05.06 05.09','F10 F11'),
('R13','Secure media upload/rights/EXIF stripping/redaction, resumable partial failures','M05','05.07 05.08','F09 A07'),
('R14','Review, corrections, duplicates, own history and candidate location approval','M04 M09','04.12 09.04 09.05 09.06','F12 F13 A04 A06'),
('R15','Distinct observations, opinions, historical claims, verified facts and official attribution','M04 M06 M09','04.05 06.03 06.09 09.07','P08 A07'),
('R16','Independent publication approval, allowlisted public projection, invalidation and withdrawal','M07 M09','07.10 09.08 09.10','A08 A10'),
('R17','Valid-answer counts, stakeholder/issues/rating/change/place analysis, reproducibility and caveats','M08','08.01 08.02 08.03 08.04 08.05 08.06 08.10','P09'),
('R18','Safe coverage and small-group/complementary suppression with constrained filters','M08','08.07 08.08 08.09','P09'),
('R19','Audit, responsible exports, account administration, retention and backup restore','M03 M09 M10','03.08 09.02 09.09 09.10 10.11','A02 A09 A10 A12'),
('R20','Accessibility AA, reduced motion, English/Gujarati core and Hindi expansion','M01 M07 M10 M12','01.01 01.09 07.12 10.09 12.02','P13/all'),
('R21','Methodology, citations, credits, ethics/legal gate and real field SOP/sampling','M00 M07 M11','00.04 00.11 07.12 11.01 11.05 11.06','P11 P12'),
('R22','Deployment, local Windows setup, secret management, observability/costs and maintenance','M00 M03 M11','00.10 03.09 11.07 11.10','A12'),
('R23','Unit/API/spatial/privacy/GPS/offline/browser/device/performance/security quality gates','M10','10.01 10.02 10.03 10.04 10.05 10.06 10.07 10.08 10.09 10.10 10.12','all'),
('R24','Field pilot, verified dataset, public demo, final report and handover','M11','11.02 11.03 11.04 11.08 11.09 11.10','all'),
('R25','Guided tours, walkability, audio archive, hypothetical scenarios, hotspots, report export, human-reviewed AI','M12','12.01 12.03 12.04 12.05 12.07 12.08 12.09','P10/P09')]
doc('product/requirements.md','Requirements register','''Normative source: user prompt plus supplied 23-page blueprint. Requirements below are decomposed into 134 focused issue contracts. All capabilities are proposed; evidence/approvals not yet obtained. Core release is A/B/C, R25 is stretch except basic story navigation; R20 requires localization infrastructure and approved core English/Gujarati scripts, Hindi is optional. Every functional requirement must be tested positively and against its relevant privacy/failure condition.

| ID | Requirement | Workstreams | Stable issue IDs | Screens |
|---|---|---|---|---|
'''+ '\n'.join('| '+' | '.join(r)+' |' for r in requirements)+'''

Non-functional register (provisional engineering targets, not achieved results):

| ID | Target | Test setup / release evidence |
|---|---|---|
| N01 | No anonymous raw-data access or public interview writes | All public routes/roles, error paths, caches and exports tested with forbidden-field schemas |
| N02 | Concurrent sync retries cause exactly one logical write | 10 concurrent identical sends plus lost response; one receipt and consistent revision |
| N03 | Durable local-save acknowledgement only after transaction | App restart, quota failure, denied persistence and device/key-loss drills |
| N04 | WCAG 2.2 AA target | axe plus NVDA/VoiceOver keyboard, 200% zoom/320px reflow and actual palette checks |
| N05 | LCP ≤2.5s and usable first map/list ≤4s target | Mid-tier Android, measured 4G profile, 30 places + representative road layer; report p75 field/lab distinction |
| N06 | Bounded public queries p95 ≤500ms at 20 concurrent reads | Published fixture with 30 places/120 interviews worth of snapshots, excludes tile/provider time |
| N07 | No lost acknowledged server write on retry | DB transaction fault injection, worker restart and duplicate upload tests |
| N08 | RPO ≤24h, RTO ≤8h target | Isolated encrypted restore with tombstone replay; actual times recorded |
| N09 | Core supported Android Chrome/iOS Safari and desktop current major browsers | Record actual versions/devices at pilot; GPS/offline constraints cannot be inferred from emulation |
| N10 | Maintainable student-operated deployment | One modular API/worker codebase, repeatable migrations, supported dependency lockfile and runbooks |

Assumptions requiring confirmation: institutional approver/contact, actual team availability, verified boundary/places, recruitment/age policy, approved retention and disclosure thresholds, device fleet, budget/host region, media/source rights and survey translations. No dates committed. Paid integrations default disabled. No exact location facts or current conditions asserted. No online public surveys. Raw GPS never public.''')

pages=[
('Identity and critical participation rule','R01 R21','product/vision.md','00.03 07.01'),
('Private collection to public results overview','R01 R10 R16','architecture/overview.md','04.09 07.10 09.08'),
('Participatory method, questions, boundary','R02 R21','research/methodology.md','00.04 00.05 02.02'),
('Roles and team field workflow','R07 R08 R14','product/personas.md','03.04 04.03 11.01'),
('Public map-first pages and no survey entry','R03 R20','design/public-website.md','01.02 07.01 07.11'),
('Map layers, place details and candidates','R02 R03 R04','architecture/gis-design.md','02.05 02.06 02.07 07.06'),
('Then & Now and realistic panoramas','R05 R06','architecture/media-pipeline.md','06.05 06.06 06.07 06.08'),
('Core field survey and two positions','R08 R10 R12','architecture/offline-sync.md','04.09 05.01 05.04'),
('GPS metadata quality and privacy','R10 R11','research/gps-protocol.md','04.07 04.08 03.07'),
('Questionnaire A–D and official verification','R08 R09 R15','research/survey-questionnaire.md','04.01 04.05 04.10'),
('Explicitly fictional sample and evidence separation','R10 R15 R17','research/methodology.md','04.09 08.01 06.09'),
('Before/during/after field visit','R13 R21','research/field-visit-sop.md','11.01 05.08'),
('Suggested three-pass sample and targets','R21 R24','research/sampling-plan.md','00.04 11.02 11.08'),
('Researcher/admin screens and offline fallback','R07 R12 R14','product/screen-inventory.md','01.09 01.10 05.01 09.04'),
('Insights metrics, safe coverage and counts','R17 R18','architecture/analytics.md','08.01 08.07 08.09 08.10'),
('Stack and shared backend','R22','architecture/overview.md','00.09 00.10'),
('Core relational model','R09 R10 R19','architecture/data-model.md','02.01 04.01 04.09'),
('Visual identity, localization and stretch scope','R03 R20 R25','design/design-system.md','01.01 12.01 12.02 12.03 12.05 12.08'),
('Privacy consent ethics and disputed accounts','R08 R15 R16 R18 R19 R21','architecture/privacy-security.md','00.11 03.06 09.10 08.09'),
('Build phases and critical tests','R23 R24','project/test-strategy.md','10.04 10.05 10.07 11.09'),
('Demonstration and final deliverables','R24','project/release-plan.md','11.08 11.09 11.10'),
('Ready field checklist and definition','R21 R24','research/field-visit-sop.md','11.01 11.05'),
('Technical references and assumptions','R06 R12 R22','source/technical-references.md','00.09 05.01 06.08')]
def trace(mapping=None):
    def links(keys):
        return ', '.join(f"[#{mapping[k]['number']}]({mapping[k]['url']})" if mapping and k in mapping else k for k in keys.split())
    doc('project/traceability-matrix.md','Source to requirements to issues','''All 23 blueprint pages were read. Prompt requirements are additionally registered in requirements.md, including legal/ethics gate, detailed sync/API/public projection, governance and remote verification. No requirement is attributed to an unseen page.

| PDF page | Section / content | Requirements | Component/document | Development issues |
|---|---|---|---|---|
'''+ '\n'.join(f'| {n} | {s} | {r} | [{p}](../{p}) | {links(k)} |' for n,(s,r,p,k) in enumerate(pages,1))+'''

Full requirement-level issue coverage:

| Requirement | Issue links |
|---|---|
'''+ '\n'.join(f'| {r[0]} | {links(r[3])} |' for r in requirements)+'''

N01–N03/N07 map to M03/M05/M10 negative and fault tests; N04 to 10.09; N05/N06 to 10.10; N08 to 10.11; N09 to 10.12; N10 to 00.10/11.07/11.10. Blueprint p8 encryption is an aspiration subject to ADR-004 feasibility, never a claim browser storage is encrypted. P13 collection sequence is not a deadline. P11 fictional responses are excluded from all real datasets.''')
trace()

doc('architecture/analytics.md','Analytics and public projection contract','''Input eligibility: submitted current interview revision, lead-reviewed/approved, valid research and aggregate consent, not withdrawn/rejected/duplicate, known immutable questionnaire version. Use per-topic answers only for their explicitly discussed place. Raw position is used only for private coverage processing; public place rating is not inferred from capture spot.

| Metric | Numerator / base | Missingness rule |
|---|---|---|
| Interview count | Distinct eligible interview UUIDs | Separate total collected from eligible analyzed |
| Stakeholder distribution | Distinct eligible by category / known or explicit category base | Show refused/unknown separately as policy permits |
| Rating distribution | Count 1–5 / valid numeric answers per subject/question | Unsure/refused/not-asked excluded from numeric base, counted separately |
| Perceived change | Better/worse/same / valid applicable responses | Do-not-know/short association separate, no measured-change claim |
| Reported issues | Selected or human-coded issue occurrences / responding interviews or topics, clearly named | Multi-select may sum >100%; coding provenance retained |
| Improvements/themes | Human-reviewed codebook counts / valid coded answers | Optional blank not counted as no concerns |
| Place comparisons | Per-topic valid answers with distinct respondent count | Cross-place totals overlap; no false independent population sample |
| Coverage | Eligible interview positions grouped in approved coarse grid | Missing/poor/out-of-area handled by recorded policy, no raw pin |

Each snapshot pins input revision hash, survey versions/concept mapping, codebook, policy version, period, numerator/base, valid n, missing/unsure/excluded counts and caveat. Do not pool incompatible instruments without explicit reviewed mapping. Counts are convenience-sample findings, not population estimates. Charts display accessible table, question/period/n and limits; downloadable chart preserves metadata.

Disclosure policy: provisional k≥5 for all releasable cohorts and grid cells; complementary suppression, totals and intersecting date/group/place filters tested against reconstruction. Only fixed reviewed cohorts/date windows, no arbitrary query builder. Publication fails closed when policy cannot approve. Threshold/grid alone does not guarantee anonymity; institutional review and contextual assessment required. Tiny official cohorts may need whole comparison withheld. Raw precise times/researcher identities never emitted.

Worker computes private candidate snapshot → disclosure check → independent review → immutable public payload; allowlisted columns only. Public coverage geometry is a broad approved cell, not point jitter or raw centroid. Withdrawal/revision invalidates affected snapshots and cache keys before new publication; jobs verify current input/consent revision at commit so race cannot republish revoked material. Reproducible independent synthetic expected counts test all exclusion and overlap cases.''')

tests=[
('Interview at A discusses B','Capture synthetic A and choose distinct B','Private point=A, topic link=B, B rating only; no public A'),
('GPS permission denied','Deny prompt before acquisition','Explicit denied status; approved null/manual fallback; no invented fix'),
('Poor accuracy','Return >50m reported estimate','Low-quality flag and recapture/review, not exact-position claim'),
('Manual correction','Move pin with stated reason','Raw fix immutable; effective point/manual provenance retained, no fake accuracy'),
('Online start offline finish','Disconnect mid interview and restart app','Acknowledged local draft recovers; no false synced badge'),
('Retry identical survey','Lose server response and resend same key/hash','Same receipt and single logical interview write'),
('Concurrent sync','Send 10 simultaneous same-key operations','One transaction effect; consistent receipt, no duplicate audit effect'),
('No publication permission','Research-only consent and attempted identifiable story','Private research may remain under approved scope; story/media publication denied'),
('Anonymous raw request','GET raw interview/GPS with no session','401/403 or safe not-found; no sensitive payload/log/cache'),
('Researcher invokes admin action','Valid collector session calls role-grant endpoint','403, no mutation; security audit metadata'),
('Deleted/unpublished subject','Archive selected place before sync','Reference preserved or explicit review-required error; no silent relink/public leak'),
('Missing or unsure answer','Submit null with unsure/refused/not_asked reasons','Not numeric zero; denominator/exclusion rules correct'),
('Tiny stakeholder cohort','Attempt category/date/place filter differencing','Unsafe cohort and complementary reconstruction suppressed'),
('Undated historical photo','Comparison lacks verified date/source','Pair stays unpublished; honest unavailable state'),
('Panorama unavailable','404/provider denial/WebGL loss','Static approved photo/text with date/source; no false continuous coverage'),
('Outside study area','Capture outside verified polygon/at edge','Outside flag; boundary edge policy tested; lead review, no auto-snap'),
('Half media upload','Interrupt upload before completion then retry','Interview preserved, asset private/pending; digest checked after resume'),
('Official claim unverified','Choose official category without verification','Label claim pending; no official attributed statement'),
('Participant withdrawal','Withdraw while publication job retries and after restore','Affected public content invalidated; job cannot republish; tombstones replay'),
('Invalid/unpublished chart input','Include rejected/duplicate/withdrawn/unreviewed records','Only eligible approved current records counted; exclusions explicit')]
doc('project/test-strategy.md','Test strategy and explicit expected results','''This is a future executable test specification; product tests have not run in planning. Use synthetic coordinates outside Makarba and fictional nonidentifying answers marked test-only. Test fixtures are not research results. Unit: validation/consent/quality/counting; integration: actual PostGIS, grants, transactions, upload quarantine; browser: Playwright; accessibility: axe + manual; device: physical Android/iOS with network faults.

| Case | Reproduction / fixture | Expected result |
|---|---|---|
'''+ '\n'.join(f'| T{n:02d}: {a} | {b} | {c} |' for n,(a,b,c) in enumerate(tests,1))+'''

Additional gates: empty/upgrade migration, same operation key changed payload 409, revoked account sync, unknown questionnaire branch, storage quota/eviction/key loss, CSV formula injection, image polyglot/malware, EXIF metadata stripping, stale publication revision, failed backup and unsupported translation. Run negative tests before exposure; do not rely only on snapshots mirroring implementation.

Each test report records issue/commit, fixture, environment/device/version, command or manual steps, expected/actual result, artifact and limitation. CI gates selected domain tests, integration/privacy regressions, type/lint, secret/dependency scans and browser checks when available; required checks are configured only after real workflows exist. Performance uses N05/N06 fixtures, does not mix provider tile latency with API latency. Field/device/security/restore gates need evidence beyond passing compilation. Code changes trigger relevant checks; do not repeatedly run unrelated suites without new risk.''')

doc('project/roadmap.md','Implementation roadmap','''Planning run creates the architecture/backlog, not the software. No deadlines or team assignments are assumed. Start by reviewing M00 artifacts against issue acceptance evidence, then establish development scaffold. Use issue-dependencies.md and JSON DAG rather than numbered milestone order.

Release A: requirements/contracts, development infrastructure, least-privilege database, verified study extent, map base and secure identity foundations. Release B: researcher visit/consent/versioned questions/GPS + separate subjects, protected local drafts, idempotent sync and private moderation. Real data requires institutional/legal and offline risk gates. Release C: approved public projection, place pages/photos/history/panoramas where supported, safe insights/methodology, quality/restore/device pilot and handover. M12 is optional after C; unavailable historical/provider evidence must be disclosed, not fabricated.

Independent streams: visual design and historical source/licence research can proceed alongside backend/identity and offline feasibility once requirements stabilize. GIS validation can proceed once grants/schema are ready; media and question UI share stable contracts. Public shell can use synthetic DTO fixtures while publication/privacy service is built; live public data waits for those dependencies. Do not introduce blanket milestone dependencies that create cycles across early/late subwork.

The supplied inventory totals 133 issues, slightly above the approximate 100–130 suggestion; keeping each requested task separate and adding a necessary ethics/legal gate yields 134. Detailed acceptance/edge/test contracts are local Markdown and GitHub issues; no vague epic substitutes.''')
doc('project/release-plan.md','Release strategy and gates','''| Release | Included scope | Exit evidence |
|---|---|---|
| A — Technical foundation | M00 baseline, M01 essential frames, M02 core spatial foundation, M03 identity/grants/secrets, M10 initial harness | Clean Windows local startup using synthetic data; migration/grant/geometry tests; map renders; secure role boundaries; ADRs reviewed |
| B — Working private field MVP | M04, M05, essential M09 moderation/corrections, privacy/negative/GPS/offline/device tests | Authorised researcher signs in, starts visit/interview, gets consent, captures independent GPS, chooses subjects, records/reviews/saves, syncs once and submits privately; offline selection validated; ethics/legal gate before real data |
| C — Public demonstration | M06–M09 approved content/analytics, M10 quality, M11 pilot/launch/handover | Verified map/places, licensed photos, available panoramas, dated comparisons, legitimate safe aggregates and methodology; actual release/privacy/restore/device/accessibility evidence |
| Advanced | M12 | Core gates retained; separate feasibility/rights/privacy approvals |

Release A can use synthetic non-Makarba geometries; actual study boundary is a field-data publication gate. Release B can be demonstrated synthetically before institutional approval, never real participant collection. If PWA feasibility fails, approved ODK/Kobo collection/import must preserve all critical metadata, separate subject mapping and consent before B acceptance. No alternate tool silently relaxes privacy.

C evidence gaps are explicit: no invented 2021 photos, results or coordinates; target counts are estimates. A public demo without real approved evidence must be clearly a technical preview, and cannot claim completed research release. Production launch requires source/licence, disclosure, consent and backup gates. Source-repository public visibility is a separate owner decision after security/privacy/licence review.''')
doc('project/definition-of-done.md','Definition of Done and implementation reports','''For each issue: dependency evidence checked; approved scope satisfied; acceptance checklist proven by reproducible artifact; relevant positive/negative tests pass; security/privacy/consent/source accuracy reviewed; migration/rollback and compatibility documented; no secrets/real records in Git; documentation current; reviewable PR references issue; CI inspected and findings fixed. Respect required checks/branch protection and session merge authorization; confirm merged commit before issue closure. Planning artifacts alone do not prove implemented features.

Standard report:

```text
Issue: <real number/URL>
Branch: <issue branch>
Commit: <SHA>
PR: <real URL>
Changes: <scope and outcome>
Tests: <commands/fixtures/environment, expected vs actual>
Security review: <permissions, data exposure, consent/media effects>
Limitations: <remaining external dependencies or supported-device limits>
Verdict: PASS / FIX REQUIRED / BLOCKED
```

Workflow: read issue/architecture → verify blockers → branch → implement scoped change → tests → docs → commit/push → PR → inspect CI → review/fix → merge only when authorised/checks allow → verify merge → close with evidence → update roadmap. Do not bypass failed checks, self-certify missing research approvals or label compilation as completion.''')
doc('project/risks.md','Risk and decision register','''| Risk/assumption | Impact | Mitigation / unresolved owner gate |
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

All owners are role requirements, not assigned fictitious people. Open questions belong in their issue and gate; no committed dates. Automatic readiness labels must be refreshed when dependencies close; initial blocked labels reflect the current unimplemented backlog.''')

put('.github/PULL_REQUEST_TEMPLATE.md','''## Problem and resulting behavior
Closes #<issue>

## Changes and dependency evidence

## Validation
Commands/fixtures, expected vs actual, CI and manual/device evidence.

## Security, privacy and evidence review
Public/private boundary, consent, GPS, media/source rights, migrations/backout.

## Limitations and implementation report
Issue / Branch / Commit / PR / Tests / Verdict PASS, FIX REQUIRED or BLOCKED.
''')
put('.github/ISSUE_TEMPLATE/task.yml','''name: Focused development or research task
description: Define a bounded, reviewable task using the project contract
body:
  - type: textarea
    id: contract
    attributes:
      label: Task contract
      description: Include Summary, Why, User story, Scope, Out of scope, Technical approach, Data/privacy, Dependencies, Steps, Acceptance, Tests, Edge cases, Documentation, DoD, Priority, Size, Labels and Milestone.
    validations:
      required: true
''')
put('.github/ISSUE_TEMPLATE/config.yml','blank_issues_enabled: false')
put('.github/workflows/planning.yml','''name: Planning integrity
on: [push, pull_request]
permissions:
  contents: read
jobs:
  planning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: python scripts/verify_planning.py --local
''')
print('Requirements, traceability and project controls generated')
