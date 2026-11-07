# Public UX and wireframes

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Implement screens P01–P13 in the inventory. Main navigation: Explore, Then & Now, Community Voices, Urban Insights, Research. Search/layers use URL state with privacy-safe filters; no raw interview parameter. Place selection announces name and moves focus only on explicit details action; closing returns focus to marker/list item.

```text
DESKTOP ≥1200
+-----------------------------------------------------------+
| MAKARBA 360 | Explore | Then & Now | Insights | Research    |
+-------------+---------------------------+-----------------+
| Search      |                           | Name / category |
| Layers      |       INTERACTIVE MAP     | Photos / dates  |
| Categories  |       selected feature    | Evidence tabs   |
| List toggle |                           | Safe findings   |
+-------------+--attribution / zoom-------+-----------------+
MOBILE
+---------------------------+
| Search        Layers      |
|           MAP       + / - |
|                           |
| attribution               |
| [Place name   Expand]     |
| [sheet content / collapse]|
+---------------------------+
```

Home uses a permitted image and clear research purpose. Then & Now offers slider plus side-by-side and text descriptions; date/source/evidence quality visible beside each image. Panorama opens on demand with static fallback and source date. Voices labels quotation, recollection, analyst theme and verified evidence separately. Insights shows valid n, excluded/missing/unsure, period and sample caveat next to chart, not only in footer. Guided story has ordered stops and accessible list; no invented route. Sources/credits and accessibility/language settings always reachable. Empty research findings explain collection status; demo fixtures are unmistakably synthetic and not mixed with production.
