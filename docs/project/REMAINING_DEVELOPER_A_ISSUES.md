# Remaining Developer A issues (checkpoint)

GitHub is authoritative; regenerate with `python docs/project/make_remaining_a.py` (read-only). Main at generation: `5cb5064`. Open Developer A issues: 10. This file changes no assignee, label or state; reassignment is the owner's decision.

Result categories: engineering preparation merged = code + tests on main; **not** an acceptance claim. An issue is closed only when its own acceptance criteria and hard prerequisites are met.

| Issue | Title | Assignee | Open hard prerequisites | Claude completed | PRs | Remaining | Tests | Approvals needed |
|---|---|---|---|---|---|---|---|---|
| #4 | [DEVOPS] Validate research questions and methodology | varunkarthic | none | Methodology drafts in docs/research. | - | The research lead must confirm questions and methodology (blocks #42, #11). | - | Research lead / supervisor |
| #6 | [DEVOPS] Approve stakeholder capability matrix | varunkarthic | none | Capability matrix PROPOSED and enforced in code (production start-up refuses an unapproved matrix). | #153 and earlier | Stakeholders approve the matrix; then update docs/project/contracts/capability-matrix.json by PR. | pnpm --filter @makarba/authz test | Stakeholders who own the matrix |
| #7 | [DEVOPS] Baseline functional requirements catalogue | varunkarthic | #6 | - | - | Baseline functional requirements need #6. | - | Project owner |
| #8 | [DEVOPS] Baseline non-functional requirements | varunkarthic | #7 | - | - | Non-functional baseline needs #7. | - | Project owner |
| #11 | [DEVOPS] Obtain institutional ethics and legal verification | varunkarthic | #4, #6 | Consent and protocol drafts only. | - | Institutional ethics/legal approval is an institutional act; nothing may be collected before it. | - | Ethics committee / institution |
| #23 | [GIS] Store and validate versioned study boundary | varunkarthic | none | Versioned study_areas table exists (migration 0001). | earlier | Boundary validation/versioning workflow and the verified boundary itself (needs #5 verified geography, a human task). | pnpm --filter @makarba/db test (CI) | Geography verifier / research lead |
| #32 | [PRIVACY] Integrate identity provider and secure sessions | varunkarthic | none | Sessions, OIDC login, MFA-by-role, wired to PostgreSQL with a fake IdP. | #147, #215 | Real identity provider; closure rule: cannot close before #6. | pnpm --filter @makarba/api test (CI database job) | Institution (IdP); stakeholders (#6) |
| #121 | [DEVOPS] Run real GPS and offline pilot | varunkarthic | #119 | No engineering done in this pass. | - | Not started; see the issue's acceptance criteria and open prerequisites. | see issue | see issue |
| #122 | [DEVOPS] Audit survey consent and data quality | varunkarthic | #121 | No engineering done in this pass. | - | Not started; see the issue's acceptance criteria and open prerequisites. | see issue | see issue |
| #125 | [DEVOPS] Validate final research dataset and snapshots | varunkarthic | #122, #123 | No engineering done in this pass. | - | Not started; see the issue's acceptance criteria and open prerequisites. | see issue | see issue |
