# Versioned survey instrument v1 draft

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Status: draft for institutional and bilingual pilot review; not approved for collection. Version every published wording/branch/option change, pin interview to version/hash, preserve original answers and separately map comparable concepts. Basic duration target 5–8 minutes.

| Code | Prompt / field | Type/options and branch |
|---|---|---|
| META | Interview UUID, collector, visit, time/offset, instrument | Automatic, editable time correction audited |
| C01 | Project explained and voluntary consent? | Yes/no required; no stops capture, no answers/GPS retained |
| C02 | Permission for anonymous aggregate research use? | Explicit approved scope; refusal follows approved termination policy |
| R01 | Stakeholder role | Resident/shopkeeper/worker/student/commuter/visitor/official/other; unsure/refused |
| R02 | Association with area | <1y / 1–5y / >5y / unsure / refused |
| R03 | Official role claim? | Only if official; claim recorded privately, verification pending lead |
| G01 | Interview position | Device fix/accuracy/time/permission or explicit manual/unavailable reason |
| S01 | Which place is discussed? | Existing point/line/polygon or private candidate; one topic group per place |
| S02 | Same spot or another location? | Researcher confirmation; never derives one coordinate from the other |
| S03 | Most recent visit | Today/this week/this month/longer/unsure/refused |
| S04 | Visit frequency | Daily/weekly/monthly/less often/first visit/unsure/refused |
| Q01 | What is good about this place? | Multi-select heritage/environment/activity/access/social/other/none + optional own words |
| Q02 | Current condition | Integer 1 very poor → 5 very good / unsure / refused |
| Q03 | Biggest issue | Traffic/walking/sanitation/water/safety/maintenance/public space/none/other/unsure/refused |
| Q04 | Perceived change over five years | Better/worse/same/do not know/not enough association/refused; optional example |
| Q05 | First desired improvement | Optional text; preserve words; later analyst coding is separate |
| Q06 | Additional comments | Optional text; not automatically published |
| Q07 | Optional quotation | Text plus distinct quotation and attribution consent; translation review |
| C03 | Photo/audio/video recording and publication | Separate opt-in scopes per medium and identifiable use; no preselected permission |
| END | Review and save | Consent, interview spot, subject topics, missingness and save/sync status |

Q01–Q07 repeat only for explicitly discussed topic groups, not automatically for every linked place. Missing reasons: not_asked (branch), skipped, refused, unsure, not_applicable; unsure is not numeric 0. Required fields can support explicit refusal when ethically necessary; consent is never bypassed. Long interviews use a separate optional protocol and recording scope, not unbounded mandatory text fields.
