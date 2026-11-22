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

Historical layers and measurement series are imported through a validated pipeline: see [Past tab GIS and measurement pipeline](past-gis-pipeline.md). One series is registered today: built-up surface in the study window from the JRC GHSL (modelled, 1975 to 2020). No historical map layer is registered, because none with a source, licence and coordinate system has been obtained.

## What the data hold

| Area | Records | Best source tier |
|---|---|---|
| Roza history (1445 to 2001) | 7 | secondary (Sahapedia, Roza committee), one primary (Rijksmuseum, Commons/British Library) |
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

## Not done, and what is needed

See the "What is still missing" list in `past.json` (`gaps`). In short: sanctioned TP maps with a recorded CRS, dated land-use or built-up maps for the same area, opening years and alignments of highway, flyover and BRTS works, Census 2011 counts on matching boundaries, dated tank-extent and encroachment records, ASI and UNESCO boundary confirmation, and consented resident recollections.

## Adding evidence

1. Add the record to `data/content/past.json` (events, tpSchemes, comparisons, visualRecord or gaps). The shape is in `apps/web/src/past/pastModel.ts`.
2. Run `pnpm --filter @makarba/web test` (the `past` tests check the whole file: every event valid, no plan marked implemented, no unsourced listing, no copied geometry).
3. Charts appear automatically once a comparison has two dated points; remove its entry from `gaps` when the evidence arrives.
4. Record source, date, licence, coverage, method, confidence and limits for any new dataset. Do not merge sources that disagree: add them as `alsoListed` entries so the difference stays visible.
