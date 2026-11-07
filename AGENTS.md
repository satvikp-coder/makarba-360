# Future development sessions

Read README, the issue, linked architecture, dependency map and setup-progress before acting. This baseline is planning only. Never implement unrelated scope or treat planning documents as tested software.

1. Verify blockers are closed with completion evidence; use branch issue-<number>-<slug>.
2. Preserve researcher-only collection, independently stored interview and subject locations, private raw GPS, and allowlisted publication projection.
3. Never commit credentials, participant records, exact interview coordinates, protected media or institutional approval documents containing personal details. Use explicitly synthetic fixtures outside the real study area.
4. Read the dated ADRs; recheck maintained versions and provider terms before integration. No paid service activation without owner approval.
5. Add meaningful positive and negative tests; run relevant checks, update docs, commit, push and open a PR referencing the issue. Inspect CI, fix findings, and respect required review/branch protections. Do not bypass failed checks.
6. Merge only with session authorization and repository permissions; verify merged commit and close only with evidence. No force pushes or overwrites of unrelated work.
7. Do not invent geography, historical facts, survey findings, people, ownership assignments or approvals. No public survey forms.
8. If blocked, record durable state and exact limitation; do independent authorized work. Keep issue mappings idempotent.

Implementation report: Issue; Branch; Commit; PR; Changes; Tests (commands/results); Security review; Limitations; Verdict PASS / FIX REQUIRED / BLOCKED.

Planning automation: scripts/build_planning.py creates the baseline; do not rerun it over later edited documentation. scripts/publish_github.py resumes GitHub setup using stable catalogue IDs. scripts/verify_planning.py checks the catalogue and remote snapshot. Do not introduce real data to make a demo look complete.
