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
Entry requirements/dependencies: issue-level blockers 00.03, 00.04, 00.06, 00.07; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M02 — GIS, Map Data and Spatial Foundation

Objective: deliver gis, map data and spatial foundation.
Research/business value: clear evidence-led exploration.
Scope: Provision PostGIS migrations and roles; Store and validate versioned study boundary; Select basemap provider and attribution; Integrate initial MapLibre map; Implement location category taxonomy; Support point route and polygon locations; Import and verify road corridors; Provide reusable spatial search and clustering; Implement geographic candidate editing; Implement validated GIS import and export.
Entry requirements/dependencies: issue-level blockers 00.05, 00.09, 00.10, 01.01, 01.04, 03.04, 03.05; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M03 — Authentication, Privacy and Data Security

Objective: deliver authentication, privacy and data security.
Research/business value: safe reproducible research.
Scope: Integrate identity provider and secure sessions; Implement researcher invitation and deactivation; Implement role and study authorization; Enforce capability matrix across API and UI; Harden database access and migration credentials; Implement scoped versioned consent records; Protect raw interview and GPS endpoints; Implement security audit events; Configure secure secrets and environments; Test security threat model and privacy boundaries.
Entry requirements/dependencies: issue-level blockers 00.06, 00.09, 00.10, 00.11; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M04 — Field Survey and GPS Collection

Objective: deliver field survey and gps collection.
Research/business value: safe reproducible research.
Scope: Implement survey question and answer schema; Implement immutable questionnaire versions; Implement field visit sessions; Implement interview start workflow; Capture participant categories and official claims; Record consent and interview metadata; Capture mobile geolocation and permission state; Display GPS quality recapture and corrections; Store independent interview and subject geography; Render and validate versioned questions; Implement interview review and durable save; Implement own submission history and corrections.
Entry requirements/dependencies: issue-level blockers 00.04, 01.09, 02.01, 02.02, 02.04, 02.06, 03.04, 03.06, 05.02, 05.04; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 12 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M05 — Offline Fieldwork, Synchronisation and Media

Objective: deliver offline fieldwork, synchronisation and media.
Research/business value: safe reproducible research.
Scope: Validate offline approach and fallback; Persist protected recoverable local drafts; Implement offline session and device lock policy; Implement idempotent transactional sync; Handle sync retries conflicts and rejections; Prevent duplicates without deleting genuine interviews; Implement quarantined resumable media uploads; Manage photo metadata credit and permissions; Test field network and device-loss recovery.
Entry requirements/dependencies: issue-level blockers 00.09, 00.11, 01.09, 03.01, 03.06, 03.07, 03.09, 04.01, 04.02, 04.09; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 9 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M06 — Heritage, Historical Evidence and 360° Content

Objective: deliver heritage, historical evidence and 360° content.
Research/business value: clear evidence-led exploration.
Scope: Implement versioned place content model; Implement editorial place description workflow; Implement historical evidence provenance; Implement sourced timeline events; Implement historical comparison pair model; Build accessible Then and Now component; Integrate owned panorama viewer; Evaluate third-party street imagery licensing; Publish verified location stories and accounts.
Entry requirements/dependencies: issue-level blockers 00.04, 00.09, 01.06, 01.07, 02.03, 02.06, 03.04, 03.06, 05.08; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 9 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M07 — Public Interactive Website

Objective: deliver public interactive website.
Research/business value: clear evidence-led exploration.
Scope: Build public shell and accessible navigation; Build evidence-led home page; Build public map explorer; Build map layer and category controls; Build public location search; Build location profile pages; Build approved photo gallery; Present panorama and unavailable coverage states; Integrate public history and Community Voices; Implement read-only public projection API; Verify responsive public map journeys; Publish methodology sources and accessibility pages.
Entry requirements/dependencies: issue-level blockers 00.04, 00.10, 01.02, 01.03, 01.05, 01.06, 02.04, 02.05, 02.08, 03.07, 05.08, 06.02, 06.06, 06.07, 06.08, 06.09, 08.09, 09.08; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 12 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M08 — Community Insights and Survey Analytics

Objective: deliver community insights and survey analytics.
Research/business value: safe reproducible research.
Scope: Implement reproducible valid-answer aggregation; Aggregate stakeholder distributions; Analyze reported issues with codebook; Analyze ratings and perceived changes; Build stakeholder comparison chart tables; Publish location-level sample summaries; Build safe survey coverage snapshots; Implement constrained dashboard cohorts and dates; Enforce disclosure and small-sample controls; Verify analytics with reproducible fixtures.
Entry requirements/dependencies: issue-level blockers 01.08, 02.02, 03.06, 03.10, 04.02, 04.09, 04.10, 09.04; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M09 — Research Administration and Publication Management

Objective: deliver research administration and publication management.
Research/business value: safe reproducible research.
Scope: Build role-limited research dashboard; Build account and training administration; Monitor visits and research progress; Build survey moderation and validation queue; Review private GPS quality and outliers; Approve candidate locations and geometry; Review historical evidence and media rights; Implement publication preview approval and revoke; Implement purpose-limited anonymised exports; Implement correction withdrawal and retention workflows.
Entry requirements/dependencies: issue-level blockers 01.10, 02.02, 02.09, 02.10, 03.02, 03.04, 03.06, 03.08, 04.03, 04.08, 04.10, 05.08, 06.03, 08.09; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M10 — Quality Assurance, Accessibility and Performance

Objective: deliver quality assurance, accessibility and performance.
Research/business value: safe reproducible research.
Scope: Establish meaningful unit test harness; Test API integration and validation; Test migrations and spatial invariants; Test authorization abuse paths; Test private-to-public exposure boundary; Test GPS permission quality and correction edges; Test offline to online sync reliability; Test end-to-end public field and review journeys; Audit keyboard screen reader and localization access; Enforce performance security and CI gates; Rehearse encrypted backup and restore; Validate real mobile browser compatibility.
Entry requirements/dependencies: issue-level blockers 00.10, 01.09, 02.10, 03.10, 04.09, 05.04, 05.09, 07.10, 07.11, 08.10, 09.01, 09.08, 09.09, 09.10, 11.07; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 12 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: contract drift, privacy regressions and device/accessibility limitations.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M11 — Field Pilot, Launch and Final Handover

Objective: deliver field pilot, launch and final handover.
Research/business value: safe reproducible research.
Scope: Train researchers and rehearse field checklist; Run consent-approved small field usability pilot; Verify candidate places and road data; Run real GPS and offline pilot; Audit survey consent and data quality; Audit historical sources and media attribution; Provision staging and production deployment; Validate final research dataset and snapshots; Verify release readiness and demonstrate end to end; Complete handover and maintenance ownership.
Entry requirements/dependencies: issue-level blockers 00.09, 00.11, 02.07, 03.09, 04.12, 05.09, 06.06, 06.07, 08.10, 09.04, 09.05, 09.06, 09.07, 10.03, 10.04, 10.07, 10.10, 10.11, 10.12; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 10 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.

## M12 — Advanced and Stretch Features

Objective: deliver advanced and stretch features.
Research/business value: clear evidence-led exploration.
Scope: Build rich guided map tours; Expand English Gujarati and Hindi localization; Analyze surveyed walkability and accessibility; Create consented community audio archive; Prototype clearly hypothetical future scenarios; Evaluate advanced 3D data and performance; Build privacy-safe reported-issue hotspot views; Export approved research report and charts; Evaluate human-reviewed qualitative AI assistance.
Entry requirements/dependencies: issue-level blockers 02.07, 06.08, 06.09, 07.09, 08.03, 08.07, 08.09, 09.09, 09.10, 10.09, 11.09; follow the DAG rather than milestone numbers.
Expected outputs: reviewed artifacts/capabilities for all 9 assigned issues and verification evidence.
Completion criteria: all scoped issue acceptance checks and release gates pass; no unsupported evidence or private data exposure.
Risks: unapproved institution/provider dependency or uncertain field evidence.
Blocking issues: see assigned issue Dependencies and milestone-blocker labels; all listed blockers require evidence.
Verification: issue-specific tests/research review, requirements traceability and definition-of-done review. No deadlines set without confirmed schedule.
