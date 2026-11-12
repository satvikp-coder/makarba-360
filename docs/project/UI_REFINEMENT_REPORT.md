# Public UI refinement — 2026-11-12

Issue: follow-up to #80 (comparison navigation), #73 (home), #82 (responsive journeys). Closed history and allocation remain unchanged.
Branch: `dev-b/issue-80-comparison-index`.
PR: https://github.com/satvikp-coder/makarba-360/pull/227
Commits: `ccbbee7` introduces comparison discovery; the subsequent UI commit contains this report.

## Changes

- Connected Then & Now navigation to validated published places, with loading, empty, failure and retry states.
- Added an explicit no-comparison message on place comparison pages.
- Refined the React homepage, typographic hero, featured-place cards, reading widths, navigation, footer and responsive layouts.
- Kept featured places ahead of long source notes. Existing synthetic mock records supply the demo; no new geography or findings were authored.
- Reset scroll and focus the main region on page navigation, preserving map query interactions.
- Added home retry and refused protocol-relative hero URLs.

## Verification

- `pnpm --filter @makarba/web test`: 162 tests pass.
- `pnpm --filter @makarba/web build`: pass; existing lazy map/panorama chunks retained.
- `pnpm lint`: pass.
- `python3 scripts/check_budgets.py --dist apps/web/dist`: pass (CSS 14.1/15 KB gzip; initial JS 111.6/120 KB; map 297.6/340 KB).
- `MOCK_API_PORT=4141 WEB_PORT=5274 pnpm --filter @makarba/web exec playwright test --workers=1`: 82 pass, 1 opt-in screenshot generator skipped. Includes desktop/mobile axe, real WebGL, offline map, reduced motion, search, filters, history, gallery, panorama and fallback journeys. Final homepage ordering rechecked in the targeted three-test directory/responsive suite.
- Desktop and mobile screenshots inspected/generated at `/tmp/makarba-home-1280.png` and `/tmp/makarba-home-375.png`; generated artifacts are not source data.

## Security review and limitations

Public contracts, privacy allowlists, independent interview/subject positions and publication policy are unchanged. No raw records, credentials, original media, private GPS or new participant material were added. Browser evidence uses mock/fixture data; it establishes prototype behavior, not real study results, ethics approval, field-device validation or a production deployment. No paid provider or new package was activated. The existing mock dataset and sourced landmark media retain their disclosures/credits.

Verdict: PASS for the local synthetic public UI. Hosted checks must also pass on the final PR revision before merge.
