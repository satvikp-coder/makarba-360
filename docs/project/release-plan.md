# Release strategy and gates

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

| Release | Included scope | Exit evidence |
|---|---|---|
| A — Technical foundation | M00 baseline, M01 essential frames, M02 core spatial foundation, M03 identity/grants/secrets, M10 initial harness | Clean Windows local startup using synthetic data; migration/grant/geometry tests; map renders; secure role boundaries; ADRs reviewed |
| B — Working private field MVP | M04, M05, essential M09 moderation/corrections, privacy/negative/GPS/offline/device tests | Authorised researcher signs in, starts visit/interview, gets consent, captures independent GPS, chooses subjects, records/reviews/saves, syncs once and submits privately; offline selection validated; ethics/legal gate before real data |
| C — Public demonstration | M06–M09 approved content/analytics, M10 quality, M11 pilot/launch/handover | Verified map/places, licensed photos, available panoramas, dated comparisons, legitimate safe aggregates and methodology; actual release/privacy/restore/device/accessibility evidence |
| Advanced | M12 | Core gates retained; separate feasibility/rights/privacy approvals |

Release A can use synthetic non-Makarba geometries; actual study boundary is a field-data publication gate. Release B can be demonstrated synthetically before institutional approval, never real participant collection. If PWA feasibility fails, approved ODK/Kobo collection/import must preserve all critical metadata, separate subject mapping and consent before B acceptance. No alternate tool silently relaxes privacy.

C evidence gaps are explicit: no invented 2021 photos, results or coordinates; target counts are estimates. A public demo without real approved evidence must be clearly a technical preview, and cannot claim completed research release. Production launch requires source/licence, disclosure, consent and backup gates. Source-repository visibility was changed to public by explicit owner request after planning QA; this is independent of production launch and research-data access.
