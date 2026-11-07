# Issue index

134 focused issues: the supplied minimum inventory totals 133; one separate institutional ethics/legal gate makes 134. No product issue is completed by this planning run. Stable IDs make publishing resumable.

## M00 — Requirements, Research and Repository Foundation

- [00.01 [DEVOPS] Establish repository governance](issues/00.01.md) — P0; blockers: none
- [00.02 [DEVOPS] Trace all source blueprint requirements](issues/00.02.md) — P0; blockers: 00.01
- [00.03 [DEVOPS] Approve product vision and boundaries](issues/00.03.md) — P0; blockers: 00.02
- [00.04 [DEVOPS] Validate research questions and methodology](issues/00.04.md) — P0; blockers: 00.03
- [00.05 [DEVOPS] Specify and verify geographical study extent](issues/00.05.md) — P0; blockers: 00.04
- [00.06 [DEVOPS] Approve stakeholder capability matrix](issues/00.06.md) — P0; blockers: 00.03
- [00.07 [DEVOPS] Baseline functional requirements catalogue](issues/00.07.md) — P0; blockers: 00.02, 00.06
- [00.08 [DEVOPS] Baseline non-functional requirements](issues/00.08.md) — P0; blockers: 00.07
- [00.09 [DEVOPS] Review architecture diagrams and ADR baseline](issues/00.09.md) — P0; blockers: 00.08
- [00.10 [DEVOPS] Scaffold development setup and CI governance](issues/00.10.md) — P0; blockers: 00.09
- [00.11 [DEVOPS] Obtain institutional ethics and legal verification](issues/00.11.md) — P0; blockers: 00.04, 00.06

## M01 — UI/UX and Design System

- [01.01 [FRONTEND] Define visual identity and accessible tokens](issues/01.01.md) — P2; blockers: 00.03
- [01.02 [FRONTEND] Design public information architecture](issues/01.02.md) — P2; blockers: 01.01, 00.07
- [01.03 [FRONTEND] Specify home page wireframes](issues/01.03.md) — P2; blockers: 01.02
- [01.04 [FRONTEND] Specify desktop map-first layout](issues/01.04.md) — P2; blockers: 01.02
- [01.05 [FRONTEND] Specify mobile map bottom sheet](issues/01.05.md) — P2; blockers: 01.04
- [01.06 [FRONTEND] Design place profile interface](issues/01.06.md) — P2; blockers: 01.04
- [01.07 [FRONTEND] Design Then and Now comparison](issues/01.07.md) — P2; blockers: 01.06
- [01.08 [FRONTEND] Design Community Insights dashboard](issues/01.08.md) — P2; blockers: 01.02, 00.04
- [01.09 [FRONTEND] Design accessible field interview screens](issues/01.09.md) — P2; blockers: 01.01, 00.06
- [01.10 [FRONTEND] Design responsive research management](issues/01.10.md) — P2; blockers: 01.01, 00.06

## M02 — GIS, Map Data and Spatial Foundation

- [02.01 [GIS] Provision PostGIS migrations and roles](issues/02.01.md) — P1; blockers: 00.10, 03.05
- [02.02 [GIS] Store and validate versioned study boundary](issues/02.02.md) — P1; blockers: 00.05, 02.01
- [02.03 [GIS] Select basemap provider and attribution](issues/02.03.md) — P1; blockers: 00.09
- [02.04 [GIS] Integrate initial MapLibre map](issues/02.04.md) — P1; blockers: 02.02, 02.03, 01.04
- [02.05 [GIS] Implement location category taxonomy](issues/02.05.md) — P1; blockers: 02.01, 01.01
- [02.06 [GIS] Support point route and polygon locations](issues/02.06.md) — P1; blockers: 02.01, 02.05
- [02.07 [GIS] Import and verify road corridors](issues/02.07.md) — P1; blockers: 02.02, 02.06
- [02.08 [GIS] Provide reusable spatial search and clustering](issues/02.08.md) — P1; blockers: 02.04, 02.06
- [02.09 [GIS] Implement geographic candidate editing](issues/02.09.md) — P1; blockers: 02.06, 03.04
- [02.10 [GIS] Implement validated GIS import and export](issues/02.10.md) — P1; blockers: 02.06, 03.04

## M03 — Authentication, Privacy and Data Security

- [03.01 [PRIVACY] Integrate identity provider and secure sessions](issues/03.01.md) — P0; blockers: 00.06, 00.10
- [03.02 [PRIVACY] Implement researcher invitation and deactivation](issues/03.02.md) — P0; blockers: 03.01
- [03.03 [PRIVACY] Implement role and study authorization](issues/03.03.md) — P0; blockers: 03.01, 00.06
- [03.04 [PRIVACY] Enforce capability matrix across API and UI](issues/03.04.md) — P0; blockers: 03.03
- [03.05 [PRIVACY] Harden database access and migration credentials](issues/03.05.md) — P0; blockers: 00.09
- [03.06 [PRIVACY] Implement scoped versioned consent records](issues/03.06.md) — P0; blockers: 03.04, 00.11
- [03.07 [PRIVACY] Protect raw interview and GPS endpoints](issues/03.07.md) — P0; blockers: 03.04, 03.05
- [03.08 [PRIVACY] Implement security audit events](issues/03.08.md) — P0; blockers: 03.04, 03.05
- [03.09 [PRIVACY] Configure secure secrets and environments](issues/03.09.md) — P0; blockers: 00.10
- [03.10 [PRIVACY] Test security threat model and privacy boundaries](issues/03.10.md) — P0; blockers: 03.07, 03.08, 03.09

## M04 — Field Survey and GPS Collection

- [04.01 [SURVEY] Implement survey question and answer schema](issues/04.01.md) — P1; blockers: 02.01, 00.04
- [04.02 [SURVEY] Implement immutable questionnaire versions](issues/04.02.md) — P1; blockers: 04.01
- [04.03 [SURVEY] Implement field visit sessions](issues/04.03.md) — P1; blockers: 03.04, 02.02
- [04.04 [SURVEY] Implement interview start workflow](issues/04.04.md) — P1; blockers: 04.02, 04.03, 01.09
- [04.05 [SURVEY] Capture participant categories and official claims](issues/04.05.md) — P1; blockers: 04.01, 04.04
- [04.06 [SURVEY] Record consent and interview metadata](issues/04.06.md) — P1; blockers: 03.06, 04.04
- [04.07 [SURVEY] Capture mobile geolocation and permission state](issues/04.07.md) — P1; blockers: 04.06, 01.09
- [04.08 [SURVEY] Display GPS quality recapture and corrections](issues/04.08.md) — P1; blockers: 04.07, 02.04
- [04.09 [SURVEY] Store independent interview and subject geography](issues/04.09.md) — P1; blockers: 04.01, 02.06, 04.08
- [04.10 [SURVEY] Render and validate versioned questions](issues/04.10.md) — P1; blockers: 04.02, 04.05, 04.09
- [04.11 [SURVEY] Implement interview review and durable save](issues/04.11.md) — P1; blockers: 04.10, 04.06, 05.02
- [04.12 [SURVEY] Implement own submission history and corrections](issues/04.12.md) — P1; blockers: 04.11, 05.04

## M05 — Offline Fieldwork, Synchronisation and Media

- [05.01 [OFFLINE] Validate offline approach and fallback](issues/05.01.md) — P0; blockers: 00.11, 00.09, 01.09
- [05.02 [OFFLINE] Persist protected recoverable local drafts](issues/05.02.md) — P0; blockers: 05.01, 04.01
- [05.03 [OFFLINE] Implement offline session and device lock policy](issues/05.03.md) — P0; blockers: 05.01, 03.01
- [05.04 [OFFLINE] Implement idempotent transactional sync](issues/05.04.md) — P0; blockers: 04.02, 04.09, 03.07, 05.03
- [05.05 [OFFLINE] Handle sync retries conflicts and rejections](issues/05.05.md) — P1; blockers: 05.04, 05.02
- [05.06 [OFFLINE] Prevent duplicates without deleting genuine interviews](issues/05.06.md) — P1; blockers: 05.04
- [05.07 [OFFLINE] Implement quarantined resumable media uploads](issues/05.07.md) — P1; blockers: 03.09, 03.07, 05.04
- [05.08 [OFFLINE] Manage photo metadata credit and permissions](issues/05.08.md) — P1; blockers: 05.07, 03.06
- [05.09 [OFFLINE] Test field network and device-loss recovery](issues/05.09.md) — P1; blockers: 05.05, 05.06, 05.08

## M06 — Heritage, Historical Evidence and 360° Content

- [06.01 [HISTORICAL] Implement versioned place content model](issues/06.01.md) — P2; blockers: 02.06
- [06.02 [HISTORICAL] Implement editorial place description workflow](issues/06.02.md) — P2; blockers: 06.01, 03.04
- [06.03 [HISTORICAL] Implement historical evidence provenance](issues/06.03.md) — P2; blockers: 06.01, 00.04
- [06.04 [HISTORICAL] Implement sourced timeline events](issues/06.04.md) — P2; blockers: 06.03
- [06.05 [HISTORICAL] Implement historical comparison pair model](issues/06.05.md) — P2; blockers: 06.03, 05.08
- [06.06 [HISTORICAL] Build accessible Then and Now component](issues/06.06.md) — P2; blockers: 06.05, 01.07
- [06.07 [HISTORICAL] Integrate owned panorama viewer](issues/06.07.md) — P2; blockers: 05.08, 01.06
- [06.08 [HISTORICAL] Evaluate third-party street imagery licensing](issues/06.08.md) — P2; blockers: 02.03, 00.09
- [06.09 [HISTORICAL] Publish verified location stories and accounts](issues/06.09.md) — P2; blockers: 06.02, 06.04, 03.06

## M07 — Public Interactive Website

- [07.01 [FRONTEND] Build public shell and accessible navigation](issues/07.01.md) — P2; blockers: 00.10, 01.02
- [07.02 [FRONTEND] Build evidence-led home page](issues/07.02.md) — P2; blockers: 07.01, 01.03, 07.10
- [07.03 [FRONTEND] Build public map explorer](issues/07.03.md) — P2; blockers: 02.04, 07.01, 07.10
- [07.04 [FRONTEND] Build map layer and category controls](issues/07.04.md) — P2; blockers: 07.03, 02.05
- [07.05 [FRONTEND] Build public location search](issues/07.05.md) — P2; blockers: 02.08, 07.10, 07.03
- [07.06 [FRONTEND] Build location profile pages](issues/07.06.md) — P2; blockers: 07.10, 01.06, 06.02
- [07.07 [FRONTEND] Build approved photo gallery](issues/07.07.md) — P2; blockers: 05.08, 07.06
- [07.08 [FRONTEND] Present panorama and unavailable coverage states](issues/07.08.md) — P2; blockers: 06.07, 06.08, 07.06
- [07.09 [FRONTEND] Integrate public history and Community Voices](issues/07.09.md) — P2; blockers: 06.06, 06.09, 07.06
- [07.10 [FRONTEND] Implement read-only public projection API](issues/07.10.md) — P2; blockers: 03.07, 09.08, 08.09
- [07.11 [FRONTEND] Verify responsive public map journeys](issues/07.11.md) — P2; blockers: 07.03, 07.06, 01.05
- [07.12 [FRONTEND] Publish methodology sources and accessibility pages](issues/07.12.md) — P2; blockers: 07.01, 00.04, 01.02

## M08 — Community Insights and Survey Analytics

- [08.01 [ANALYTICS] Implement reproducible valid-answer aggregation](issues/08.01.md) — P2; blockers: 04.02, 09.04, 03.06
- [08.02 [ANALYTICS] Aggregate stakeholder distributions](issues/08.02.md) — P2; blockers: 08.01
- [08.03 [ANALYTICS] Analyze reported issues with codebook](issues/08.03.md) — P2; blockers: 08.01, 04.10
- [08.04 [ANALYTICS] Analyze ratings and perceived changes](issues/08.04.md) — P2; blockers: 08.01
- [08.05 [ANALYTICS] Build stakeholder comparison chart tables](issues/08.05.md) — P2; blockers: 08.02, 08.04, 08.09, 01.08
- [08.06 [ANALYTICS] Publish location-level sample summaries](issues/08.06.md) — P2; blockers: 08.01, 04.09, 08.09
- [08.07 [ANALYTICS] Build safe survey coverage snapshots](issues/08.07.md) — P2; blockers: 08.01, 08.09, 02.02
- [08.08 [ANALYTICS] Implement constrained dashboard cohorts and dates](issues/08.08.md) — P2; blockers: 08.02, 08.03, 08.04, 08.09
- [08.09 [ANALYTICS] Enforce disclosure and small-sample controls](issues/08.09.md) — P2; blockers: 08.01, 03.10
- [08.10 [ANALYTICS] Verify analytics with reproducible fixtures](issues/08.10.md) — P2; blockers: 08.02, 08.03, 08.04, 08.07, 08.08

## M09 — Research Administration and Publication Management

- [09.01 [ADMIN] Build role-limited research dashboard](issues/09.01.md) — P1; blockers: 03.04, 01.10
- [09.02 [ADMIN] Build account and training administration](issues/09.02.md) — P1; blockers: 09.01, 03.02
- [09.03 [ADMIN] Monitor visits and research progress](issues/09.03.md) — P1; blockers: 09.01, 04.03
- [09.04 [ADMIN] Build survey moderation and validation queue](issues/09.04.md) — P1; blockers: 09.01, 04.10, 03.08
- [09.05 [ADMIN] Review private GPS quality and outliers](issues/09.05.md) — P1; blockers: 09.04, 04.08, 02.02
- [09.06 [ADMIN] Approve candidate locations and geometry](issues/09.06.md) — P1; blockers: 09.01, 02.09
- [09.07 [ADMIN] Review historical evidence and media rights](issues/09.07.md) — P1; blockers: 09.01, 06.03, 05.08
- [09.08 [ADMIN] Implement publication preview approval and revoke](issues/09.08.md) — P1; blockers: 09.04, 09.06, 09.07, 03.08
- [09.09 [ADMIN] Implement purpose-limited anonymised exports](issues/09.09.md) — P1; blockers: 09.04, 08.09, 02.10
- [09.10 [ADMIN] Implement correction withdrawal and retention workflows](issues/09.10.md) — P1; blockers: 09.08, 03.06, 03.08

## M10 — Quality Assurance, Accessibility and Performance

- [10.01 [DEVOPS] Establish meaningful unit test harness](issues/10.01.md) — P1; blockers: 00.10
- [10.02 [DEVOPS] Test API integration and validation](issues/10.02.md) — P1; blockers: 10.01, 05.04, 07.10
- [10.03 [DEVOPS] Test migrations and spatial invariants](issues/10.03.md) — P1; blockers: 10.01, 02.10
- [10.04 [DEVOPS] Test authorization abuse paths](issues/10.04.md) — P0; blockers: 10.02, 03.10
- [10.05 [DEVOPS] Test private-to-public exposure boundary](issues/10.05.md) — P0; blockers: 10.02, 09.08, 09.09
- [10.06 [DEVOPS] Test GPS permission quality and correction edges](issues/10.06.md) — P1; blockers: 04.09, 10.01
- [10.07 [DEVOPS] Test offline to online sync reliability](issues/10.07.md) — P0; blockers: 05.09, 10.02
- [10.08 [DEVOPS] Test end-to-end public field and review journeys](issues/10.08.md) — P1; blockers: 07.11, 09.10, 08.10, 10.07
- [10.09 [DEVOPS] Audit keyboard screen reader and localization access](issues/10.09.md) — P1; blockers: 07.11, 09.01, 01.09
- [10.10 [DEVOPS] Enforce performance security and CI gates](issues/10.10.md) — P1; blockers: 10.04, 10.05, 10.08, 10.09
- [10.11 [DEVOPS] Rehearse encrypted backup and restore](issues/10.11.md) — P1; blockers: 09.10, 11.07
- [10.12 [DEVOPS] Validate real mobile browser compatibility](issues/10.12.md) — P1; blockers: 10.06, 10.07, 10.09

## M11 — Field Pilot, Launch and Final Handover

- [11.01 [DEVOPS] Train researchers and rehearse field checklist](issues/11.01.md) — P1; blockers: 00.11, 04.12, 05.09
- [11.02 [DEVOPS] Run consent-approved small field usability pilot](issues/11.02.md) — P1; blockers: 11.01, 10.04, 10.12
- [11.03 [DEVOPS] Verify candidate places and road data](issues/11.03.md) — P1; blockers: 02.07, 09.06
- [11.04 [DEVOPS] Run real GPS and offline pilot](issues/11.04.md) — P1; blockers: 11.02, 10.07
- [11.05 [DEVOPS] Audit survey consent and data quality](issues/11.05.md) — P1; blockers: 11.04, 09.04, 09.05
- [11.06 [DEVOPS] Audit historical sources and media attribution](issues/11.06.md) — P1; blockers: 09.07, 06.06, 06.07
- [11.07 [DEVOPS] Provision staging and production deployment](issues/11.07.md) — P1; blockers: 03.09, 00.09, 10.03
- [11.08 [DEVOPS] Validate final research dataset and snapshots](issues/11.08.md) — P1; blockers: 11.05, 11.06, 08.10
- [11.09 [DEVOPS] Verify release readiness and demonstrate end to end](issues/11.09.md) — P1; blockers: 11.08, 10.10, 10.11, 11.03
- [11.10 [DEVOPS] Complete handover and maintenance ownership](issues/11.10.md) — P1; blockers: 11.09

## M12 — Advanced and Stretch Features

- [12.01 [FRONTEND] Build rich guided map tours](issues/12.01.md) — P3; blockers: 11.09, 07.09
- [12.02 [FRONTEND] Expand English Gujarati and Hindi localization](issues/12.02.md) — P3; blockers: 11.09, 10.09
- [12.03 [FRONTEND] Analyze surveyed walkability and accessibility](issues/12.03.md) — P3; blockers: 11.09, 02.07
- [12.04 [FRONTEND] Create consented community audio archive](issues/12.04.md) — P3; blockers: 11.09, 06.09, 09.10
- [12.05 [FRONTEND] Prototype clearly hypothetical future scenarios](issues/12.05.md) — P3; blockers: 11.09, 12.03
- [12.06 [FRONTEND] Evaluate advanced 3D data and performance](issues/12.06.md) — P3; blockers: 11.09, 06.08
- [12.07 [FRONTEND] Build privacy-safe reported-issue hotspot views](issues/12.07.md) — P3; blockers: 11.09, 08.07, 08.09
- [12.08 [FRONTEND] Export approved research report and charts](issues/12.08.md) — P3; blockers: 11.09, 09.09
- [12.09 [FRONTEND] Evaluate human-reviewed qualitative AI assistance](issues/12.09.md) — P3; blockers: 11.09, 08.03, 09.10
