# Repository governance

Issue: #1. This document is the single reference for branch/PR rules, ownership vacancies and the planning-only boundary. It invents no people, contacts, approvals or licences.

## Branch and PR rules

- `main` is the integration branch. Never commit directly to it; never force-push it or any shared branch.
- Branch names: `dev-a/issue-<n>-<slug>` for Developer A (`satvikp-coder`) work; Developer B uses `dev-b/issue-<n>-<slug>`. A contributor works only on issues they own (`owner:developer-a` / `owner:developer-b` label plus assignment).
- One focused issue per PR, opened against `main`, using `.github/PULL_REQUEST_TEMPLATE.md`. Use `Closes #<n>` only when the PR fully resolves the issue.
- Commit messages describe the outcome and reference the issue, e.g. `docs(governance): record branch and PR rules (#1)`.
- Required CI (`Planning integrity`) must pass before merge. Do not disable or bypass checks.
- **Branch protection is not enabled** (GitHub returns 404 for `main` protection as of this PR). A maintainer must configure it deliberately once CI exists; until then these rules are enforced by convention, not by GitHub.

## Ownership vacancies

All owners are role requirements, not fictitious people. The following are **vacant / unconfirmed** and must not be filled by assumption:

| Role / item | Status |
|---|---|
| Institutional research approver and contact | Vacant — unconfirmed |
| Security / vulnerability-report contact address | Not supplied (see `SECURITY.md`) |
| Team email or mailing list | None exists |
| Maintainer(s) with merge authority beyond the repository owner | Not appointed |
| Developer B GitHub assignment | Pending invitation acceptance; work reserved by `owner:developer-b` labels |
| Source-code licence | **None selected.** Owner decision required before public redistribution; no licence file is added |

## Planning-only boundary

Until application issues are merged, this repository contains planning, design, research-protocol and process material only. Planning documents are not tested software. Implementation issues build only their stated capability. No real participant data, credentials, exact interview coordinates or institutional approval documents are ever committed; fixtures must be explicitly synthetic and outside the real study area.

## Verification

`python scripts/check_governance.py` fails if governance/policy docs add a licence declaration or a contact e-mail address, and `python -m unittest scripts/test_check_governance.py` exercises both the passing and failing paths.

## Dependency semantics for approval-gated issues
A hard prerequisite is satisfied for *implementation* once its code is merged and verified. An issue left open only for a human approval or real-provider check (for example #6, #32, #40) is "code-complete, closure pending": dependants may be implemented and merged, but must not be closed before that issue closes, and the dependant's PR must say so. No security, consent or approval requirement is removed by this rule.
