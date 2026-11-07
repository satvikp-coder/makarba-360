# Shared integration contracts and handoffs

Version **1.0.0 planning contract**, pending review under #9 and executable TypeScript/mock implementation under #10. These contracts refine the existing architecture; they do not create an extra service deployment or public survey entry. All examples in [contracts/fixture-bundle.json](contracts/fixture-bundle.json) are explicitly synthetic, outside Makarba, and not real findings. Production must not publish synthetic fixtures as collected evidence.

## Ownership and delivery

| Contract | Accountable producer | Consumer | Required handoff / tests |
|---|---|---|---|
| C01 Location API | A #27/#81, schema #9/#10 | B #25/#29/#73–#77 | Stable public feature IDs, bounded pagination/search, hidden unpublished records, forbidden-field and 404 tests |
| C02 Map/GeoJSON | A #23/#27; B #28 supplies reviewed public road data | B map rendering | Longitude-first EPSG:4326, point/line/polygon fixtures, bbox/type/CRS validation; actual boundary/source QA #120 |
| C03 Public insights | A #84 eligibility/distinct-count cubes, #90 private coverage, #92 disclosure | B #85–#89/#91/#93 | Safe immutable aggregate DTOs only; no raw interview/GPS grants; numerator/base, missingness, overlap and suppression/differencing tests |
| C04 History/content | B #63/#65/#66/#67/#71 | A #103 publication; B comparison/profile views | Source/date precision/rights, location linkage, matched viewpoint and account-vs-fact semantics; missing-date/rights block real publication |
| C05 Public media | A #60 quarantine/derivatives; B #61 metadata/rights | B gallery/panorama, A publisher | Public derivative allowlist, stripped EXIF, credit/date/alt text, supported format/sizes and missing asset fallback; no original/private URL |
| C06 Private field interfaces | A #42–#60/#97 | A field app; B design/feasibility tests with synthetic roles only | Separate interview-position/subject IDs, consent scopes, immutable form version, idempotency/revision/errors; no public route |

H0 (#9, A→B): freeze versioned request/response schemas, module boundaries, privacy allowlists, fixture manifest/hash and change rules. H1 (#10, A→B): clean Windows checkout runs shared validators/types and a public mock API with success, empty, suppressed, missing and transient-error states. No real DB/identity/provider account is needed for B public development. B acknowledges fixture/schema conformance in their first consumer PR; acceptance is an actual check, not merely reading this document.

## C01 Location API

`GET /api/v1/public/locations?bbox=10,10,11,11&category=heritage&q=synthetic&limit=50&cursor=...` returns a GeoJSON FeatureCollection with `features`, `page` and `meta`. Bbox is minLon,minLat,maxLon,maxLat, finite and ordered; limit defaults 50/max 200; cursor is opaque, tied to filters and immutable snapshot. Never encode private interview/researcher IDs in cursors. q is bounded, normalized alias search across reviewed language fields. Requesting too large/invalid bounds or unsupported filters returns 422 with safe field errors. Unknown/unpublished detail is 404, never a draft preview.

Feature.id is the stable public UUID; properties repeat locationId for contracts, with slug, localized name, category, publicationState=`published`, lastReviewedDate and approved source/media references. Public geometry is a verified place, never the interview position. Detail `GET /public/locations/:slug` includes the same feature plus approved content/history/media/insight references; fields are allowlisted. `meta` includes contractVersion, datasetKind (`synthetic` for development / `approved` for real public data), snapshotId and methodology URL. No raw DTO is spread into this shape.

## C02 Map data

Use C01 bbox response as the canonical map feature source; do not build a second incompatible location identifier system. EPSG:4326, 2D longitude/latitude. Point, MultiLineString and MultiPolygon only for this baseline. Feature.id must equal properties.locationId. Layer IDs: `study-boundary`, `places-heritage`, `places-water`, `places-community`, `roads`, `historic-evidence`, `survey-coverage`. Only public verified layers render. Coverage consists of disclosure-approved coarse cells with suppression metadata, not jittered points or raw centroids.

Validate range/finite numbers, allowed type, nonempty arrays, polygon ring closure, source CRS and geometry validity with PostGIS at provider/import boundaries. B uses a named synthetic fixture extent; it is not an official Makarba boundary. Actual ST_IsValid/ST_Covers/index/grant tests remain #108/#120; the lightweight public-contract checker is not a replacement for PostGIS validation.

## C03 Public insights and read-only reporting

`GET /api/v1/public/insights?snapshot=<public-id>&cohort=<allowlisted-code>` returns immutable approved `cohorts`, collectionPeriod, question/version, policyVersion, sampleNote and metadata. Each nonsuppressed cohort supplies distinct interview n, validAnswerN, missingN, unsureN, respondent category counts, rating/issue counts and denominator/counting-rule labels. Multi-place counts may overlap; never sum them into a fictitious unique population. Missing/unsure is not zero and not silently folded into numeric bases.

Suppressed cohort has n/denominators/counts null or absent, `suppressed:true`, reasonCode and empty detail arrays. Never ship a precise hidden count and merely hide it in CSS. A #92 decides minimum cohort/cell threshold, complementary suppression and allowed filter intersections; provisional k5 is not an anonymity guarantee. No arbitrary dates/bboxes/SQL for public reporting. A returns only approved fixed cohorts and broad periods; unsupported cohort is 422 and unknown snapshot is 404. Invalidated/withdrawn snapshots must stop serving before recomputation. Do not cache restricted/private payloads.

B #85/#86/#87/#89/#91 owns the **same-monolith read-only reporting module**, not a raw-data aggregation microservice. It formats A-approved count cubes and codebook/method metadata using public-only grants. A computes distinct eligible bases and applies disclosure before B receives them. Any private free-text coding executes in A restricted boundary; B defines the codebook using synthetic examples. B charts preserve the same counts, suppression and caveats. #93 verifies frozen independent expected tables against both implementations, #110 tests disclosure leaks, #113 connects actual public journeys.

## C04 Historical content

`GET /api/v1/public/locations/:slug/history` returns approved public source IDs/citations/licences, events, comparisonPairs and accounts. Each date carries `{value,precision}` (day/year/range/unknown as appropriate), not an invented exact day. Comparison references source IDs and two public media IDs, locationId, matching-viewpoint notes and evidenceQuality. A verified comparison needs date/source/rights evidence and matching feature; circa-2021 is only used if available. Community memory is typed `account`, not a proven event. Official attribution needs independent verified role and scope, not stakeholder dropdown.

Mock behavior includes full dated synthetic pair, approximate date, no pair, disputed account and an unpublished-source 404. B writes domain migrations in isolated content files; A reviews base foreign keys/grants and migration ordering. #123 is live evidence/media integration, not just UI screenshot approval.

## C05 Media

`GET /api/v1/public/media/:id` returns an approved derivative descriptor: id, locationId, URL, contentType (image/jpeg/png/webp for images), width/height/variants, alt, credit, licence, capture date/precision, format, publicationState and optional panorama/static fallback references. Owned panoramas use equirectangular or reviewed multiresolution manifest, lazy load and keyboard/static alternative. Prefer <=4096px default viewer assets; larger supported variants require device evidence. No continuous Street View promise; optional provider activation requires availability/terms/budget approval.

Original upload URLs, storage keys, interview linkage, EXIF GPS and private review tokens are forbidden. URLs are HTTPS approved public-asset hosts, not arbitrary third-party strings. Missing/withdrawn media returns safe 404; optional descriptor in a place can be null with `unavailable` status and a text/static fallback. Decoder/scan failure leaves no public descriptor. Mid-upload error never destroys the interview. #60/#61/#123 verify metadata stripping, rights, consent and withdrawn derivative invalidation.

## Errors, mocks, compatibility and changes

Error body: `{code,message,fieldErrors,requestId,retryable}`. 404 means unavailable/unpublished; 422 invalid filter/version shape; 429/503 retry with bounded backoff and Retry-After where supplied. 401/403 protect private routes and are not automatically retried as a public-data workaround. Private writes additionally use 409 revision/idempotency conflicts, 413 size limits and 422 instrument retirement. No raw values, stack traces or session details in errors.

`python scripts/check_public_contracts.py --fixtures` validates the supplied positive fixtures and rejection cases without a server. `--base-url https://<approved-staging-origin>` runs read-only GET smoke/conformance checks against a future mock/live provider; it is not claimed to have run in this planning session. #10 must wire the same contract fixtures into TypeScript runtime/OpenAPI validation, mock scenario selection and provider/consumer CI. #107 tests actual public/private APIs; #93 checks metric truth, #110 privacy, and #113 browsers. A fixture-shape pass is not evidence of production correctness or legal compliance.

Compatibility: pin contract version and fixture digest in PR/handoff receipt. Additive optional fields require both provider/consumer checks; new sensitive fields always require privacy review. Breaking field/type/counting/geometry/status changes require new major contract and a dual-read migration period. Owner opens a contract PR first, identifies consumers, updates examples and negative tests, obtains peer review, then provider and consumer integrate in small PRs. While the reviewer is unavailable, do independent work; do not silently redefine the contract. No mandatory CODEOWNERS gate was created for the unaccepted collaborator.
