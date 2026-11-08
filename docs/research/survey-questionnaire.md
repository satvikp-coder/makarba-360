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

## Implementation status: visits, interview start and draft answers (issues #44, #45; part of #47)
Engineering only; the instrument wording is still the draft above and nothing here is approved for collection. Migration `0012_visits_interviews.sql` and `apps/api/src/field-*.ts`:

- **Visit** (`POST /visits`, `visit.start`): a trained researcher assigned to the study starts an `active` visit; ending it moves it to `ended`; every status change is appended to `audit.field_visit_status_history`; ended visits are frozen; visits are never deleted. **Ending with open drafts** returns 409 `pending_drafts` with the draft ids; the caller must say `keep` (stays a draft, to be synced later) or `abandon` (status `abandoned`, kept, excluded from analysis) for every one. The final UPDATE re-checks, so a draft created meanwhile also blocks the end.
- **Interview start** (`POST /visits/:id/interviews`, `interview.create`): the client generates the interview UUID once; the server creates the interview only if the visit is active and belongs to the caller, the questionnaire version is published (not draft or retired) and **participation consent was already granted for that UUID by the same researcher in the same study** (database trigger). Repeating the request with identical details returns the existing interview (200, even after the visit ended); the same UUID with different details is 409. A future start time is rejected. The interview pins `survey_version_id`.
- **Draft answers** (`PUT /interviews/:id/answers`, `interview.edit_draft`): each answer is validated against its question in the pinned version (`@makarba/survey`); unknown questions are rejected; the database re-checks the question exists in the pinned version and that the interview is still a draft. Answers to questions that a later change hides are kept but reported as `staleHiddenAnswers` (they are not "not asked"; submission, issue #52, decides what is dropped).
- **Refused or withdrawn participation discards content**: a database trigger deletes every answer of the interview and marks it `withdrawn` (final; the row stays as a bare marker, no content). The API role has no DELETE privilege; only that definer function can remove answers.

Not done here: participant categories and official-claim verification (#46), consent script/scope metadata beyond #37 (#47), GPS and subject places (#48-#50), review and durable save (#52), submission history (#53), offline sync (#55-#60), and the field app screens. No real participant data exists or may be entered before ethics approval (#11).

## Implementation status: submit and review (issue #52 server side; groundwork for #53, #99)
Migration `0014_submit_and_review.sql`, `POST /interviews/:id/submit`, `GET /submissions`.

- **Submit** (`interview.edit_draft`, collector only): the answers that the pinned questionnaire shows are validated (`validateAnswers`); missing required answers are a 422 listing the questions. The database function `private.submit_interview` is the only way a draft becomes `submitted`: it checks participation consent is in force, that **an interview-position state exists** (a fix, a manual pin, or an explicit denied/unavailable reason), removes answers to questions the final answers hide (so nothing "not asked" is kept as if answered), stamps `submitted_at` and is idempotent (a retry returns 200 `already_submitted`). The response is the review summary: consent flags, interview position state and revision count, number of subject places, answer count and dropped hidden answers.
- **Save honesty:** the server reports `saved on the server` only after the transaction commits; a client that did not receive that response must treat the interview as unsaved and retry (safe, because submit is idempotent). The on-device half of "app close during save" belongs to the offline store (#55) and is not claimed here.
- **After submit** the interview is frozen (answers, positions, subject places); the status cannot be forced by plain SQL; later changes go through corrections (#53, not built). A later withdrawal still discards all content.
- **Review decisions** are append-only rows (`approved`, `changes_requested`, `rejected`) by someone other than the collector, only for submitted interviews; approved and rejected are final. There is **no HTTP route** to decide yet: the capability matrix (#6) has no moderation action, and none was invented. `GET /submissions?studyAreaId=` lists the caller's own interviews in the study with their review status.

Not done: corrections and resubmission (#53), the moderation queue and screens (#99), the on-device durable draft store (#55) and the field app screens.
