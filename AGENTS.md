# Future development sessions

Read README, the issue, linked architecture, dependency map and setup-progress before acting. This baseline is planning only. Never implement unrelated scope or treat planning documents as tested software.

1. Read docs/project/two-developer-workstreams.md and the authoritative developer-issue-allocation.json. Verify hard blockers with completion evidence; use dev-a/issue-<number>-<slug> or dev-b/issue-<number>-<slug>. Integration and operational gates remain mandatory for actual runtime/real-data claims; mock-backed component evidence must be labeled as such.
2. Preserve researcher-only collection, independently stored interview and subject locations, private raw GPS, and allowlisted publication projection.
3. Never commit credentials, participant records, exact interview coordinates, protected media or institutional approval documents containing personal details. Use explicitly synthetic fixtures outside the real study area.
4. Read the dated ADRs; recheck maintained versions and provider terms before integration. No paid service activation without owner approval.
5. Add meaningful positive and negative tests; run relevant checks, update docs, commit, push and open a PR referencing the issue. Inspect CI, fix findings, and respect required review/branch protections. Do not bypass failed checks.
6. Merge only with session authorization and repository permissions; verify merged commit and close only with evidence. No force pushes or overwrites of unrelated work.
7. Do not invent geography, historical facts, survey findings, people, ownership assignments or approvals. No public survey forms.
8. If blocked, record durable state and exact limitation; do independent authorized work. Keep issue mappings idempotent.

Implementation report: Issue; Branch; Commit; PR; Changes; Tests (commands/results); Security review; Limitations; Verdict PASS / FIX REQUIRED / BLOCKED.

Planning automation: scripts/build_planning.py creates the baseline; do not rerun it over later edited documentation. scripts/publish_github.py resumes GitHub setup using stable catalogue IDs. scripts/verify_planning.py checks the catalogue and remote snapshot. Do not introduce real data to make a demo look complete.

Two-developer allocation supersedes the original single-category dependency plan. Do not rerun baseline generators or the legacy publisher over allocated issues. Use scripts/swap_ownership.py for current mapping/render/apply and scripts/verify_ownership_swap.py for verification; scripts/verify_allocation.py delegates to the current schema. Preserve all original dependency arrays; preserve the immutable allocation-baseline.json. Developer A is varunkarthic (core-platform); Developer B is satvikp-coder (public-experience). Use the frozen ownership-swap-snapshot.json and ownership-swap-map.json; never reverse the already-swapped assignments. Varun may remain formally unassigned until his existing invitation is accepted; obsolete Satvik core assignees must be removed. Closed history remains unchanged. No CODEOWNERS or new mandatory protection rule was installed. Follow code-ownership.md, developer-handoffs.md and coordination.md before shared-file/contract changes.
