# GPS field protocol

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

1. Explain consent before location capture. Capture only while at the actual interview spot, not at end of day.
2. HTTPS mobile browser permission prompt; explain deny/error/timeout. Request fresh high-accuracy fix, retain acquisition timestamp, reported metres, permission and device method; test actual timeout/maxAge in pilot.
3. Show pin, age and accuracy: ≤20m good estimate; >20–50m check; >50m low quality/recapture. Thresholds are project choices, not guaranteed truth.
4. Check surroundings safely; recapture outdoors if possible. Do not move participant into traffic for GPS.
5. If unavailable/denied, record cause and null coordinate or explicitly estimated manual point if approved. Never use subject centroid as interview point or invent accuracy.
6. Manual adjustment preserves original fix, effective point, reason, actor/time and provenance. Reviewer sees both. Flag outside current verified boundary using inclusive intersection/coverage and uncertainty context.
7. Select discussed place separately; multiple places use per-topic observations. Review interview time, capture time and subject association.
8. Save locally and verify durable confirmation. Sync timestamp is separate from capture/interview time. Review poor/old/out-of-area fixes; do not silently auto-correct. Exact points remain private; any public coverage uses approved coarse aggregation.

## Implementation status: interview position, subject places, official claims (issues #46, #48, #49, #50)
Engineering only (migration `0013_positions_subjects_claims.sql`, `packages/survey/src/position.ts`, `apps/api/src/field-*.ts`); no real fix, place or claim exists, and thresholds remain project choices pending the pilot (#121).

- **Interview position** (`POST /interviews/:id/position`, capability `gps.capture`, owner only): states `device_fix` (needs permission granted, reported accuracy in metres, device capture time not in the future and not older than 24 h), `manual_pin` (needs a reason; **no accuracy and no capture time may be supplied**), `denied` and `unavailable` (no coordinates; reason required). Each save is the next **revision**; rows are append-only (even the table owner cannot update or delete). The device reading is preserved as `raw` and a manual correction keeps it, so a reviewer sees both raw and effective points. Quality bands follow the protocol (<=20 m good, 20-50 m check, >50 m low); a low-quality fix is saved and flagged so the researcher is prompted to recapture, never blocked or silently corrected. Positions change only while the interview is a draft and only by the collecting researcher.
- **Subject place** (`PUT /interviews/:id/subjects/:group`, `subject_location.link`): one per topic group, either an existing place or a candidate geometry of its own (WGS 84, valid, point/route/area). It lives in a different table from the interview position and is **never derived from it**: a candidate exactly equal to the current interview position is refused unless the researcher explicitly confirms "same spot".
- **Privacy:** exact positions are readable only by the owner and the assigned lead (`GET /interviews/:id/positions`, `interview.view_private`); no public route, view or projection reads them. Withdrawing or refusing participation deletes positions, subject places, claims and answers.
- **Official claims** (`POST /interviews/:id/official-claim`): always recorded `pending` (a client-supplied status is ignored; the database refuses any non-pending insert). Only a different person than the collector can decide a claim, on the verification path (not the collecting API role); decided claims are final; `private.attributable_official_claims` lists verified claims only. **There is no verification route yet:** the capability matrix (#6) has no action for it, and it is not invented here.

Not done: the out-of-boundary flag against a verified study boundary (#23/#5), reviewer screens (#99/#100), the mobile permission UI and recapture UI (#48/#49 front end, Developer B), and real-phone GPS behaviour (needs #121).
