# Developer B: actions only a person can do

Nothing here is approved or done. Claude cannot invent approvals, photos, permissions or field results.

| ID | Issues | What is needed | Who | Where | Evidence to record | What it unblocks |
|---|---|---|---|---|---|---|
| H7 | #24, #124, #116 | Choose the production map tile provider and a monthly spending cap. Development works with free OSM tiles (see `docs/architecture/gis-design.md`). | project owner + supervisor | written decision | a short note with provider, region, monthly cap, comment on #24 | reliable public launch, #124 |
| H9 | #5, #120, #102, #123 | Verify the Makarba study boundary, road and place data against an authoritative source, and verify rights for every public photo, quote and historical claim. | research lead | per-asset records; field checks | source name, date, licence/permission per item | #5, #28, #120, #102, #123, real content in #77-#80 |
| H6 | #62, #117, #118, #119 | Real-device and field tests, researcher training, consented pilot. | research lead, trained researchers | physical devices; Makarba | test sheets, training log | pilot and mobile-compatibility acceptance |
| H-A11Y | #114 | Human keyboard and screen-reader review (NVDA/VoiceOver) and Gujarati/Hindi language review. | an assistive-technology user or reviewer, a fluent reviewer | real browsers/devices | written findings | #114, #129 |
| H-DEV-A | many | Varun delivers the Developer A items listed in the progress ledger (for example the real public API behind the contract). | Developer A | GitHub issues | merged PRs, conformance passing | live integration acceptance |

When done, paste the evidence links on the matching issue and tell Claude to resume (see the resume prompt in the final report).

## Real-device check for the map explorer (issues #82, #117)

Automated Chromium tests pass (see `docs/design/public-website.md`), but a person must still confirm on real phones. Who: anyone with an Android phone (Chrome) and an iPhone (Safari). Steps: open the deployed or locally served `/explore`; tap Expand, select a place, rotate the phone, pinch-zoom the page to 200%, and (once search exists, #76) tap the search field so the keyboard opens. Check that the header navigation, Expand/Close buttons and map attribution are never covered. Record device, OS, browser version and pass/fail per step in a comment on #82. Claude then closes #82.
