# Fieldwork UX and wireframes

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Implement F01–F14; structured site observations are separate from participant interviews. One-handed large controls, short steps, readable outdoors, persistent saved/sync status. Standard interview target 5–8 minutes, measured in pilot rather than asserted. No consent defaults or leading answer defaults. English/Gujarati scripts are reviewed by fluent humans; language can switch without losing answers.

```text
[Visit name] [Offline: 2 saved] [Lock]
Step 1 Consent → 2 Participant → 3 Interview GPS
→ 4 Subject place → 5 Questions → 6 Media → 7 Review

INTERVIEW GPS                 SUBJECT PLACE
[Capture] [Recapture]         [Search verified places]
Estimate: 35m / Check         Discussing: <selected place>
Captured: <time>              [Add topic for another place]
[Private map preview]         Not automatically this GPS spot
[Manual pin + reason]

Review: consent scopes | private interview spot | subject topics
[Save draft locally] [Submit when online]
Saved at <time> / Not synced / receipt after upload
```

Consent refusal ends without GPS/answers. Manual pin has explicit estimated label and reason, retains original fix; GPS denied is not a blocked whole form when approved unavailable fallback exists. Separate topics ask which answers apply where; do not duplicate responses to every linked place. Candidate places remain private pending review. Draft recovery prompts unlock and shows last durable save. Partial media upload never destroys interview; sync status differentiates record receipt from attachment completion. Correction UI compares old/new values, requires reason and creates a revision, not a hidden overwrite.
