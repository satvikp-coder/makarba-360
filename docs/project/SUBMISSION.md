# Makarba 360° — submission summary

Status on `main` at the time of writing: **119 issues closed, 18 open.** All software issues are closed. The 18 open issues are
human, institutional or deployment steps that code cannot complete, and they are deliberately left open rather than marked done.

## What is built
- **Public web app** (`apps/web`): map, places, timeline, stories, insights, panorama viewer; accessible, with a strict CSP. It never accepts survey submissions.
- **API** (`apps/api`): public read API over a PostGIS `published` projection (OpenAPI contract tests), and a capability-checked private API
  (OIDC sessions, MFA by role, consent, visits, interviews, GPS positions, submission, independent review, location proposals).
- **Database** (`packages/db`): migrations 0001+ with separate runtime roles, append-only audit tables and privacy triggers.
- **Packages**: `survey`, `analytics` (small-count suppression, k=5), `gis-io`, `authz`, `config`.
- **CI**: build, typecheck, lint, unit and DB tests on real PostGIS, browser tests, dependency audit, secret scan, budgets, planning integrity.

## Run it (synthetic data only)
```
pnpm install
pnpm dev:mock          # API with mock data
pnpm --filter @makarba/web dev
pnpm test              # unit tests; DB tests run in CI or with TEST_DATABASE_URL
```
`docker compose up -d db` (via `pnpm dev:services`) starts PostGIS for the database-backed tests and server.

## Why 18 issues stay open
| Issues | Needs |
|---|---|
| #4, #6, #7, #8 | Research-lead / stakeholder approval of methodology, capability matrix and requirements baselines |
| #11, #122 | Institutional ethics and legal approval; consent and data-quality audit |
| #23, #120 | Verified study boundary and verified candidate places/roads |
| #32 | A real identity provider (tested end to end with a fake one) |
| #117, #121 | Real mobile devices, real GPS and offline pilot |
| #118, #119 | Researcher training and a consent-approved field pilot |
| #123, #125 | Source/media attribution audit; validated research dataset |
| #124, #126, #127 | Staging/production hosting, release demo, handover |

## Data note
The demo uses **synthetic data** (coordinates near [10,10], not Makarba). Field photos and interview notes collected by the team are
real participant material, are **not** in this repository (it is public) and may only be added after ethics approval (#11).
Anything on the public site that implies real survey results would be untrue until then.
