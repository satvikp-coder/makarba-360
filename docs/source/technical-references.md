# Dated technical research

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Checked 2026-11-07 using official documentation. These references support proposed capabilities; package maintenance, exact prices and institutional legal applicability must be rechecked at implementation.

| Source | Planning consequence |
|---|---|
| [MDN Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) | Permission and secure-context handling required; no accuracy guarantee |
| [MDN storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) | Browser eviction/quota failures require explicit recovery limits |
| [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/) | No bulk/offline standard tile download |
| [OSM copyright](https://www.openstreetmap.org/copyright) | Attribution/ODbL review; data licence differs from tile service |
| [MapLibre](https://maplibre.org/maplibre-gl-js/docs/) | Map renderer; provider/data remain separate choices |
| [PostGIS ST_IsValid](https://postgis.net/docs/ST_IsValid.html) | Validate 2D geometry and handle null explicitly |
| [Express security](https://expressjs.com/en/advanced/best-practice-security/) | HTTPS, validation and hardened deployment remain application work |
| [Pannellum](https://pannellum.org/documentation/overview/) | Self-hosted panorama viewer; media rights remain project responsibility |
| [Street View billing](https://developers.google.com/maps/documentation/streetview/usage-and-billing) | Optional billed integration; quote and permission needed |
| [ODK Collect](https://docs.getodk.org/collect-intro/) | Android offline-capable collection fallback |
| [ODK encrypted forms](https://docs.getodk.org/encrypted-forms/) | Finalized submissions can encrypt; in-progress drafts still need device protection |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | AA target plus manual testing |
| [MeitY framework](https://www.meity.gov.in/data-protection-framework) | Institutional legal review must verify current law/commencement; page had no extractable body |
| [Mapillary developer docs](https://www.mapillary.com/developer/api-documentation/) | Login restricted; terms/cost/coverage unresolved, integration optional |

Blueprint also references KoboToolbox GPS and mapping documentation; fallback selection issue must validate those current capabilities and institutional approval before choosing it. No paid integration activated.
