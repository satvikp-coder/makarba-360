# Milestone specifications

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

No committed dates. Issue-level dependencies govern overlapping milestones.

## M00 — Requirements, Research and Repository Foundation

Objective: deliver requirements, research and repository foundation.
Research/business value: safe reproducible research.
Scope: Establish repository governance; Trace all source blueprint requirements; Approve product vision and boundaries; Validate research questions and methodology; Specify and verify geographical study extent; Approve stakeholder capability matrix; Baseline functional requirements catalogue; Baseline non-functional requirements; Review architecture diagrams and ADR baseline; Scaffold development setup and CI governance; Obtain institutional ethics and legal verification.
Entry requirements/dependencies: issue-level blockers repository access and source blueprint; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 11 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M01 — UI/UX and Design System

Objective: deliver ui/ux and design system.
Research/business value: clear evidence-led exploration.
Scope: Define visual identity and accessible tokens; Design public information architecture; Specify home page wireframes; Specify desktop map-first layout; Specify mobile map bottom sheet; Design place profile interface; Design Then and Now comparison; Design Community Insights dashboard; Design accessible field interview screens; Design responsive research management.
Entry requirements/dependencies: issue-level blockers [#3](https://github.com/satvikp-coder/makarba-360/issues/3), [#4](https://github.com/satvikp-coder/makarba-360/issues/4), [#6](https://github.com/satvikp-coder/makarba-360/issues/6), [#7](https://github.com/satvikp-coder/makarba-360/issues/7); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M02 — GIS, Map Data and Spatial Foundation

Objective: deliver gis, map data and spatial foundation.
Research/business value: clear evidence-led exploration.
Scope: Provision PostGIS migrations and roles; Store and validate versioned study boundary; Select basemap provider and attribution; Integrate initial MapLibre map; Implement location category taxonomy; Support point route and polygon locations; Import and verify road corridors; Provide reusable spatial search and clustering; Implement geographic candidate editing; Implement validated GIS import and export.
Entry requirements/dependencies: issue-level blockers [#5](https://github.com/satvikp-coder/makarba-360/issues/5), [#9](https://github.com/satvikp-coder/makarba-360/issues/9), [#10](https://github.com/satvikp-coder/makarba-360/issues/10), [#12](https://github.com/satvikp-coder/makarba-360/issues/12), [#15](https://github.com/satvikp-coder/makarba-360/issues/15), [#35](https://github.com/satvikp-coder/makarba-360/issues/35), [#36](https://github.com/satvikp-coder/makarba-360/issues/36); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M03 — Authentication, Privacy and Data Security

Objective: deliver authentication, privacy and data security.
Research/business value: safe reproducible research.
Scope: Integrate identity provider and secure sessions; Implement researcher invitation and deactivation; Implement role and study authorization; Enforce capability matrix across API and UI; Harden database access and migration credentials; Implement scoped versioned consent records; Protect raw interview and GPS endpoints; Implement security audit events; Configure secure secrets and environments; Test security threat model and privacy boundaries.
Entry requirements/dependencies: issue-level blockers [#6](https://github.com/satvikp-coder/makarba-360/issues/6), [#9](https://github.com/satvikp-coder/makarba-360/issues/9), [#10](https://github.com/satvikp-coder/makarba-360/issues/10), [#11](https://github.com/satvikp-coder/makarba-360/issues/11); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M04 — Field Survey and GPS Collection

Objective: deliver field survey and gps collection.
Research/business value: safe reproducible research.
Scope: Implement survey question and answer schema; Implement immutable questionnaire versions; Implement field visit sessions; Implement interview start workflow; Capture participant categories and official claims; Record consent and interview metadata; Capture mobile geolocation and permission state; Display GPS quality recapture and corrections; Store independent interview and subject geography; Render and validate versioned questions; Implement interview review and durable save; Implement own submission history and corrections; Capture structured field observations separately from interviews.
Entry requirements/dependencies: issue-level blockers [#4](https://github.com/satvikp-coder/makarba-360/issues/4), [#20](https://github.com/satvikp-coder/makarba-360/issues/20), [#22](https://github.com/satvikp-coder/makarba-360/issues/22), [#23](https://github.com/satvikp-coder/makarba-360/issues/23), [#25](https://github.com/satvikp-coder/makarba-360/issues/25), [#27](https://github.com/satvikp-coder/makarba-360/issues/27), [#35](https://github.com/satvikp-coder/makarba-360/issues/35), [#37](https://github.com/satvikp-coder/makarba-360/issues/37), [#55](https://github.com/satvikp-coder/makarba-360/issues/55), [#57](https://github.com/satvikp-coder/makarba-360/issues/57); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 13 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M05 — Offline Fieldwork, Synchronisation and Media

Objective: deliver offline fieldwork, synchronisation and media.
Research/business value: safe reproducible research.
Scope: Validate offline approach and fallback; Persist protected recoverable local drafts; Implement offline session and device lock policy; Implement idempotent transactional sync; Handle sync retries conflicts and rejections; Prevent duplicates without deleting genuine interviews; Implement quarantined resumable media uploads; Manage photo metadata credit and permissions; Test field network and device-loss recovery; Implement conditional approved external collection importer.
Entry requirements/dependencies: issue-level blockers [#9](https://github.com/satvikp-coder/makarba-360/issues/9), [#11](https://github.com/satvikp-coder/makarba-360/issues/11), [#20](https://github.com/satvikp-coder/makarba-360/issues/20), [#32](https://github.com/satvikp-coder/makarba-360/issues/32), [#37](https://github.com/satvikp-coder/makarba-360/issues/37), [#38](https://github.com/satvikp-coder/makarba-360/issues/38), [#40](https://github.com/satvikp-coder/makarba-360/issues/40), [#42](https://github.com/satvikp-coder/makarba-360/issues/42), [#43](https://github.com/satvikp-coder/makarba-360/issues/43), [#50](https://github.com/satvikp-coder/makarba-360/issues/50); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M06 — Heritage, Historical Evidence and 360° Content

Objective: deliver heritage, historical evidence and 360° content.
Research/business value: clear evidence-led exploration.
Scope: Implement versioned place content model; Implement editorial place description workflow; Implement historical evidence provenance; Implement sourced timeline events; Implement historical comparison pair model; Build accessible Then and Now component; Integrate owned panorama viewer; Evaluate third-party street imagery licensing; Publish verified location stories and accounts.
Entry requirements/dependencies: issue-level blockers [#4](https://github.com/satvikp-coder/makarba-360/issues/4), [#9](https://github.com/satvikp-coder/makarba-360/issues/9), [#17](https://github.com/satvikp-coder/makarba-360/issues/17), [#18](https://github.com/satvikp-coder/makarba-360/issues/18), [#24](https://github.com/satvikp-coder/makarba-360/issues/24), [#27](https://github.com/satvikp-coder/makarba-360/issues/27), [#35](https://github.com/satvikp-coder/makarba-360/issues/35), [#37](https://github.com/satvikp-coder/makarba-360/issues/37), [#61](https://github.com/satvikp-coder/makarba-360/issues/61); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 9 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M07 — Public Interactive Website

Objective: deliver public interactive website.
Research/business value: clear evidence-led exploration.
Scope: Build public shell and accessible navigation; Build evidence-led home page; Build public map explorer; Build map layer and category controls; Build public location search; Build location profile pages; Build approved photo gallery; Present panorama and unavailable coverage states; Integrate public history and Community Voices; Implement read-only public projection API; Verify responsive public map journeys; Publish methodology sources and accessibility pages.
Entry requirements/dependencies: issue-level blockers [#4](https://github.com/satvikp-coder/makarba-360/issues/4), [#10](https://github.com/satvikp-coder/makarba-360/issues/10), [#13](https://github.com/satvikp-coder/makarba-360/issues/13), [#14](https://github.com/satvikp-coder/makarba-360/issues/14), [#16](https://github.com/satvikp-coder/makarba-360/issues/16), [#17](https://github.com/satvikp-coder/makarba-360/issues/17), [#25](https://github.com/satvikp-coder/makarba-360/issues/25), [#26](https://github.com/satvikp-coder/makarba-360/issues/26), [#29](https://github.com/satvikp-coder/makarba-360/issues/29), [#38](https://github.com/satvikp-coder/makarba-360/issues/38), [#61](https://github.com/satvikp-coder/makarba-360/issues/61), [#64](https://github.com/satvikp-coder/makarba-360/issues/64), [#68](https://github.com/satvikp-coder/makarba-360/issues/68), [#69](https://github.com/satvikp-coder/makarba-360/issues/69), [#70](https://github.com/satvikp-coder/makarba-360/issues/70), [#71](https://github.com/satvikp-coder/makarba-360/issues/71), [#92](https://github.com/satvikp-coder/makarba-360/issues/92), [#103](https://github.com/satvikp-coder/makarba-360/issues/103); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 12 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M08 — Community Insights and Survey Analytics

Objective: deliver community insights and survey analytics.
Research/business value: safe reproducible research.
Scope: Implement reproducible valid-answer aggregation; Aggregate stakeholder distributions; Analyze reported issues with codebook; Analyze ratings and perceived changes; Build stakeholder comparison chart tables; Publish location-level sample summaries; Build safe survey coverage snapshots; Implement constrained dashboard cohorts and dates; Enforce disclosure and small-sample controls; Verify analytics with reproducible fixtures.
Entry requirements/dependencies: issue-level blockers [#19](https://github.com/satvikp-coder/makarba-360/issues/19), [#23](https://github.com/satvikp-coder/makarba-360/issues/23), [#37](https://github.com/satvikp-coder/makarba-360/issues/37), [#41](https://github.com/satvikp-coder/makarba-360/issues/41), [#43](https://github.com/satvikp-coder/makarba-360/issues/43), [#50](https://github.com/satvikp-coder/makarba-360/issues/50), [#51](https://github.com/satvikp-coder/makarba-360/issues/51), [#99](https://github.com/satvikp-coder/makarba-360/issues/99); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M09 — Research Administration and Publication Management

Objective: deliver research administration and publication management.
Research/business value: safe reproducible research.
Scope: Build role-limited research dashboard; Build account and training administration; Monitor visits and research progress; Build survey moderation and validation queue; Review private GPS quality and outliers; Approve candidate locations and geometry; Review historical evidence and media rights; Implement publication preview approval and revoke; Implement purpose-limited anonymised exports; Implement correction withdrawal and retention workflows.
Entry requirements/dependencies: issue-level blockers [#21](https://github.com/satvikp-coder/makarba-360/issues/21), [#23](https://github.com/satvikp-coder/makarba-360/issues/23), [#30](https://github.com/satvikp-coder/makarba-360/issues/30), [#31](https://github.com/satvikp-coder/makarba-360/issues/31), [#33](https://github.com/satvikp-coder/makarba-360/issues/33), [#35](https://github.com/satvikp-coder/makarba-360/issues/35), [#37](https://github.com/satvikp-coder/makarba-360/issues/37), [#39](https://github.com/satvikp-coder/makarba-360/issues/39), [#44](https://github.com/satvikp-coder/makarba-360/issues/44), [#49](https://github.com/satvikp-coder/makarba-360/issues/49), [#51](https://github.com/satvikp-coder/makarba-360/issues/51), [#61](https://github.com/satvikp-coder/makarba-360/issues/61), [#65](https://github.com/satvikp-coder/makarba-360/issues/65), [#92](https://github.com/satvikp-coder/makarba-360/issues/92); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M10 — Quality Assurance, Accessibility and Performance

Objective: deliver quality assurance, accessibility and performance.
Research/business value: safe reproducible research.
Scope: Establish meaningful unit test harness; Test API integration and validation; Test migrations and spatial invariants; Test authorization abuse paths; Test private-to-public exposure boundary; Test GPS permission quality and correction edges; Test offline to online sync reliability; Test end-to-end public field and review journeys; Audit keyboard screen reader and localization access; Enforce performance security and CI gates; Rehearse encrypted backup and restore; Validate real mobile browser compatibility.
Entry requirements/dependencies: issue-level blockers [#10](https://github.com/satvikp-coder/makarba-360/issues/10), [#20](https://github.com/satvikp-coder/makarba-360/issues/20), [#31](https://github.com/satvikp-coder/makarba-360/issues/31), [#41](https://github.com/satvikp-coder/makarba-360/issues/41), [#50](https://github.com/satvikp-coder/makarba-360/issues/50), [#57](https://github.com/satvikp-coder/makarba-360/issues/57), [#62](https://github.com/satvikp-coder/makarba-360/issues/62), [#81](https://github.com/satvikp-coder/makarba-360/issues/81), [#82](https://github.com/satvikp-coder/makarba-360/issues/82), [#93](https://github.com/satvikp-coder/makarba-360/issues/93), [#94](https://github.com/satvikp-coder/makarba-360/issues/94), [#103](https://github.com/satvikp-coder/makarba-360/issues/103), [#104](https://github.com/satvikp-coder/makarba-360/issues/104), [#105](https://github.com/satvikp-coder/makarba-360/issues/105), [#124](https://github.com/satvikp-coder/makarba-360/issues/124); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 12 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M11 — Field Pilot, Launch and Final Handover

Objective: deliver field pilot, launch and final handover.
Research/business value: safe reproducible research.
Scope: Train researchers and rehearse field checklist; Run consent-approved small field usability pilot; Verify candidate places and road data; Run real GPS and offline pilot; Audit survey consent and data quality; Audit historical sources and media attribution; Provision staging and production deployment; Validate final research dataset and snapshots; Verify release readiness and demonstrate end to end; Complete handover and maintenance ownership.
Entry requirements/dependencies: issue-level blockers [#9](https://github.com/satvikp-coder/makarba-360/issues/9), [#11](https://github.com/satvikp-coder/makarba-360/issues/11), [#28](https://github.com/satvikp-coder/makarba-360/issues/28), [#40](https://github.com/satvikp-coder/makarba-360/issues/40), [#53](https://github.com/satvikp-coder/makarba-360/issues/53), [#62](https://github.com/satvikp-coder/makarba-360/issues/62), [#68](https://github.com/satvikp-coder/makarba-360/issues/68), [#69](https://github.com/satvikp-coder/makarba-360/issues/69), [#93](https://github.com/satvikp-coder/makarba-360/issues/93), [#99](https://github.com/satvikp-coder/makarba-360/issues/99), [#100](https://github.com/satvikp-coder/makarba-360/issues/100), [#101](https://github.com/satvikp-coder/makarba-360/issues/101), [#102](https://github.com/satvikp-coder/makarba-360/issues/102), [#108](https://github.com/satvikp-coder/makarba-360/issues/108), [#109](https://github.com/satvikp-coder/makarba-360/issues/109), [#112](https://github.com/satvikp-coder/makarba-360/issues/112), [#115](https://github.com/satvikp-coder/makarba-360/issues/115), [#116](https://github.com/satvikp-coder/makarba-360/issues/116), [#117](https://github.com/satvikp-coder/makarba-360/issues/117); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M12 — Advanced and Stretch Features

Objective: deliver advanced and stretch features.
Research/business value: clear evidence-led exploration.
Scope: Build rich guided map tours; Expand English Gujarati and Hindi localization; Analyze surveyed walkability and accessibility; Create consented community audio archive; Prototype clearly hypothetical future scenarios; Evaluate advanced 3D data and performance; Build privacy-safe reported-issue hotspot views; Export approved research report and charts; Evaluate human-reviewed qualitative AI assistance.
Entry requirements/dependencies: issue-level blockers [#28](https://github.com/satvikp-coder/makarba-360/issues/28), [#70](https://github.com/satvikp-coder/makarba-360/issues/70), [#71](https://github.com/satvikp-coder/makarba-360/issues/71), [#80](https://github.com/satvikp-coder/makarba-360/issues/80), [#86](https://github.com/satvikp-coder/makarba-360/issues/86), [#90](https://github.com/satvikp-coder/makarba-360/issues/90), [#92](https://github.com/satvikp-coder/makarba-360/issues/92), [#104](https://github.com/satvikp-coder/makarba-360/issues/104), [#105](https://github.com/satvikp-coder/makarba-360/issues/105), [#114](https://github.com/satvikp-coder/makarba-360/issues/114), [#126](https://github.com/satvikp-coder/makarba-360/issues/126); follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 9 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.
