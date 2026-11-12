# Open GitHub issues: status (2026-11-12, main `a6d2346`)

Verified: `pnpm typecheck` and `pnpm test` pass on main (API: 87 passed, 69 DB-dependent skipped without Postgres). **No open issue was closed**: each remaining one needs a human or institutional act that engineering cannot supply or invent (see AGENTS.md rules 7-8).

| Issue | Blocked by | What is needed (not engineering) | Engineering state |
|---|---|---|---|
| #4 Validate research questions/methodology | none | Research lead/supervisor confirms | Drafts in docs/research |
| #6 Approve capability matrix | none | Stakeholders approve; then update `docs/project/contracts/capability-matrix.json` by PR | Matrix enforced in code; production start-up refuses an unapproved matrix |
| #7 Functional requirements baseline | #6 | Project owner | waits on #6 |
| #8 Non-functional requirements baseline | #7 | Project owner | waits on #7 |
| #11 Ethics and legal verification | #4, #6 | Ethics committee/institution; nothing may be collected before | Consent/protocol drafts |
| #23 Versioned study boundary | none | Verified geography (#5, human) | `study_areas` table (migration 0001) exists |
| #32 Identity provider and sessions | none (closure needs #6) | Institution supplies real IdP | OIDC, sessions, MFA-by-role verified against a fake IdP |

Unblock order: #4 and #6 (parallel) -> #7 -> #8, #11 -> #32/#23 real-world inputs.
See also [REMAINING_DEVELOPER_A_ISSUES.md](REMAINING_DEVELOPER_A_ISSUES.md) and [HUMAN_ACTION_REQUIRED.md](HUMAN_ACTION_REQUIRED.md). Run it locally: [how-to-use](../operations/how-to-use.md).
