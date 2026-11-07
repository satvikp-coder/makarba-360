# Stakeholder capability matrix

**Status: PROPOSED — AWAITING STAKEHOLDER APPROVAL.** Issue #6. No stakeholder has approved this; `approved_by` is null in the machine-readable source `docs/project/contracts/capability-matrix.json`. No named approver exists (see governance vacancies).

Roles: visitor, researcher, lead, reviewer, administrator. Access values: `read`, `own` (own records only), `assigned` (assigned study only), `grant` (explicit audited grant).

## Principles
- Roles are additive explicit grants scoped to study and record ownership.
- Administrator is not a universal data reader.
- A researcher cannot approve their own public content; publication needs an independent reviewer.
- Break-glass requires reason, expiry and audit; never silent.
- Server-side enforcement on every private route; UI visibility is not authorisation.
- Official respondent status is an evidence workflow, not an application role.

## Matrix

| Action | Description | Study scope | Ownership policy | Grants |
|---|---|---|---|---|
| `public.read_published` | Read published map, stories, safe aggregates | public | any | visitor: read, researcher: read, lead: read, reviewer: read, administrator: read |
| `visit.start` | Start field visit | study | assigned_researcher | researcher: own |
| `interview.create` | Create interview survey record | study | assigned_researcher | researcher: own |
| `interview.edit_draft` | Edit own unsynced/draft interview | record | owner | researcher: own |
| `gps.capture` | Capture interview GPS (separate from subject location) | record | owner | researcher: own |
| `subject_location.link` | Link discussed place to interview | record | owner | researcher: own |
| `interview.view_private` | View raw interview answers and exact interview GPS | record | owner_or_assigned_study_review | researcher: own, lead: assigned |
| `interview.request_correction` | Request correction of submitted record | record | owner | researcher: own |
| `interview.review_correction` | Review/approve correction revision | record | assigned_study | lead: assigned, reviewer: assigned |
| `location.propose_geometry` | Propose private location geometry candidate | study | assigned_researcher | researcher: own |
| `location.review_geometry` | Review geometry changes | study | assigned_study | lead: assigned |
| `consent.verify` | Verify consent/sources for publication | record | assigned_study | lead: assigned, reviewer: assigned |
| `media.submit` | Submit consented media candidate | record | owner | researcher: own |
| `content.publish` | Approve and publish content | record | independent_reviewer | lead: assigned, reviewer: assigned |
| `analytics.view_aggregate` | View privacy-safe aggregates (min-n applied) | study | assigned_study | researcher: assigned, lead: assigned, reviewer: assigned, administrator: read |
| `export.restricted` | Create restricted research export | study | approved_purpose_and_study | lead: grant |
| `export.operate_job` | Operate approved export job (no content access) | system | explicit_grant | administrator: grant |
| `user.manage` | Invite, deactivate and assign roles | system | audited | administrator: grant |
| `config.manage` | Manage backups and system configuration | system | audited | administrator: grant |
| `audit.view` | View non-content security audit events | system | audited | administrator: grant, lead: assigned |
| `breakglass.access` | Break-glass raw access (reason, expiry, audit) | record | time_boxed_reason | administrator: grant |

## Security assumptions
- Every private route evaluates role, study assignment and record ownership server-side (`docs/architecture/privacy-security.md`); disabled UI buttons are not controls.
- Interview GPS and subject location are separate fields; both are private until an allowlisted publication projection is approved.
- Administrator manages accounts, backups and configuration only; it has **no** raw research read, which is enforced by `scripts/check_capability_matrix.py` (admin alone cannot view all research records).
- Roles and the `reviewer` split are a proposal derived from `docs/product/personas.md`; the persona table has no separate reviewer column, so stakeholders must confirm whether lead and reviewer remain distinct.

## What approval blocks
Formal sign-off of this matrix gates final closure of #6 and the sensitive-rule implementation issues (#34, #35). It is a *formal* dependency for #9/#10 (declared hard in the issue graph) rather than a technical one: architecture diagrams and scaffolding do not consume the matrix contents. Suggested transparent correction for owner review: relax #9→#6 to a soft input. This document does not alter the dependency graph.

## Decision needed from stakeholders
Approve or amend the matrix above (especially lead vs reviewer, export grants and break-glass), then set `approved_by`/`approved_on` and status in the JSON.

## Verification
`python scripts/check_capability_matrix.py` and `python -m unittest discover -s scripts -p 'test_*.py'`.
