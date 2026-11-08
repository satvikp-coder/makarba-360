# Developer B: actions only a person can do

Nothing here is approved or done. Claude cannot invent approvals, photos, permissions or field results.

| ID | Issues | What is needed | Who | Where | Evidence to record | What it unblocks |
|---|---|---|---|---|---|---|
| H7 | #24, #124, #116 | Choose the production map tile provider and a monthly spending cap. Development works with free OSM tiles (see `docs/architecture/gis-design.md`). | project owner + supervisor | written decision | a short note with provider, region, monthly cap, comment on #24 | reliable public launch, #124 |
| H9 | #5, #120, #102, #123 | Verify the Makarba study boundary, road and place data against an authoritative source, and verify rights for every public photo, quote and historical claim. | research lead | per-asset records; field checks | source name, date, licence/permission per item | #5, #28, #120, #102, #123, real content in #77-#80 |
| H6 | #62, #117, #118, #119 | Real-device and field tests, researcher training, consented pilot. | research lead, trained researchers | physical devices; Makarba | test sheets, training log | pilot and mobile-compatibility acceptance |
| H-A11Y | #114 | Human keyboard and screen-reader review (NVDA/VoiceOver) and Gujarati/Hindi language review. | an assistive-technology user or reviewer, a fluent reviewer | real browsers/devices | written findings | #114, #129 |
| H-DEV-A | many | Varun delivers the Developer A items listed in the progress ledger (for example the real public API behind the contract). | Developer A | GitHub issues | merged PRs, conformance passing | live integration acceptance |
| H-OFFLINE | #54, #62, #117 | Run the offline probe on at least one real Android phone (Chrome) and one iPhone (Safari), following `tools/offline-probe/README.md`, and attach each downloaded JSON report plus notes to issue #54. Then decide with the research lead: custom offline PWA or approved ODK/Kobo path. | anyone with the phones; research lead for the decision | real phones | JSON reports and notes as comments or attachments on #54 | #54 closure, then #62 (network and device-loss tests) and #117 (mobile compatibility) |
| H-CI | #115 | Turn on branch protection for `main` and require the five checks printed by `python scripts/check_ci_policy.py` (ci/node, ci/conformance, ci/browser, ci/database, planning/planning); agree or change the performance budgets in `scripts/check_budgets.py`. | repository owner (and both developers for budgets) | GitHub Settings > Branches (or rulesets) | screenshot or `gh api repos/satvikp-coder/makarba-360/branches/main/protection` output; a comment on #115 with the agreed budgets | the 'failing checks prevent merge' guarantee being enforced by GitHub instead of by process |
| H-IMG | #70, #124 | Before any Google Street View or Mapillary embed is enabled: look at Makarba on each provider's public map in a normal browser to see whether coverage exists; approve any spend and monthly cap; confirm terms with the institution. Both are DEFERRED (see `docs/research/historical-evidence.md`). | project owner + research lead | provider public maps in a browser | note per provider: coverage yes/no with date, approved cap or decision not to use | any provider embed; #124 |

When done, paste the evidence links on the matching issue and tell Claude to resume (see the resume prompt in the final report).

## Real-device check for the map explorer (issues #82, #117)

Automated Chromium tests pass (see `docs/design/public-website.md`), but a person must still confirm on real phones. Who: anyone with an Android phone (Chrome) and an iPhone (Safari). Steps: open the deployed or locally served `/explore`; tap Expand, select a place, rotate the phone, pinch-zoom the page to 200%, and (once search exists, #76) tap the search field so the keyboard opens. Check that the header navigation, Expand/Close buttons and map attribution are never covered. Record device, OS, browser version and pass/fail per step in a comment on #82. Claude then closes #82.

## Research-lead review of public methodology wording (issues #83, #4)

Who: the research lead. Where: `apps/web/src/ResearchPages.tsx` (or the live `/research/methodology` page). Steps: read the three public pages; confirm the sampling, counting and privacy statements match the approved research plan and consent process; list any wording to change as a comment on #83. Evidence: a comment on #83 saying "reviewed, approved" or listing edits, with the reviewer's own GitHub account. Claude then applies edits and updates the page once #4 is closed.

# Master checklist by person (updated 2026-11-08)

Check names below are the real ones reported by GitHub for `main`: `node (ubuntu-latest)`, `node (windows-latest)`, `conformance`, `browser`, `database`, `planning`.

## Project owner (repository owner)
1. **Branch protection (#115, H-CI).** GitHub > Settings > Rules > Rulesets > New branch ruleset. Easiest: create it from `docs/project/branch-ruleset.json` (target: default branch; require a pull request with 0 approvals; require the six checks above; block force pushes and deletion; no bypass actors). Claude tried to create it through the API and was not permitted, so it is **not enforced today**. Emergency path: the owner can disable or edit the ruleset in the same Settings page. Evidence: `gh api repos/satvikp-coder/makarba-360/rules/branches/main` showing the rules, plus a comment on #115. PASS = a PR with a failing check cannot be merged. Unblocks: honest "failing checks prevent merge" on #115, then #126.
2. **Performance budgets (#115).** Read `scripts/check_budgets.py` (entry JS 120 KB gzip, map chunk 340, worker 170, CSS 15, panorama 25; API p95 300 ms) and say "approved" or give new numbers in a comment on #115.
3. **Map tile provider and cap (#24, #124, H7).** Compare providers (OpenStreetMap standard tiles are for development only; see `docs/architecture/gis-design.md`), choose one, set a monthly spending cap, record region and secret store. Do not enable paid services before this note exists.
4. **Street imagery (#70, H-IMG).** Decide use or not; if yes, someone checks Makarba coverage by eye on each provider's public map and a cap is approved.
5. **Stakeholder capability matrix (#6).** Convene the stakeholders and approve or amend `docs/project/contracts/capability-matrix.json` (set `approved_by`, `approved_on`, remove PROPOSED). Unblocks #35, closure of #41, enforcement claims everywhere.

## Research lead
1. **Study area (#5, H9).** Choose the authoritative source for the Makarba boundary; produce a GeoJSON polygon (WGS 84) with source, date, licence; check it with `packages/gis-io` rules (`validateImport`); record who verified it and how (site visit or authoritative map). PASS = file accepted by the import check and signed off on #5. Unblocks #28, #120, #130.
2. **Roads and candidate places (#28, #120).** Same procedure per road corridor; field-check at least the candidate list agreed in the field SOP (`docs/research/field-visit-sop.md`); record per item source, date, licence and verifier.
3. **Historical sources and media (#123).** For every item intended for publication fill a source register row: citation, creator, original date and precision, access date, rights/licence or permission document, consent where people appear, viewpoint and direction, verifier different from the enterer. Run `auditPublication` (`packages/place-content/src/audit.ts`) over the records; PASS = verdict PASS and every public item in `publishable`. Items with no date or image stay "unavailable". Never certify a claim because the software accepts it.
4. **Methodology and thresholds (#83, #4).** Confirm the public wording, the k=5 small-group threshold and the blueprint page mapping (`docs/source/traceability.md`).
5. **Consent and ethics (#11, #118, #119).** No participant collection starts until institutional approval exists and researchers are trained. Pilot only with the approved consent script (Gujarati script reviewed by a fluent speaker).
6. **Offline decision (#54).** After the two device reports arrive, choose PWA or ODK/KoboToolbox and record it on #54.

## Real-device tester (one Android phone, one iPhone)
**Offline probe (#54, H-OFFLINE).** Follow `tools/offline-probe/README.md` on each phone; attach the JSON reports and notes (model, OS, browser versions; how the app was killed; airplane-mode result) to #54. PASS = no FAIL rows, key recovered after reload, marker recovered after kill, offline reload served from cache; anything else is a finding to record, not hidden. Failure means the ODK/Kobo path is weighed.
**Map explorer (#82, #117, H6).** Open `/explore` (deployed address, or `http://localhost:5173` via `adb reverse tcp:5173 tcp:5173` on Android). Steps: wait for map; tap Expand and Close on the bottom sheet; select a place; rotate to landscape and back; pinch-zoom the page to 200%; tap the search box so the soft keyboard opens and confirm header navigation, Expand/Close and the map attribution stay visible; reload and use Back. Also record: WebGL works (map appears), GPS permission prompt behaviour if the field app is tested, session survives a screen lock. Record device, OS, browser version and PASS/FAIL per step on #82; repeat the compatibility sweep for #117 on at least two Android and two iPhone models if available. Emulation never counts.

## Screen-reader and language reviewers (#114, #129, H-A11Y)
Journeys to test with NVDA (Windows), VoiceOver (iPhone) and TalkBack (Android): (1) skip link and navigation; (2) find a place by search, select it, open the profile; (3) Then & Now in text view and slider; (4) open and close the photo lightbox; (5) Urban Insights tables including a hidden group; (6) Community Voices; (7) methodology and accessibility pages. For each: can you complete it, is every control named, is the order logical, is anything announced wrongly or twice? Record findings on #114 with the journey number. A fluent Gujarati and Hindi reviewer must review translations before any language is enabled; Claude never marks translations as approved.

## Developer A (Varun)
Follow `docs/project/DEVELOPER_B_INTEGRATION_HANDOFF.md`, in this order: #6 (needs stakeholders), #37, #84, #92, #38, #40, #60, #81, then #193 (zod runtime advisory first). Mount `safe-errors.ts`, add rate limiting.

## What Claude resumes after each item
#5 verified: #28, #120, #130. Two device reports: #54, then #62, #117. Ruleset enabled and budgets agreed: close #115. Matrix approved plus #38/#37/#40 live: finish #41. `stories` contract adopted and endpoint live: finish #80. Live API plus devices: #113, #82. Source register complete: finish #123. After #115, #117, #120, #123, #125 and Developer A items: #126, then #127, then the stretch issues #128–#135.
