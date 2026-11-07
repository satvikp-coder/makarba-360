# Personas and permission matrix

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Personas are role descriptions, not invented named people.

| Capability | Visitor | Researcher | Lead/editor | Administrator |
|---|---|---|---|---|
| Published map, stories, safe aggregates | Read | Read | Read | Read |
| Start visits/interviews | None | Own assigned visits | Own if also researcher | Only if separately assigned researcher |
| Raw records / exact interview GPS | None | Own assigned records | Assigned study review | No automatic research access |
| Correct submitted record | None | Request revision | Review revision | No automatic edit |
| Verify sources/consent and publish | None | Submit candidates | Review and approve | Infrastructure only |
| Accounts, backups, configuration | None | None | No account escalation | Manage with audit |
| Restricted export | None | None | Approved purpose and study | Operate job only if granted |

Roles are additive explicit grants, scoped to study and record ownership. Administrator is not a universal data reader. Researcher cannot approve their own public story; reviewer separation enforced for publication. Break-glass access requires reason, expiry and audit, never a silent bypass. Official respondent status is a separate verified evidence workflow, not an application role.
