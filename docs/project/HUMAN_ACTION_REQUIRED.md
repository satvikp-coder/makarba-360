# Human actions required (Developer A)

Written for someone who has not read the architecture documents. Each item says **who**, **where**, **what to do**, **what proof to keep**, and **what it unblocks**. Machine-readable copy: [human-action-required.json](human-action-required.json).

Rules that apply to every item:
- Nobody (including Claude) may write an approval, a name or a date that did not really happen. A draft is not an approval.
- Evidence goes in the repository under `docs/project/approvals/` (create the folder) **and** is linked in a comment on the GitHub issue. Never put real participant data, passwords, or personal details in GitHub; the repository is public.
- Where this file says "the institution", the real person or office must be identified by you. The repository deliberately does not name anyone (see [governance](governance.md)).

State of the software (checked against GitHub): issues #1, #9, #10, #22 and #36 are finished and closed. Issues #6, #32, #34 and #40 have all their code merged but stay **open** for the human items below. See the [progress ledger](CLAUDE_DEVELOPER_A_PROGRESS.md).

---

## P0 — blocks approvals or production use

### H1. Approve (or change) the capability matrix — issue [#6](https://github.com/satvikp-coder/makarba-360/issues/6)
- **Who:** the project owner together with the faculty supervisor / research lead. Whoever the institution says has authority to approve who may see interview data.
- **Where:** read [capability-matrix.md](capability-matrix.md) (a table of who may do what). Record the decision in GitHub issue #6.
- **What to do:**
  1. Read the table and the section "Decision needed from stakeholders". Five choices need an answer: (a) are *lead* and *reviewer* two different roles, or one; (b) who may create restricted research exports and for what purpose; (c) whether "break-glass" emergency access to raw records should exist at all, and for how long; (d) which roles must use multi-factor sign-in (proposal: lead, reviewer, administrator); (e) that an administrator can manage accounts but can never read interview content by default.
  2. If you want changes, edit `docs/project/contracts/capability-matrix.json` (or comment on #6) and ask Claude to apply them.
  3. When you agree, write the decision in a comment on #6 using the template below, then copy the same facts into `docs/project/approvals/capability-matrix-approval.md`.
- **Proof to keep:** the approver's own words and date (GitHub comment from their own account, or signed meeting minutes saved as a PDF or photo kept privately with the file name referenced).
- **Do not:** type an approval on someone else's behalf, or edit `approved_by` in the JSON without the proof above.
- **Unblocks:** closing #6, #32, #34; running the API in production (it refuses to start while the matrix is not approved); closing #35 and everything gated behind it; starting #7 and #11 formally.
- **Next Claude action:** check the proof exists, set `status`, `approved_by`, `approved_on` in `capability-matrix.json`, re-run the policy tests, update the MFA role list in `packages/auth/src/oidc.ts` to the approved list, close #6, #34, and (after H2) #32.
- **Template for the GitHub comment (fill in; do not post it unless true):**
  > I, `<full name, role>`, on `<date>`, approve the capability matrix in `docs/project/capability-matrix.md` at commit `<sha>`, with these decisions: lead/reviewer distinct = `<yes/no>`; restricted exports = `<rule>`; break-glass = `<yes/no, max duration>`; MFA roles = `<list>`; administrator has no default access to interview content = `yes`.

### H2. Choose and set up the sign-in (identity) provider — issue [#32](https://github.com/satvikp-coder/makarba-360/issues/32)
- **Who:** project owner with whoever runs the institution's accounts / IT.
- **Where:** your identity provider's admin console; the secret values go into your hosting platform's secret store, **never** into GitHub.
- **What to do:**
  1. Choose a provider that supports "OpenID Connect" with an authorization-code flow and multi-factor login (the code was tested against a stand-in provider only). Record the choice in a short note.
  2. Create an application/client for "Makarba staging". Set the redirect address to `https://<staging-host>/auth/callback`.
  3. Turn on multi-factor authentication for the people who will be leads or administrators.
  4. Store the issuer address, client id and client secret in the staging secret store.
  5. Tell Claude the provider name and the endpoints (no secrets in chat). Claude will wire the configuration.
  6. Staging test: sign in as a test account, sign out, and confirm a deactivated account is refused. Save a short screenshot-free note of the result.
- **Proof:** the note, plus a comment on #32.
- **Unblocks:** closing #32; real sign-in for #33, #56, #95, #109.
- **Do not:** buy a paid plan without owner approval; share the client secret in an issue.

### H3. Institutional ethics and legal approval — issue [#11](https://github.com/satvikp-coder/makarba-360/issues/11)
- **Who:** the institution's research ethics committee (or equivalent) through your faculty supervisor.
- **Where:** the institution's own approval process. The material already written is in `docs/research/` (methodology, sampling plan, questionnaire, consent protocol, field SOP, GPS protocol, data dictionary) and `docs/architecture/privacy-security.md` (retention and data handling).
- **What to do:** (1) ask your supervisor which form the committee needs; (2) attach the documents above; (3) ask the committee to state in writing its decision on recruitment, age limits, consent wording, how long raw data is kept, and where data may be hosted; (4) save the decision.
- **Proof:** the committee's written decision (kept privately) and a one-line reference in `docs/project/approvals/ethics-approval-reference.md` (date, reference number, scope, expiry).
- **Unblocks:** any real interview, real consent record, real GPS capture; issue #11; the operational gate on #37, #119, #121.
- **Do not:** run any real interview or store any real participant data before this exists.

---

## P1 — required before integration or release

### H4. Turn on branch protection in GitHub
- **Who:** the repository owner (`satvikp-coder`).
- **Where:** GitHub → repository → Settings → Rules (or Branches) → add a rule for `main`.
- **What to do:** require a pull request; require status checks `planning`, `node (ubuntu-latest)`, `node (windows-latest)`, `conformance`, `database`; block force pushes; if a second person can review, require one approval.
- **Proof:** screenshot of the rule or a comment on [#1](https://github.com/satvikp-coder/makarba-360/issues/1).
- **Why:** today anyone with write access can merge without checks; the repository relied on discipline.

### H5. Work only Developer B can do (my friend)
Developer B now has these unblocked by the finished scaffold: #12, #2, #5, #24, #106, #63, #85–#87, and anything listed "ready" on their label. Things Developer A is waiting for from B:
- #5 verified study extent (also needs a human to verify the map source) → blocks #23.
- #12 visual tokens and #26 taxonomy icons → blocks #26, #27, and everything geographic behind it.
- #20 field screen design → needs to exist before #45 can be finished.
- #54 offline feasibility on real devices → blocks #55, #56, #57 (offline sync).
- Run `pnpm dev:mock` to get the synthetic public API described in [issue #10's comment](https://github.com/satvikp-coder/makarba-360/issues/10).

### H6. Real-device and field validation (needs people and phones)
- **Issues:** #54, #62, #111, #112, #117 (device tests); #118 (training), #119 and #121 (real pilot); #122 (consent and data-quality audit).
- **Who:** the research lead with the trained researchers, after H3.
- **Where:** in Makarba, with the written procedures in `docs/research/field-visit-sop.md`, `gps-protocol.md`, `consent-protocol.md`.
- **What to do (device tests, before any real interview):** on each phone model you own, in each browser you intend to use, with location permission denied, then granted, then with airplane mode on: record whether a GPS fix and its accuracy are obtained, whether a draft survives closing the browser and a phone restart, and whether a repeated upload creates a duplicate. Record device, OS, browser, date, result. Use fake interviews only.
- **Proof:** a table of results per device saved in `docs/project/approvals/device-test-results.md`; for the pilot, the lead's written audit.
- **Do not:** record these as passed from a computer-only simulation.

### H7. Hosting, cost and region decision — issues #116, #124 (B), #81
- **Who:** project owner with the supervisor.
- **What to do:** decide where the database and storage will run (institution server vs paid cloud) and the monthly spending limit. Nothing is purchased by Claude.
- **Proof:** a short written decision with region and monthly cap.
- **Unblocks:** backup-restore rehearsal (#116), real staging, production.

---

## P2 — research validity and publication

### H8. Disclosure thresholds and publication approval — issues #92, #103, #125
- **Who:** research lead and the ethics contact.
- **What:** approve the minimum group size for showing counts (the code uses a provisional 5, which is **not** an anonymity guarantee), who may approve publication, and how a withdrawal is handled.
- **Proof:** written decision in `docs/project/approvals/disclosure-policy.md`.

### H9. Rights and verification of public content — issue #123 (B), #125
- **Who:** research lead. **What:** confirm the right to publish each photo, quote and historical claim; no fabricated evidence.

---

## What to give Claude after each item

Paste this, filling the brackets:

> Resume Makarba 360 Developer A work. Evidence now exists for: [H1 / H2 / H3 / ...] at [paths and issue comment links]. Re-read GitHub, verify each piece of evidence really exists and was written by the right person, update `capability-matrix.json` and the docs accordingly, run all tests, merge eligible PRs, close issues #[...] whose acceptance criteria are now met, then continue with the next ready Developer A issues from `docs/project/CLAUDE_DEVELOPER_A_PROGRESS.md`.
