# Historical evidence and fact review

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

For every claim retain citation/creator, source type, access date, original date and precision, rights, geographic relevance, reviewer and evidence quality. Preferred primary records/dated imagery; secondary sources can contextualise with explicit confidence. Resident memories are accounts, not proven chronology. Officials are attributed only after status/authority and publication scope verification.

Target around 2021 vs 2026 only if evidence exists. Check same feature/viewpoint and record direction/position privately as appropriate, source dates and mismatch limitations. Slider images need rights and reviewed dates; approximate date visible as approximate, unsupported date cannot masquerade as exact. Timelines require supporting source per event; disputed accounts can coexist with labels. Georeferenced historic maps need control points/error notes and licence. Separate measured changes from visible differences and opinions. Editorial reviewer signs the current revision; stale source/permission revokes dependent publication.

## Versioned place content model (#63)

Implemented as `packages/place-content` (TypeScript + zod, synthetic tests). Mock/domain-level only: no database table or API route exists yet, so this is not a live integration (live prerequisite #27 and Developer A's schema review remain).

**Kinds.** `description` (editorial text, no dated claim) and `observation` (dated statement with an evidence kind: researcher observation, respondent account, historical claim, reviewer-checked fact). Each revision carries its own state, evidence quality, sources, rights flag and quote-consent flag. Dates are `{value, precision}` or both null; a value without precision is invalid and an unknown date is never replaced by a guessed year.

**Geometry is a different record.** `GeometryApproval` (per location and geometry revision) has no field on content, and `checkPublishable` accepts no geometry input. Approving the map shape therefore cannot approve any text or image.

**Lifecycle.** candidate → reviewed → approved → published → archived/withdrawn. Review cannot be skipped; published revisions are immutable (an edit creates a new candidate revision with review cleared and `supersedes` set); withdrawn and archived are terminal.

**Publication gate (all must hold).** state is approved; recorded reviewer who is not the author; revision is the latest; rights cleared; quote consent where there is a quote; for observations a known date, an evidence kind, at least one source, and every source verified and not withdrawn. A later source withdrawal removes the content from the public projection (`toPublicContent`), which also never includes author or reviewer identity.

**Errors/permissions.** Failures return a list of plain reasons (suitable for the editor UI). Who may review or publish is enforced by Developer A's role system when integrated; this package only encodes the rule that reviewer differs from author.

**Proposed storage (not applied).** `private.place_content_revisions(location_id, locale, kind, revision, state, body, observed_value, observed_precision, evidence_kind, evidence_quality, source_ids, contains_quote, quote_consent, rights_cleared, author_id, reviewed_by, reviewed_at, supersedes)` with a unique (location_id, locale, kind, revision) and a published-immutability trigger, separate from `audit.location_geometry_revisions`. No migration is added here because `packages/db` is Developer A's and its tests pin the migration list; propose through the handoff process.

**Limitations.** Reviewer-differs-from-author is the only separation-of-duties rule encoded. Translations are separate locale rows and must each be reviewed. No real content exists; fixtures are synthetic.

## Then & Now component (#68)

`apps/web/src/ThenNowView.tsx` (profile section, fed by `comparisonPairs` from the history endpoint plus the two media records).

**Eligibility (from `viewPair`, #18).** Shown only with two known dates, at least one source and both images (https, loadable record). Otherwise the section is omitted entirely; no broken slider and no placeholder claim. While the images are being looked up it shows "Loading comparison…".

**Views.** Slider (role `slider`, focusable; arrows 5, PageUp/Down 25, Home/End; pointer drag with pointer capture; `aria-valuetext` in plain words), Side by side, and Text description. All three show dates exactly as recorded ("2021 (year)", never promoted to a day), sources, evidence quality and the viewpoint statement. "Matched viewpoint" appears only when the record has a matching note; otherwise "Not a like-for-like view."

**Failure.** If an image errors after display, images are removed and the narrative (dates, sources, quality, viewpoint, alt text) remains with "An image is unavailable."

**Tests.** `ThenNowView.test.tsx` (11 component tests incl. axe, keyboard, hidden unsupported pairs, image failure) and 3 real-Chromium tests (keyboard, mouse drag, three views, failure, 320px, hidden pair when an image endpoint is missing). Images in the browser tests are 1x1 synthetic PNGs served by route stubs: they verify behaviour only, not any historical content. A drag test found that very tall images pushed the slider out of reach, so the slider has a fixed aspect ratio and a height cap.

**Limits.** No real historical pairs exist; the mock API does not serve the pair images, so against the mock the pair is correctly hidden (the browser tests stub those endpoints). Screen-reader behaviour and touch dragging on a real device are not verified (#114, #117). Live evidence data comes with #67.

## Owned panorama viewer (#69)

`apps/web/src/Panorama.tsx`, using Pannellum 2.5.7 (MIT; ADR 005 choice), shown in the profile when a media record has `format: "equirectangular"`. Ordinary photographs go to the gallery; panoramas never appear distorted in the grid.

**Flow.** The place page first shows the approved still photograph (`staticFallbackUrl`) with date, credit and licence. "Explore in 360°" lazily imports Pannellum (separate chunk, not in the initial bundle), checks WebGL and the GPU's maximum texture size, then starts the viewer. "Close 360° view" or leaving the page destroys the viewer. Settings: mouse-wheel zoom off (does not hijack page scrolling), keyboard look/zoom on, fullscreen control, cross-origin anonymous image load.

**Failure handling (all leave the page and the still photo intact).** No WebGL; panorama wider than the GPU's maximum texture; non-https or original-storage URL; viewer script fails to load; viewer reports an image error. Each shows a one-sentence reason. If there is no safe still photograph, the page says so rather than showing a broken image.

**Claims.** Nothing implies every place has a panorama: a place without an equirectangular record shows none, and the section only appears when one exists. A panorama still needs the rights, consent and metadata approval of #61 before it can be public.

**Tests.** 14 component tests (blocker rules incl. exact texture limit, lazy start, safe viewer config, cleanup on close and unmount, WebGL/size/script/image failure, unsafe fallback, axe) and 3 real-Chromium tests that run the real Pannellum viewer on real WebGL with a synthetic 64x32 gradient image: starts on request and takes arrow keys then closes cleanly, WebGL forced off, panorama file missing. Console error check included.

**Limits.** Tested in headless Chromium (software WebGL) only: no real phone GPU, large-texture behaviour on real devices, Safari or Firefox, and no screen-reader check of the viewer (Pannellum's own accessibility is limited to keyboard controls). Touch gestures are Pannellum's defaults and unverified on a device (#82, #117). Multi-resolution tiling for very large panoramas is not implemented; large files fall back to the still photograph.

## Third-party street imagery evaluation (#70)

Evaluated 2026-11-08 from the providers' own pages, fetched that day (summaries by an automated fetch, not legal advice; quotes are as returned). Nothing was activated, no account or key was created, no imagery was fetched or scraped.

| Question | Google Street View (Static API / dynamic panoramas) | Mapillary |
|---|---|---|
| API and access | Street View Static API embeds a non-interactive panorama by URL; "All Street View Static API requests require an API key." Imagery is Google plus user-contributed, with no way to choose one source. | Client access token from the developer dashboard, or OAuth; each app is registered for a `client_id`. Entity, search and tile APIs. |
| Coverage for Makarba | **Not verified.** Coverage is place-specific and was not checked; the pages fetched do not describe a coverage check. | **Not verified.** Search is by bounding box under 0.01 degrees or 50 m radius; not run. |
| Embedding and display | Attribution rules apply: "Never remove, hide, obscure, or modify it"; logo not modified, height 16 to 19 dp; no extra attribution when shown on a Google map. | Show the Mapillary logo with a link back when serving images or API data (terms s. 11). |
| Storage and reuse | "Cache or store Google Maps Content only as expressly permitted"; bulk download of Street View images, scraping or exporting for use outside the services, and building content such as "a location index from Street View imagery" are prohibited. Panorama IDs are exempt from the caching restriction. | Other users' content is CC BY-SA "unless we indicate otherwise", some datasets CC BY-NC-SA (s. 3.2); commercial use limited to listed purposes with anti-re-identification safeguards (s. 12); unapproved scraping prohibited (s. 5.1). |
| Cost | Billed per request. Page figures at fetch time: Static Street View 10,000 free events per month then USD 7.00 per 1,000; Dynamic Street View 5,000 free events per month then USD 14.00 per 1,000. Requires a billing account. Page undated; confirm before any approval. | Not stated on the pages fetched; cost, tier and any quota beyond the rate limits (Entity 60,000/min, Search 10,000/min, tiles 50,000/day) are unverified. |
| Privacy | Imagery contains passers-by and plates blurred by the provider; the project cannot control that or the collection date. Third-party requests leak visitor IP to the provider. | Same concerns; contributor imagery varies in age and blurring. |
| Not-covered location behaviour | Must show the owned panorama or still photograph; never imply continuous coverage. | Same. |

**Decision (explicit).**
- **Owned Pannellum panoramas with still-photo fallback: ENABLED** (ADR 005; implemented in #69).
- **Google Street View: DEFERRED.** Enabling needs a Google Maps Platform billing account and key (spend; owner approval), a coverage check for Makarba, a decision on attribution layout, and confirmation that embed-only use meets the storage rules. No production use before that.
- **Mapillary: DEFERRED.** Enabling needs a registered app, a coverage check, and a licence review of CC BY-SA share-alike effects on anything derived from its imagery.
- **No continuous-coverage promise.** Public copy may describe only places for which an approved owned panorama or a verified provider embed exists.

**Guard (negative evidence).** `python scripts/check_no_street_imagery.py` fails CI if code or config references Google Maps or Mapillary imagery endpoints, or key variables for them. Run in the `conformance` job.

**What a human must do before any provider is enabled** (see `DEVELOPER_B_HUMAN_ACTION_REQUIRED.md`, H-IMG): check Makarba coverage by viewing the providers' public maps in a browser; approve spend and a monthly cap; confirm terms with the institution.

**Limitations.** Google's Service Specific Terms page returned truncated content and Mapillary's help-centre licensing page returned HTTP 403, so the table relies on the Google Street View policies page, pricing page and Mapillary terms page. Google's metadata/coverage endpoint and its pricing are not confirmed here. Terms change; re-check on the day of any approval.
