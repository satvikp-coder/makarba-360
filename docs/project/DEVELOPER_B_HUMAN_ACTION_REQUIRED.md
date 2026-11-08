# Developer B: actions only a person can do

Nothing here is approved or done. Claude cannot invent approvals, photos, permissions or field results.

| ID | Issues | What is needed | Who | Where | Evidence to record | What it unblocks |
|---|---|---|---|---|---|---|
| H7 | #24, #124, #116 | Choose the production map tile provider and a monthly spending cap. Development works with free OSM tiles (see `docs/architecture/gis-design.md`). | project owner + supervisor | written decision | a short note with provider, region, monthly cap, comment on #24 | reliable public launch, #124 |
| H9 | #5, #120, #102, #123 | Verify the Makarba study boundary, road and place data against an authoritative source, and verify rights for every public photo, quote and historical claim. | research lead | per-asset records; field checks | source name, date, licence/permission per item | #5, #28, #120, #102, #123, real content in #77-#80 |
| H6 | #62, #117, #118, #119 | Real-device and field tests, researcher training, consented pilot. | research lead, trained researchers | physical devices; Makarba | test sheets, training log | pilot and mobile-compatibility acceptance |
| H-A11Y | #114 | Human keyboard and screen-reader review (NVDA/VoiceOver) and Gujarati/Hindi language review. | an assistive-technology user or reviewer, a fluent reviewer | real browsers/devices | written findings | #114, #129 |
| H-DEV-A | many | Varun delivers the Developer A items listed in the progress ledger (for example the real public API behind the contract). | Developer A | GitHub issues | merged PRs, conformance passing | live integration acceptance |
| H-IMG | #70, #124 | Before any Google Street View or Mapillary embed is enabled: look at Makarba on each provider's public map in a normal browser to see whether coverage exists; approve any spend and monthly cap; confirm terms with the institution. Both are DEFERRED (see `docs/research/historical-evidence.md`). | project owner + research lead | provider public maps in a browser | note per provider: coverage yes/no with date, approved cap or decision not to use | any provider embed; #124 |

When done, paste the evidence links on the matching issue and tell Claude to resume (see the resume prompt in the final report).

## Real-device check for the map explorer (issues #82, #117)

Automated Chromium tests pass (see `docs/design/public-website.md`), but a person must still confirm on real phones. Who: anyone with an Android phone (Chrome) and an iPhone (Safari). Steps: open the deployed or locally served `/explore`; tap Expand, select a place, rotate the phone, pinch-zoom the page to 200%, and (once search exists, #76) tap the search field so the keyboard opens. Check that the header navigation, Expand/Close buttons and map attribution are never covered. Record device, OS, browser version and pass/fail per step in a comment on #82. Claude then closes #82.

## Research-lead review of public methodology wording (issues #83, #4)

Who: the research lead. Where: `apps/web/src/ResearchPages.tsx` (or the live `/research/methodology` page). Steps: read the three public pages; confirm the sampling, counting and privacy statements match the approved research plan and consent process; list any wording to change as a comment on #83. Evidence: a comment on #83 saying "reviewed, approved" or listing edits, with the reviewer's own GitHub account. Claude then applies edits and updates the page once #4 is closed.
