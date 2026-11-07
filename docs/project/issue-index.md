# Issue index

136 focused issues: the supplied minimum inventory totals 133; separate ethics/legal, structured observation and conditional fallback-import tasks make 136. No product issue is completed by this planning run. Stable IDs make publishing resumable.

## M00 — Requirements, Research and Repository Foundation

- [00.01 [DEVOPS] Establish repository governance](https://github.com/satvikp-coder/makarba-360/issues/1) — P0; blockers: none
- [00.02 [DEVOPS] Trace all source blueprint requirements](https://github.com/satvikp-coder/makarba-360/issues/2) — P0; blockers: #1
- [00.03 [DEVOPS] Approve product vision and boundaries](https://github.com/satvikp-coder/makarba-360/issues/3) — P0; blockers: #2
- [00.04 [DEVOPS] Validate research questions and methodology](https://github.com/satvikp-coder/makarba-360/issues/4) — P0; blockers: #3
- [00.05 [DEVOPS] Specify and verify geographical study extent](https://github.com/satvikp-coder/makarba-360/issues/5) — P0; blockers: #4
- [00.06 [DEVOPS] Approve stakeholder capability matrix](https://github.com/satvikp-coder/makarba-360/issues/6) — P0; blockers: #3
- [00.07 [DEVOPS] Baseline functional requirements catalogue](https://github.com/satvikp-coder/makarba-360/issues/7) — P0; blockers: #2, #6
- [00.08 [DEVOPS] Baseline non-functional requirements](https://github.com/satvikp-coder/makarba-360/issues/8) — P0; blockers: #7
- [00.09 [DEVOPS] Review architecture diagrams and ADR baseline](https://github.com/satvikp-coder/makarba-360/issues/9) — P0; blockers: #8
- [00.10 [DEVOPS] Scaffold development setup and CI governance](https://github.com/satvikp-coder/makarba-360/issues/10) — P0; blockers: #9
- [00.11 [DEVOPS] Obtain institutional ethics and legal verification](https://github.com/satvikp-coder/makarba-360/issues/11) — P0; blockers: #4, #6

## M01 — UI/UX and Design System

- [01.01 [FRONTEND] Define visual identity and accessible tokens](https://github.com/satvikp-coder/makarba-360/issues/12) — P2; blockers: #3
- [01.02 [FRONTEND] Design public information architecture](https://github.com/satvikp-coder/makarba-360/issues/13) — P2; blockers: #12, #7
- [01.03 [FRONTEND] Specify home page wireframes](https://github.com/satvikp-coder/makarba-360/issues/14) — P2; blockers: #13
- [01.04 [FRONTEND] Specify desktop map-first layout](https://github.com/satvikp-coder/makarba-360/issues/15) — P2; blockers: #13
- [01.05 [FRONTEND] Specify mobile map bottom sheet](https://github.com/satvikp-coder/makarba-360/issues/16) — P2; blockers: #15
- [01.06 [FRONTEND] Design place profile interface](https://github.com/satvikp-coder/makarba-360/issues/17) — P2; blockers: #15
- [01.07 [FRONTEND] Design Then and Now comparison](https://github.com/satvikp-coder/makarba-360/issues/18) — P2; blockers: #17
- [01.08 [FRONTEND] Design Community Insights dashboard](https://github.com/satvikp-coder/makarba-360/issues/19) — P2; blockers: #13, #4
- [01.09 [FRONTEND] Design accessible field interview screens](https://github.com/satvikp-coder/makarba-360/issues/20) — P2; blockers: #12, #6
- [01.10 [FRONTEND] Design responsive research management](https://github.com/satvikp-coder/makarba-360/issues/21) — P2; blockers: #12, #6

## M02 — GIS, Map Data and Spatial Foundation

- [02.01 [GIS] Provision PostGIS migrations and roles](https://github.com/satvikp-coder/makarba-360/issues/22) — P1; blockers: #10, #36
- [02.02 [GIS] Store and validate versioned study boundary](https://github.com/satvikp-coder/makarba-360/issues/23) — P1; blockers: #5, #22
- [02.03 [GIS] Select basemap provider and attribution](https://github.com/satvikp-coder/makarba-360/issues/24) — P1; blockers: #9
- [02.04 [GIS] Integrate initial MapLibre map](https://github.com/satvikp-coder/makarba-360/issues/25) — P1; blockers: #23, #24, #15
- [02.05 [GIS] Implement location category taxonomy](https://github.com/satvikp-coder/makarba-360/issues/26) — P1; blockers: #22, #12
- [02.06 [GIS] Support point route and polygon locations](https://github.com/satvikp-coder/makarba-360/issues/27) — P1; blockers: #22, #26
- [02.07 [GIS] Import and verify road corridors](https://github.com/satvikp-coder/makarba-360/issues/28) — P1; blockers: #23, #27
- [02.08 [GIS] Provide reusable spatial search and clustering](https://github.com/satvikp-coder/makarba-360/issues/29) — P1; blockers: #25, #27
- [02.09 [GIS] Implement geographic candidate editing](https://github.com/satvikp-coder/makarba-360/issues/30) — P1; blockers: #27, #35
- [02.10 [GIS] Implement validated GIS import and export](https://github.com/satvikp-coder/makarba-360/issues/31) — P1; blockers: #27, #35

## M03 — Authentication, Privacy and Data Security

- [03.01 [PRIVACY] Integrate identity provider and secure sessions](https://github.com/satvikp-coder/makarba-360/issues/32) — P0; blockers: #6, #10
- [03.02 [PRIVACY] Implement researcher invitation and deactivation](https://github.com/satvikp-coder/makarba-360/issues/33) — P0; blockers: #32
- [03.03 [PRIVACY] Implement role and study authorization](https://github.com/satvikp-coder/makarba-360/issues/34) — P0; blockers: #32, #6
- [03.04 [PRIVACY] Enforce capability matrix across API and UI](https://github.com/satvikp-coder/makarba-360/issues/35) — P0; blockers: #34
- [03.05 [PRIVACY] Harden database access and migration credentials](https://github.com/satvikp-coder/makarba-360/issues/36) — P0; blockers: #9
- [03.06 [PRIVACY] Implement scoped versioned consent records](https://github.com/satvikp-coder/makarba-360/issues/37) — P0; blockers: #35, #11
- [03.07 [PRIVACY] Protect raw interview and GPS endpoints](https://github.com/satvikp-coder/makarba-360/issues/38) — P0; blockers: #35, #36
- [03.08 [PRIVACY] Implement security audit events](https://github.com/satvikp-coder/makarba-360/issues/39) — P0; blockers: #35, #36
- [03.09 [PRIVACY] Configure secure secrets and environments](https://github.com/satvikp-coder/makarba-360/issues/40) — P0; blockers: #10
- [03.10 [PRIVACY] Test security threat model and privacy boundaries](https://github.com/satvikp-coder/makarba-360/issues/41) — P0; blockers: #38, #39, #40

## M04 — Field Survey and GPS Collection

- [04.01 [SURVEY] Implement survey question and answer schema](https://github.com/satvikp-coder/makarba-360/issues/42) — P1; blockers: #22, #4
- [04.02 [SURVEY] Implement immutable questionnaire versions](https://github.com/satvikp-coder/makarba-360/issues/43) — P1; blockers: #42
- [04.03 [SURVEY] Implement field visit sessions](https://github.com/satvikp-coder/makarba-360/issues/44) — P1; blockers: #35, #23
- [04.04 [SURVEY] Implement interview start workflow](https://github.com/satvikp-coder/makarba-360/issues/45) — P1; blockers: #43, #44, #20
- [04.05 [SURVEY] Capture participant categories and official claims](https://github.com/satvikp-coder/makarba-360/issues/46) — P1; blockers: #42, #45
- [04.06 [SURVEY] Record consent and interview metadata](https://github.com/satvikp-coder/makarba-360/issues/47) — P1; blockers: #37, #45
- [04.07 [SURVEY] Capture mobile geolocation and permission state](https://github.com/satvikp-coder/makarba-360/issues/48) — P1; blockers: #47, #20
- [04.08 [SURVEY] Display GPS quality recapture and corrections](https://github.com/satvikp-coder/makarba-360/issues/49) — P1; blockers: #48, #25
- [04.09 [SURVEY] Store independent interview and subject geography](https://github.com/satvikp-coder/makarba-360/issues/50) — P1; blockers: #42, #27, #49
- [04.10 [SURVEY] Render and validate versioned questions](https://github.com/satvikp-coder/makarba-360/issues/51) — P1; blockers: #43, #46, #50
- [04.11 [SURVEY] Implement interview review and durable save](https://github.com/satvikp-coder/makarba-360/issues/52) — P1; blockers: #51, #47, #55
- [04.12 [SURVEY] Implement own submission history and corrections](https://github.com/satvikp-coder/makarba-360/issues/53) — P1; blockers: #52, #57
- [04.13 [SURVEY] Capture structured field observations separately from interviews](https://github.com/satvikp-coder/makarba-360/issues/96) — P1; blockers: #44, #27, #35, #20

## M05 — Offline Fieldwork, Synchronisation and Media

- [05.01 [OFFLINE] Validate offline approach and fallback](https://github.com/satvikp-coder/makarba-360/issues/54) — P0; blockers: #11, #9, #20
- [05.02 [OFFLINE] Persist protected recoverable local drafts](https://github.com/satvikp-coder/makarba-360/issues/55) — P0; blockers: #54, #42
- [05.03 [OFFLINE] Implement offline session and device lock policy](https://github.com/satvikp-coder/makarba-360/issues/56) — P0; blockers: #54, #32
- [05.04 [OFFLINE] Implement idempotent transactional sync](https://github.com/satvikp-coder/makarba-360/issues/57) — P0; blockers: #43, #50, #38, #56
- [05.05 [OFFLINE] Handle sync retries conflicts and rejections](https://github.com/satvikp-coder/makarba-360/issues/58) — P1; blockers: #57, #55
- [05.06 [OFFLINE] Prevent duplicates without deleting genuine interviews](https://github.com/satvikp-coder/makarba-360/issues/59) — P1; blockers: #57
- [05.07 [OFFLINE] Implement quarantined resumable media uploads](https://github.com/satvikp-coder/makarba-360/issues/60) — P1; blockers: #40, #38, #57
- [05.08 [OFFLINE] Manage photo metadata credit and permissions](https://github.com/satvikp-coder/makarba-360/issues/61) — P1; blockers: #60, #37
- [05.09 [OFFLINE] Test field network and device-loss recovery](https://github.com/satvikp-coder/makarba-360/issues/62) — P1; blockers: #58, #59, #61
- [05.10 [OFFLINE] Implement conditional approved external collection importer](https://github.com/satvikp-coder/makarba-360/issues/97) — P1; blockers: #54, #57, #43

## M06 — Heritage, Historical Evidence and 360° Content

- [06.01 [HISTORICAL] Implement versioned place content model](https://github.com/satvikp-coder/makarba-360/issues/63) — P2; blockers: #27
- [06.02 [HISTORICAL] Implement editorial place description workflow](https://github.com/satvikp-coder/makarba-360/issues/64) — P2; blockers: #63, #35
- [06.03 [HISTORICAL] Implement historical evidence provenance](https://github.com/satvikp-coder/makarba-360/issues/65) — P2; blockers: #63, #4
- [06.04 [HISTORICAL] Implement sourced timeline events](https://github.com/satvikp-coder/makarba-360/issues/66) — P2; blockers: #65
- [06.05 [HISTORICAL] Implement historical comparison pair model](https://github.com/satvikp-coder/makarba-360/issues/67) — P2; blockers: #65, #61
- [06.06 [HISTORICAL] Build accessible Then and Now component](https://github.com/satvikp-coder/makarba-360/issues/68) — P2; blockers: #67, #18
- [06.07 [HISTORICAL] Integrate owned panorama viewer](https://github.com/satvikp-coder/makarba-360/issues/69) — P2; blockers: #61, #17
- [06.08 [HISTORICAL] Evaluate third-party street imagery licensing](https://github.com/satvikp-coder/makarba-360/issues/70) — P2; blockers: #24, #9
- [06.09 [HISTORICAL] Publish verified location stories and accounts](https://github.com/satvikp-coder/makarba-360/issues/71) — P2; blockers: #64, #66, #37

## M07 — Public Interactive Website

- [07.01 [FRONTEND] Build public shell and accessible navigation](https://github.com/satvikp-coder/makarba-360/issues/72) — P2; blockers: #10, #13
- [07.02 [FRONTEND] Build evidence-led home page](https://github.com/satvikp-coder/makarba-360/issues/73) — P2; blockers: #72, #14, #81
- [07.03 [FRONTEND] Build public map explorer](https://github.com/satvikp-coder/makarba-360/issues/74) — P2; blockers: #25, #72, #81
- [07.04 [FRONTEND] Build map layer and category controls](https://github.com/satvikp-coder/makarba-360/issues/75) — P2; blockers: #74, #26
- [07.05 [FRONTEND] Build public location search](https://github.com/satvikp-coder/makarba-360/issues/76) — P2; blockers: #29, #81, #74
- [07.06 [FRONTEND] Build location profile pages](https://github.com/satvikp-coder/makarba-360/issues/77) — P2; blockers: #81, #17, #64
- [07.07 [FRONTEND] Build approved photo gallery](https://github.com/satvikp-coder/makarba-360/issues/78) — P2; blockers: #61, #77
- [07.08 [FRONTEND] Present panorama and unavailable coverage states](https://github.com/satvikp-coder/makarba-360/issues/79) — P2; blockers: #69, #70, #77
- [07.09 [FRONTEND] Integrate public history and Community Voices](https://github.com/satvikp-coder/makarba-360/issues/80) — P2; blockers: #68, #71, #77
- [07.10 [FRONTEND] Implement read-only public projection API](https://github.com/satvikp-coder/makarba-360/issues/81) — P2; blockers: #38, #103, #92
- [07.11 [FRONTEND] Verify responsive public map journeys](https://github.com/satvikp-coder/makarba-360/issues/82) — P2; blockers: #74, #77, #16
- [07.12 [FRONTEND] Publish methodology sources and accessibility pages](https://github.com/satvikp-coder/makarba-360/issues/83) — P2; blockers: #72, #4, #13

## M08 — Community Insights and Survey Analytics

- [08.01 [ANALYTICS] Implement reproducible valid-answer aggregation](https://github.com/satvikp-coder/makarba-360/issues/84) — P2; blockers: #43, #99, #37
- [08.02 [ANALYTICS] Aggregate stakeholder distributions](https://github.com/satvikp-coder/makarba-360/issues/85) — P2; blockers: #84
- [08.03 [ANALYTICS] Analyze reported issues with codebook](https://github.com/satvikp-coder/makarba-360/issues/86) — P2; blockers: #84, #51
- [08.04 [ANALYTICS] Analyze ratings and perceived changes](https://github.com/satvikp-coder/makarba-360/issues/87) — P2; blockers: #84
- [08.05 [ANALYTICS] Build stakeholder comparison chart tables](https://github.com/satvikp-coder/makarba-360/issues/88) — P2; blockers: #85, #87, #92, #19
- [08.06 [ANALYTICS] Publish location-level sample summaries](https://github.com/satvikp-coder/makarba-360/issues/89) — P2; blockers: #84, #50, #92
- [08.07 [ANALYTICS] Build safe survey coverage snapshots](https://github.com/satvikp-coder/makarba-360/issues/90) — P2; blockers: #84, #92, #23
- [08.08 [ANALYTICS] Implement constrained dashboard cohorts and dates](https://github.com/satvikp-coder/makarba-360/issues/91) — P2; blockers: #85, #86, #87, #92
- [08.09 [ANALYTICS] Enforce disclosure and small-sample controls](https://github.com/satvikp-coder/makarba-360/issues/92) — P2; blockers: #84, #41
- [08.10 [ANALYTICS] Verify analytics with reproducible fixtures](https://github.com/satvikp-coder/makarba-360/issues/93) — P2; blockers: #85, #86, #87, #90, #91

## M09 — Research Administration and Publication Management

- [09.01 [ADMIN] Build role-limited research dashboard](https://github.com/satvikp-coder/makarba-360/issues/94) — P1; blockers: #35, #21
- [09.02 [ADMIN] Build account and training administration](https://github.com/satvikp-coder/makarba-360/issues/95) — P1; blockers: #94, #33
- [09.03 [ADMIN] Monitor visits and research progress](https://github.com/satvikp-coder/makarba-360/issues/98) — P1; blockers: #94, #44
- [09.04 [ADMIN] Build survey moderation and validation queue](https://github.com/satvikp-coder/makarba-360/issues/99) — P1; blockers: #94, #51, #39
- [09.05 [ADMIN] Review private GPS quality and outliers](https://github.com/satvikp-coder/makarba-360/issues/100) — P1; blockers: #99, #49, #23
- [09.06 [ADMIN] Approve candidate locations and geometry](https://github.com/satvikp-coder/makarba-360/issues/101) — P1; blockers: #94, #30
- [09.07 [ADMIN] Review historical evidence and media rights](https://github.com/satvikp-coder/makarba-360/issues/102) — P1; blockers: #94, #65, #61
- [09.08 [ADMIN] Implement publication preview approval and revoke](https://github.com/satvikp-coder/makarba-360/issues/103) — P1; blockers: #99, #101, #102, #39
- [09.09 [ADMIN] Implement purpose-limited anonymised exports](https://github.com/satvikp-coder/makarba-360/issues/104) — P1; blockers: #99, #92, #31
- [09.10 [ADMIN] Implement correction withdrawal and retention workflows](https://github.com/satvikp-coder/makarba-360/issues/105) — P1; blockers: #103, #37, #39

## M10 — Quality Assurance, Accessibility and Performance

- [10.01 [DEVOPS] Establish meaningful unit test harness](https://github.com/satvikp-coder/makarba-360/issues/106) — P1; blockers: #10
- [10.02 [DEVOPS] Test API integration and validation](https://github.com/satvikp-coder/makarba-360/issues/107) — P1; blockers: #106, #57, #81
- [10.03 [DEVOPS] Test migrations and spatial invariants](https://github.com/satvikp-coder/makarba-360/issues/108) — P1; blockers: #106, #31
- [10.04 [DEVOPS] Test authorization abuse paths](https://github.com/satvikp-coder/makarba-360/issues/109) — P0; blockers: #107, #41
- [10.05 [DEVOPS] Test private-to-public exposure boundary](https://github.com/satvikp-coder/makarba-360/issues/110) — P0; blockers: #107, #103, #104
- [10.06 [DEVOPS] Test GPS permission quality and correction edges](https://github.com/satvikp-coder/makarba-360/issues/111) — P1; blockers: #50, #106
- [10.07 [DEVOPS] Test offline to online sync reliability](https://github.com/satvikp-coder/makarba-360/issues/112) — P0; blockers: #62, #107
- [10.08 [DEVOPS] Test end-to-end public field and review journeys](https://github.com/satvikp-coder/makarba-360/issues/113) — P1; blockers: #82, #105, #93, #112
- [10.09 [DEVOPS] Audit keyboard screen reader and localization access](https://github.com/satvikp-coder/makarba-360/issues/114) — P1; blockers: #82, #94, #20
- [10.10 [DEVOPS] Enforce performance security and CI gates](https://github.com/satvikp-coder/makarba-360/issues/115) — P1; blockers: #109, #110, #113, #114
- [10.11 [DEVOPS] Rehearse encrypted backup and restore](https://github.com/satvikp-coder/makarba-360/issues/116) — P1; blockers: #105, #124
- [10.12 [DEVOPS] Validate real mobile browser compatibility](https://github.com/satvikp-coder/makarba-360/issues/117) — P1; blockers: #111, #112, #114

## M11 — Field Pilot, Launch and Final Handover

- [11.01 [DEVOPS] Train researchers and rehearse field checklist](https://github.com/satvikp-coder/makarba-360/issues/118) — P1; blockers: #11, #53, #62
- [11.02 [DEVOPS] Run consent-approved small field usability pilot](https://github.com/satvikp-coder/makarba-360/issues/119) — P1; blockers: #118, #109, #117
- [11.03 [DEVOPS] Verify candidate places and road data](https://github.com/satvikp-coder/makarba-360/issues/120) — P1; blockers: #28, #101
- [11.04 [DEVOPS] Run real GPS and offline pilot](https://github.com/satvikp-coder/makarba-360/issues/121) — P1; blockers: #119, #112
- [11.05 [DEVOPS] Audit survey consent and data quality](https://github.com/satvikp-coder/makarba-360/issues/122) — P1; blockers: #121, #99, #100
- [11.06 [DEVOPS] Audit historical sources and media attribution](https://github.com/satvikp-coder/makarba-360/issues/123) — P1; blockers: #102, #68, #69
- [11.07 [DEVOPS] Provision staging and production deployment](https://github.com/satvikp-coder/makarba-360/issues/124) — P1; blockers: #40, #9, #108
- [11.08 [DEVOPS] Validate final research dataset and snapshots](https://github.com/satvikp-coder/makarba-360/issues/125) — P1; blockers: #122, #123, #93
- [11.09 [DEVOPS] Verify release readiness and demonstrate end to end](https://github.com/satvikp-coder/makarba-360/issues/126) — P1; blockers: #125, #115, #116, #120
- [11.10 [DEVOPS] Complete handover and maintenance ownership](https://github.com/satvikp-coder/makarba-360/issues/127) — P1; blockers: #126

## M12 — Advanced and Stretch Features

- [12.01 [FRONTEND] Build rich guided map tours](https://github.com/satvikp-coder/makarba-360/issues/128) — P3; blockers: #126, #80
- [12.02 [FRONTEND] Expand English Gujarati and Hindi localization](https://github.com/satvikp-coder/makarba-360/issues/129) — P3; blockers: #126, #114
- [12.03 [FRONTEND] Analyze surveyed walkability and accessibility](https://github.com/satvikp-coder/makarba-360/issues/130) — P3; blockers: #126, #28
- [12.04 [FRONTEND] Create consented community audio archive](https://github.com/satvikp-coder/makarba-360/issues/131) — P3; blockers: #126, #71, #105
- [12.05 [FRONTEND] Prototype clearly hypothetical future scenarios](https://github.com/satvikp-coder/makarba-360/issues/132) — P3; blockers: #126, #130
- [12.06 [FRONTEND] Evaluate advanced 3D data and performance](https://github.com/satvikp-coder/makarba-360/issues/133) — P3; blockers: #126, #70
- [12.07 [FRONTEND] Build privacy-safe reported-issue hotspot views](https://github.com/satvikp-coder/makarba-360/issues/134) — P3; blockers: #126, #90, #92
- [12.08 [FRONTEND] Export approved research report and charts](https://github.com/satvikp-coder/makarba-360/issues/135) — P3; blockers: #126, #104
- [12.09 [FRONTEND] Evaluate human-reviewed qualitative AI assistance](https://github.com/satvikp-coder/makarba-360/issues/136) — P3; blockers: #126, #86, #105
