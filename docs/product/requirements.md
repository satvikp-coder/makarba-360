# Requirements register

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Normative source: user prompt plus supplied 23-page blueprint. Requirements below are decomposed into 136 focused issue contracts. All capabilities are proposed; evidence/approvals not yet obtained. Core release is A/B/C, R25 is stretch except basic story navigation; R20 requires localization infrastructure and approved core English/Gujarati scripts, Hindi is optional. Every functional requirement must be tested positively and against its relevant privacy/failure condition.

| ID | Requirement | Workstreams | Stable issue IDs | Screens |
|---|---|---|---|---|
| R01 | Researcher-led participation; no public submission | M00 M03 M04 M07 | 00.03 00.06 04.04 07.01 07.10 | P/F/A |
| R02 | Verified study boundary, categories and source-dated point/line/polygon map | M02 M09 M11 | 00.05 02.02 02.05 02.06 02.07 09.06 11.03 | P02 P03 A06 |
| R03 | Desktop map-first, mobile bottom sheet, search/filters/clustering/highlight/list fallback | M01 M02 M07 | 01.04 01.05 02.08 07.03 07.04 07.05 07.11 | P02 P03 P04 |
| R04 | Place profiles, condition observations, evidence, photos and last review | M06 M07 | 06.01 06.02 07.06 07.07 | P05 |
| R05 | Dated licensed Then & Now, matching viewpoint, history precision and timelines | M06 | 06.03 06.04 06.05 06.06 | P06 A07 |
| R06 | Real owned panoramas, third-party licence/cost review, honest fallback and optional 3D | M06 M07 M12 | 06.07 06.08 07.08 12.06 | P07 |
| R07 | Secure login, scoped roles, visits, assignments and researcher training | M03 M04 M11 | 03.01 03.02 03.03 03.04 04.03 11.01 | F01 F02 F03 A02 |
| R08 | Informed consent, separate publication scopes and no-response termination | M00 M03 M04 | 00.11 03.06 04.06 | F04 A04 |
| R09 | Versioned stakeholder/association/visit/rating/issues/change/improvement questions; missing/branch handling | M04 | 04.01 04.02 04.05 04.10 | F05 F08 A11 |
| R10 | Independent private interview point and multi-subject topic geometry links | M04 M08 | 04.09 08.06 10.06 | F06 F07 F10 |
| R11 | GPS permission/quality/times/manual provenance/recapture/out-of-area review; never fabricate | M04 M09 M10 | 04.07 04.08 09.05 10.06 | F06 A05 |
| R12 | Protected offline drafts, lock/recovery limits, stable IDs, transactional idempotency/conflicts | M05 | 05.01 05.02 05.03 05.04 05.05 05.06 05.09 | F10 F11 |
| R13 | Secure media upload/rights/EXIF stripping/redaction, resumable partial failures | M05 | 05.07 05.08 | F09 A07 |
| R14 | Review, corrections, duplicates, own history, independent observations and candidate location approval | M04 M09 | 04.12 04.13 09.04 09.05 09.06 | F12 F13 F14 A04 A06 |
| R15 | Distinct observations, opinions, historical claims, verified facts and official attribution | M04 M06 M09 | 04.05 06.03 06.09 09.07 | P08 A07 |
| R16 | Independent publication approval, allowlisted public projection, invalidation and withdrawal | M07 M09 | 07.10 09.08 09.10 | A08 A10 |
| R17 | Valid-answer counts, stakeholder/issues/rating/change/place analysis, reproducibility and caveats | M08 | 08.01 08.02 08.03 08.04 08.05 08.06 08.10 | P09 |
| R18 | Safe coverage and small-group/complementary suppression with constrained filters | M08 | 08.07 08.08 08.09 | P09 |
| R19 | Audit, responsible exports, account administration, retention and backup restore | M03 M09 M10 | 03.08 09.02 09.09 09.10 10.11 | A02 A09 A10 A12 |
| R20 | Accessibility AA, reduced motion, English/Gujarati core and Hindi expansion | M01 M07 M10 M12 | 01.01 01.09 07.12 10.09 12.02 | P13/all |
| R21 | Methodology, citations, credits, ethics/legal gate and real field SOP/sampling | M00 M07 M11 | 00.04 00.11 07.12 11.01 11.05 11.06 | P11 P12 |
| R22 | Deployment, local Windows setup, secret management, observability/costs and maintenance | M00 M03 M11 | 00.10 03.09 11.07 11.10 | A12 |
| R23 | Unit/API/spatial/privacy/GPS/offline/browser/device/performance/security quality gates | M10 | 10.01 10.02 10.03 10.04 10.05 10.06 10.07 10.08 10.09 10.10 10.12 | all |
| R24 | Field pilot, verified dataset, public demo, final report and handover | M11 | 11.02 11.03 11.04 11.08 11.09 11.10 | all |
| R25 | Guided tours, walkability, audio archive, hypothetical scenarios, hotspots, report export, human-reviewed AI | M12 | 12.01 12.03 12.04 12.05 12.07 12.08 12.09 | P10/P09 |

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

Assumptions requiring confirmation: institutional approver/contact, actual team availability, verified boundary/places, recruitment/age policy, approved retention and disclosure thresholds, device fleet, budget/host region, media/source rights and survey translations. No dates committed. Paid integrations default disabled. No exact location facts or current conditions asserted. No online public surveys. Raw GPS never public.

Governance (issue #1): branch/PR rules, vacant roles, absence of a source licence and the planning-only boundary are recorded in `docs/project/governance.md`; `scripts/check_governance.py` rejects invented contacts or licences. Main branch protection is not yet enabled.

Capability matrix (issue #6, PROPOSED — awaiting stakeholder approval): `docs/project/capability-matrix.md`; permission failures return authorisation errors, never partial raw data; admin alone has no research-record access.

Architecture review (issue #9): boundary, interface-ownership and optional-provider evidence in `docs/architecture/review-baseline.md`; the offline vault is a provisional component until the #54 feasibility gate (ADR 004); no optional provider (third-party panorama, paid imagery, ODK/Kobo fallback) is promised; independent human review remains pending. Lifecycle/error states for the public API are in `docs/project/developer-handoffs.md`.

Development scaffold (issue #10): shared contracts, synthetic mock API states (success, empty, suppressed, validation 422, not-found 404, transient 503) and fail-fast environment errors are documented in `docs/operations/local-development.md`; browser bundles receive no server secrets (`scripts/check_secret_exposure.py`).
