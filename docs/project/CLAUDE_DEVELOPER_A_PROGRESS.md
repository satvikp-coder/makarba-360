# Developer A progress ledger (Claude)

Main SHA at checkpoint: `3c6384fee4c908498013a8df7d9262f2704a6364`. GitHub is authoritative; this file is a checkpoint. The allocation JSON status fields are a planning snapshot and are not updated per issue.

Total Developer A issues: 63. Closed: 5. Human items: [HUMAN_ACTION_REQUIRED.md](HUMAN_ACTION_REQUIRED.md).

**Next safe operation:** Implement #39 audit events, #33 invitation/deactivation, #35 capability enforcement (code-complete prerequisites are met; closure waits on H1/H2), then #37/#38 and the GIS/survey chain as Developer B deliverables (#5, #12, #54) land.

| Issue | Title | Status | PR | Merge SHA | Note |
|---|---|---|---|---|---|
| #1 | [DEVOPS] Establish repository governance | VERIFIED_COMPLETE | PR #137 | b514de4 | governance docs + checker |
| #3 | [DEVOPS] Approve product vision and boundaries | BLOCKED_HUMAN_OR_FIELD |  |  | see HUMAN_ACTION_REQUIRED H1/owner decision |
| #4 | [DEVOPS] Validate research questions and methodology | BLOCKED_HUMAN_OR_FIELD |  |  | see HUMAN_ACTION_REQUIRED H3 related |
| #6 | [DEVOPS] Approve stakeholder capability matrix | CODE_MERGED_CLOSURE_PENDING | PR #139 (proposed matrix) | 3ca6aa6 | H1: stakeholder approval of the capability matrix |
| #7 | [DEVOPS] Baseline functional requirements catalogue | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #2, #6 |
| #8 | [DEVOPS] Baseline non-functional requirements | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #7 |
| #9 | [DEVOPS] Review architecture diagrams and ADR baseline | VERIFIED_COMPLETE | PR #143 (+dependency fix #142) | 1e75b76 |  |
| #10 | [DEVOPS] Scaffold development setup and CI governance | VERIFIED_COMPLETE | PR #140 | 2820aa7 |  |
| #11 | [DEVOPS] Obtain institutional ethics and legal verification | BLOCKED_HUMAN_OR_FIELD |  |  | see HUMAN_ACTION_REQUIRED H3 |
| #22 | [GIS] Provision PostGIS migrations and roles | VERIFIED_COMPLETE | PR #146 | 2f6359a |  |
| #23 | [GIS] Store and validate versioned study boundary | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #5 |
| #26 | [GIS] Implement location category taxonomy | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #12 |
| #27 | [GIS] Support point route and polygon locations | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #26 |
| #30 | [GIS] Implement geographic candidate editing | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #27, #35 |
| #32 | [PRIVACY] Integrate identity provider and secure sessions | CODE_MERGED_CLOSURE_PENDING | PR #147 | 45808c8 | H1 (MFA policy) and H2 (real identity provider) |
| #33 | [PRIVACY] Implement researcher invitation and deactivation | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #32 |
| #34 | [PRIVACY] Implement role and study authorization | CODE_MERGED_CLOSURE_PENDING | PR #148 | 3c6384f | H1 (matrix approval); no private routes exist yet to inventory |
| #35 | [PRIVACY] Enforce capability matrix across API and UI | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #34 |
| #36 | [PRIVACY] Harden database access and migration credentials | VERIFIED_COMPLETE | PR #145 | eb8d563 |  |
| #37 | [PRIVACY] Implement scoped versioned consent records | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #35 |
| #38 | [PRIVACY] Protect raw interview and GPS endpoints | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #35 |
| #39 | [PRIVACY] Implement security audit events | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #35 |
| #40 | [PRIVACY] Configure secure secrets and environments | CODE_MERGED_CLOSURE_PENDING | PR #144 | 59a594e | browser-bundle scan can only run once the first web app exists |
| #42 | [SURVEY] Implement survey question and answer schema | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #4 |
| #43 | [SURVEY] Implement immutable questionnaire versions | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #42 |
| #44 | [SURVEY] Implement field visit sessions | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #23, #35 |
| #45 | [SURVEY] Implement interview start workflow | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #20, #43, #44 |
| #46 | [SURVEY] Capture participant categories and official claims | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #42, #45 |
| #47 | [SURVEY] Record consent and interview metadata | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #37, #45 |
| #48 | [SURVEY] Capture mobile geolocation and permission state | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #20, #47 |
| #49 | [SURVEY] Display GPS quality recapture and corrections | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #48 |
| #50 | [SURVEY] Store independent interview and subject geography | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #42, #27 |
| #51 | [SURVEY] Render and validate versioned questions | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #43, #46, #50 |
| #52 | [SURVEY] Implement interview review and durable save | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #47, #51, #55 |
| #53 | [SURVEY] Implement own submission history and corrections | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #52, #57 |
| #55 | [OFFLINE] Persist protected recoverable local drafts | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #42, #54 |
| #56 | [OFFLINE] Implement offline session and device lock policy | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #32, #54 |
| #57 | [OFFLINE] Implement idempotent transactional sync | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #38, #43, #50, #56 |
| #58 | [OFFLINE] Handle sync retries conflicts and rejections | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #55, #57 |
| #59 | [OFFLINE] Prevent duplicates without deleting genuine interviews | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #57 |
| #60 | [OFFLINE] Implement quarantined resumable media uploads | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #40, #38 |
| #81 | [FRONTEND] Implement read-only public projection API | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #38 |
| #84 | [ANALYTICS] Implement reproducible valid-answer aggregation | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #43, #37 |
| #90 | [ANALYTICS] Build safe survey coverage snapshots | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #23, #84, #92 |
| #92 | [ANALYTICS] Enforce disclosure and small-sample controls | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #41, #84 |
| #95 | [ADMIN] Build account and training administration | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #33 |
| #96 | [SURVEY] Capture structured field observations separately from interviews | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #20, #27, #35, #44 |
| #97 | [OFFLINE] Implement conditional approved external collection importer | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #43, #54, #57 |
| #98 | [ADMIN] Monitor visits and research progress | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #44 |
| #99 | [ADMIN] Build survey moderation and validation queue | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #51, #39 |
| #100 | [ADMIN] Review private GPS quality and outliers | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #23, #49, #99 |
| #103 | [ADMIN] Implement publication preview approval and revoke | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #99, #39 |
| #105 | [ADMIN] Implement correction withdrawal and retention workflows | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #37, #39, #103 |
| #107 | [DEVOPS] Test API integration and validation | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #106 |
| #109 | [DEVOPS] Test authorization abuse paths | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #106, #32 |
| #110 | [DEVOPS] Test private-to-public exposure boundary | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #106 |
| #111 | [DEVOPS] Test GPS permission quality and correction edges | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #106 |
| #112 | [DEVOPS] Test offline to online sync reliability | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #54, #106 |
| #116 | [DEVOPS] Rehearse encrypted backup and restore | BLOCKED_HUMAN_OR_FIELD |  |  | see HUMAN_ACTION_REQUIRED H7 |
| #121 | [DEVOPS] Run real GPS and offline pilot | BLOCKED_HUMAN_OR_FIELD |  |  | see HUMAN_ACTION_REQUIRED H6 |
| #122 | [DEVOPS] Audit survey consent and data quality | BLOCKED_HUMAN_OR_FIELD |  |  | see HUMAN_ACTION_REQUIRED H6 |
| #125 | [DEVOPS] Validate final research dataset and snapshots | BLOCKED_HUMAN_OR_FIELD |  |  | see HUMAN_ACTION_REQUIRED H8/H9 |
| #136 | [FRONTEND] Evaluate human-reviewed qualitative AI assistance | BLOCKED_BY_TECHNICAL_DEPENDENCY |  |  | open hard prerequisites: #86, #105, #126 |
