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
