# File and module ownership

These are future module paths in the existing architecture, not new empty application scaffolds. The allocation JSON identifies exactly one primary issue owner. GitHub roles and research-data permissions are separate.

| Path / concern | Primary | Coordination rule |
|---|---|---|
| apps/api/src/platform/, auth/, fieldwork/, sync/, privacy/, publication/ | A | B consumes versioned interfaces; no raw DB credentials for public work |
| apps/field/ | A | B supplies reviewed UX and synthetic feasibility/device evidence (#20/#54/#62); A reviews privacy/key policy |
| apps/api/src/public-reporting/ | B | Reads approved aggregate/public DTOs only; A owns eligibility, private distinct counts, coverage and suppression |
| apps/api/src/content/, apps/admin/src/content-review/ | B | Place/history/media/candidate tools; use A auth service, scoped test roles and synthetic records |
| apps/admin/src/shell/ | B (#94) | A owns privileged account, visit, survey, GPS and withdrawal handlers; avoid a single shared giant dashboard file |
| apps/api/src/public/ | A (#81) | Thin public facade, allowlisted schemas and separate read-only pool; B reporting modules plug in through contracts |
| apps/web/ | B | Public map, profiles, galleries, timelines, panoramas, charts and localization |
| packages/ui/ | B | Accessible reusable primitives; field-specific workflow logic stays in A field app |
| packages/shared/contracts/ | A | Contract version changes require consumer review; B proposes history/reporting domain additions in isolated files |
| packages/shared/reporting/, content/ | B | Pure domain DTO/view transformations, no private-data queries |
| packages/gis/services/ | A | CRS, spatial queries, validation boundaries and indexes |
| packages/gis/public-map/, exchange/ | B | Rendering adapters, non-sensitive GeoJSON validation and import/export tooling; A reviews DB/auth integration |
| database/migrations/platform/ and fieldwork/ | A | Own base schema, grants and ordering registry |
| database/migrations/content/ and public-search/ | B | Append isolated migration files; coordinate sequence/foreign keys with A; never edit applied migrations |
| infrastructure/backend/, database/, storage/, identity/ | A | A controls restricted-resource policy and secrets; no credentials in Git |
| infrastructure/deployment/, public-hosting/ | B (#124) | B prepares deployment automation/runbooks and synthetic staging; A reviews grants, secrets and production migration safety |
| tests/contracts/ and API/field/privacy tests | A interfaces, B harness #106 | A owns provider assertions; B owns consumer contracts/browser/a11y/visual/device harnesses and independent spatial checks |
| Root workspace, lockfile, CI, release config, integration tests and cross-cutting docs | Issue owner; cross-review | Name one editor per PR, announce affected files in PR, keep changes small; no silent interface change |

No CODEOWNERS file or mandatory review gate was installed: Varun's invitation is unaccepted and an unfulfillable approval rule would obstruct the team. Add supported review ownership only after membership and repository policy are verified. Actual main protection was disabled at audit; the documented PR process is a team policy, not a claim of enforced protection.

Avoid collisions: B public UI works with fixture contracts while A edits services; split shared DTOs by domain; do not update the same migration registry or root dependency files in parallel. The issue owner requests the shared-file edit, the other developer reviews its compatibility, then both update from main. Never resolve conflicts by replacing the other person's file wholesale.
