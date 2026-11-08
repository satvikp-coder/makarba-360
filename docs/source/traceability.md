# Source blueprint page traceability

Source: `Makarba_360_Complete_Project_Blueprint.pdf` (SHA-256 `f03118d0f904673c8e751599e128540ffe5ed5daac1d4fc6c969474f802b0994`; the file itself stays outside Git). Generated from `page-traceability.json` by `scripts/check_traceability.py --write-md`; do not edit by hand.

| Page | Title | Requirements | Documents | GitHub issues | Caveat |
|---|---|---|---|---|---|
| 1 | Cover: Makarba 360, People, Places & Change | R01 | docs/product/vision.md<br>docs/research/methodology.md | #3, #6, #45, #72, #81 | Contains the non-negotiable rule: the public does not fill surveys. |
| 2 | Quick summary: what you are building | R03 R04 R05 R06 R17 | docs/product/vision.md<br>docs/product/user-journeys.md | #15, #16, #29, #63, #64, #65, #66, #67, #68, #69, #70, #74, #75, #76, #77, #78, #79, #82, #84, #85, #86, #87, #88, #89, #93, #133 |  |
| 3 | 1. What participatory mapping means | R10 R15 | docs/research/methodology.md | #46, #50, #65, #71, #89, #102, #111 |  |
| 4 | 2. Who uses the software? | R01 R07 R16 | docs/product/personas.md<br>docs/project/capability-matrix.md | #3, #6, #32, #33, #34, #35, #44, #45, #72, #81, #103, #105, #118 |  |
| 5 | 3. What the public website looks like | R03 R04 R20 | docs/design/public-website.md<br>docs/product/screen-inventory.md | #12, #15, #16, #20, #29, #63, #64, #74, #75, #76, #77, #78, #82, #83, #114, #129 |  |
| 6 | 4. The interactive Makarba map | R02 R03 R06 | docs/architecture/gis-design.md<br>docs/design/public-website.md | #5, #15, #16, #23, #26, #27, #28, #29, #69, #70, #74, #75, #76, #79, #82, #101, #120, #133 | Layer names are suggestions; boundary and place data remain unverified. |
| 7 | 5. The Then & Now and 360-degree features | R05 R06 | docs/research/historical-evidence.md<br>docs/architecture/media-pipeline.md | #65, #66, #67, #68, #69, #70, #79, #133 | The 2021 example is an illustration; no 2021 photograph is claimed to exist. |
| 8 | 6. The most important feature: field survey + GPS | R10 R11 R12 | docs/architecture/data-model.md<br>docs/research/gps-protocol.md<br>docs/design/fieldwork-app.md | #48, #49, #50, #54, #55, #56, #57, #58, #59, #62, #89, #100, #111 | The encrypted-draft aspiration must be validated, not assumed (see docs/source/README.md). |
| 9 | 7. How GPS recording should work | R11 | docs/research/gps-protocol.md<br>docs/architecture/data-model.md | #48, #49, #100, #111 |  |
| 10 | 8. Complete survey structure for your team | R08 R09 | docs/research/survey-questionnaire.md<br>docs/research/consent-protocol.md | #11, #37, #42, #43, #46, #47, #51 | The 5-8 minute target is measured in the pilot, not asserted. |
| 11 | 9. An example survey record | R09 R10 | docs/research/data-dictionary.md | #42, #43, #46, #50, #51, #89, #111 | FICTIONAL example record. It must never become a result, a coordinate or a statement about Makarba. |
| 12 | 10. Field visit: what to do before, during and after | R07 R21 R24 | docs/research/field-visit-sop.md | #4, #11, #32, #33, #34, #35, #44, #83, #118, #119, #120, #121, #122, #123, #125, #126, #127 |  |
| 13 | 11. Suggested fieldwork schedule and sample | R21 R24 | docs/research/sampling-plan.md<br>docs/research/field-visit-sop.md | #4, #11, #83, #118, #119, #120, #121, #122, #123, #125, #126, #127 | The three-day first pass is a suggested sequence, not a committed schedule; the sample is not a population estimate. |
| 14 | 12. The private researcher dashboard | R07 R12 R14 | docs/design/fieldwork-app.md<br>docs/design/admin-dashboard.md | #32, #33, #34, #35, #44, #53, #54, #55, #56, #57, #58, #59, #62, #96, #99, #100, #101, #118 |  |
| 15 | 13. The Community Insights dashboard | R17 R18 | docs/architecture/analytics.md | #84, #85, #86, #87, #88, #89, #90, #91, #92, #93 | Public charts must use real cleaned responses; before fieldwork show an empty or clearly labelled demonstration state. |
| 16 | 14. How the software works behind the scenes | R16 R19 R22 | docs/architecture/overview.md<br>docs/architecture/component-diagram.md | #10, #39, #40, #81, #95, #103, #104, #105, #116, #124, #127 |  |
| 17 | Basic data structure | R02 R10 R16 | docs/architecture/data-model.md | #5, #23, #26, #27, #28, #50, #81, #89, #101, #103, #105, #111, #120 |  |
| 18 | 15. Design choices for a beautiful final project | R03 R20 | docs/design/design-system.md<br>docs/design/accessibility.md | #12, #15, #16, #20, #29, #74, #75, #76, #82, #83, #114, #129 |  |
| 19 | 16. Privacy, consent and research quality | R08 R13 R16 R19 | docs/research/consent-protocol.md<br>docs/architecture/privacy-security.md<br>docs/architecture/media-pipeline.md | #11, #37, #39, #47, #60, #61, #81, #95, #103, #104, #105, #116 |  |
| 20 | 17. Build plan, testing and handover | R22 R23 R24 | docs/project/test-strategy.md<br>docs/project/implementation-order.md | #10, #40, #106, #107, #108, #109, #110, #111, #112, #113, #114, #115, #117, #119, #120, #121, #124, #125, #126, #127 |  |
| 21 | 18. A realistic first demonstration | R24 | docs/product/user-journeys.md<br>docs/project/test-strategy.md | #119, #120, #121, #125, #126, #127 | A demonstration needs real collected data; none exists. |
| 22 | 19. Ready-to-use fieldwork checklist | R12 R21 | docs/research/field-visit-sop.md | #4, #11, #54, #55, #56, #57, #58, #59, #62, #83, #118, #122, #123 |  |
| 23 | 20. References and implementation notes | R21 R22 | docs/source/technical-references.md | #4, #10, #11, #40, #83, #118, #122, #123, #124, #127 | References are not substitutes for local verification, university guidance or permission to use historical material. |

Requirements not taken from a blueprint page:

- R25: Stretch scope (guided tours, walkability, audio archive, hypothetical scenarios, hotspots, report export) comes from the user master prompt, not from a blueprint page; it is traced through requirements.md only.

Facts are never taken from this matrix: it only says where a page's content is planned, specified and tracked. Boundary, place access, site conditions, historical images and survey findings remain unverified until the research steps in the human-action list are done.
