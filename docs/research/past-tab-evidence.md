# Past tab: evidence, method and limits

**Route:** `/past` (shortcut `5`). **Data:** `data/content/past.json`. **Code:** `apps/web/src/past/`. **Last reviewed:** 2026-11-22.

The Past tab answers one question: how have roads, highways, town-planning (TP) schemes and land-use change shaped the setting of Sarkhej Roza and Makarba? It shows only what a dated, sourced record supports.

## Rules the code enforces (`pastModel.ts`, tested)

- An event is shown only with a theme, a status, an integer year, an `https` source with an access date, a confidence level and a non-empty uncertainty note. Anything else is hidden and counted on the page; it is never repaired.
- Statuses are kept apart: `documented`, `proposed`, `sanctioned`, `implemented`, `observed`, `reconstruction`. A plan or approval is never labelled implemented.
- A chart is drawn only for a comparison with at least two finite values in different years, a unit, a method and a dated source. Otherwise the page states why no chart exists.
- A TP scheme boundary is drawn only when `geometry` is `"available"`, meaning a reviewed vector with a recorded coordinate system exists. None does today.
- Images need alt text, a licence and a source page. A before/after swipe is offered only for a pair with a documented matching viewpoint (see `thenNow.ts`); none exists yet.
- The People and Place section shows only entries in `data/content/community.json` that pass `communityModel.ts` (consent, privacy and small-cell rules; see `community-evidence.md`). That file ships empty, so today it contains no testimony. Present-day consented material lives on `/voices` and `/insights`.

## Layers and measurements

Historical layers and measurement series are imported through a validated pipeline: see [Past tab GIS and measurement pipeline](past-gis-pipeline.md). Two series are registered: built-up surface in the study window from the JRC GHSL (modelled, 1975 to 2020) and open water within 500 m of the Roza from Landsat (modelled, 1990 to 2024). Green cover was measured from the same Landsat scenes but is not published, because the years are not comparable (see the pipeline document). Two map layers are registered: Landsat outlines of the open water within 500 m of the Roza on 11 November 1990 and 8 November 2024 (observed, public domain). No historical road, land-use, TP or protection layer is registered, because none with a source, licence and coordinate system has been obtained.

## What the data hold

| Area | Records | Best source tier |
|---|---|---|
| Roza history (1445 to 2001) | 8 | secondary (Sahapedia, Roza committee); primary: Rijksmuseum, Commons/British Library, and the National Monuments Authority's Vadodara Circle list (protection, notified 27 May 1909) |
| Governance and population | 2 | tertiary (news, Wikipedia) |
| Infrastructure | 3 | tertiary (news, Wikipedia) |
| Planning | 1 | tertiary (news) |
| TP schemes | 8 | AMC table (primary, accessed 2026-11-08) and Town Plan Map listings (tertiary aggregator) |
| Images | 4 | public domain or CC BY-SA, from Wikimedia Commons |

Most infrastructure evidence is lower tier. It should be replaced by AMC, AUDA, NHAI or state records as they are obtained.

## TP scheme discrepancies (unresolved, shown on the page)

| Scheme | AMC table (2026-11-08) | Town Plan Map (2026-11-22) |
|---|---|---|
| 84/A | 79.76 ha, preliminary submitted, 2014 | listed as Final TPS with TPO (area not recorded) |
| 84/B | 41.80 ha, draft sanctioned, 2011 | 51.64 ha, Preliminary with Government; 49 original and 49 final plots; 31.21% deduction |
| 84/C, 86 | 68 ha refused; 127.09 ha draft sanctioned, 2012 | not checked |
| 26, 92/A, 85 | not in the AMC table as reviewed | Preliminary TPS with TPO; Draft; Preliminary with Government |
| 204 | not checked | changes approved (news report, 2024), about 1,121 ha |

Town Plan Map states that its information is aggregated from government sources for information only. No geometry, image or text was copied from it beyond these status and area facts. Do not trace scheme polygons from its map images.

## Census 2011 for Makarba and Sarkhej-Okaf (issue #241): no matching unit found

Checked on 2026-11-23: the Census of India 2011 District Census Handbook, Ahmadabad, Part XII-B (Primary Census Abstract; catalogue 405, https://censusindia.gov.in/nada/index.php/catalog/405, files 1268 to 1270, all downloadable without login).

- The handbook's PCA text (502 pages) has no town, outgrowth or village row named Makarba, Sarkhej or Sarkhej-Okaf. Sarkhej appears only in the district history.
- The Gujarat village directory workbook in the same catalogue has no Makarba or Sarkhej-Okaf row. Its only "Sarkhej" is a village in Kathlal taluka, Kheda district, which is a different place.
- Ahmadabad (M Corp.) is reported as one town (5,633,927 persons) with rows for each ward, but the wards are identified only by number (for example "WARD NO.-0019"). The handbook text gives no ward names and no ward boundaries.

So no 2011 count exists on the 2001 town boundaries, and no ward can yet be matched to the former towns. A ward-based series would need the 2011 AMC ward delimitation map, and the ward area would still differ from the 2001 town area (`sameAreaAndDefinition` would be false). No population series is registered. The 2001 figures themselves still come from Wikipedia and have not been checked against the 2001 PCA.

## Heritage protection (issue #240)

The National Monuments Authority's categorisation of Vadodara Circle monuments (https://www.nma.gov.in/WriteReadData/RTF1984/1682685450.pdf, file dated 28 April 2023, accessed 2026-11-23) lists seven Roza components as centrally protected (Category VI, living monuments, items 51 to 57), each notified on 27 May 1909. It gives no notification number and no protected or regulated area boundaries, so the `heritage-protection` layer stays empty. The same list's Category I entry for the 'Historic City of Ahmadabad' (ref. 1551) does not include the Roza; whether the Roza lies in that property's buffer zone is still unresolved (the UNESCO documents page returned HTTP 403 on 2026-11-23). The Wikipedia N-GJ-48 to N-GJ-54 numbering was not found in this list and is not used.

## Not done, and what is needed

See the "What is still missing" list in `past.json` (`gaps`). In short: sanctioned TP maps with a recorded CRS, dated land-use or built-up maps for the same area, opening years and alignments of highway, flyover and BRTS works, Census 2011 counts on matching boundaries, dated tank-extent and encroachment records, ASI and UNESCO boundary confirmation, and consented resident recollections.

## Adding evidence

1. Add the record to `data/content/past.json` (events, tpSchemes, comparisons, visualRecord or gaps). The shape is in `apps/web/src/past/pastModel.ts`.
2. Run `pnpm --filter @makarba/web test` (the `past` tests check the whole file: every event valid, no plan marked implemented, no unsourced listing, no copied geometry).
3. Charts appear automatically once a comparison has two dated points; remove its entry from `gaps` when the evidence arrives.
4. Record source, date, licence, coverage, method, confidence and limits for any new dataset. Do not merge sources that disagree: add them as `alsoListed` entries so the difference stays visible.
