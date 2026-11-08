"""Regenerates REMAINING_DEVELOPER_A_ISSUES.md / .json from GitHub (authoritative) + the allocation JSON + the table below.
Run: python docs/project/make_remaining_a.py     (read-only against GitHub; it changes no assignee, label or state)."""
import json, subprocess

R = "satvikp-coder/makarba-360"
gh = lambda *a: json.loads(subprocess.check_output(["gh", *a], text=True, encoding="utf8"))
open_a = {i["number"]: i for i in gh("issue", "list", "-R", R, "--label", "owner:developer-a", "--state", "open", "--limit", "200", "--json", "number,title,assignees")}
all_state = {i["number"]: i["state"] for i in gh("issue", "list", "-R", R, "--state", "all", "--limit", "400", "--json", "number,state")}
alloc = {r["number"]: r for r in json.load(open("docs/project/developer-issue-allocation.json", encoding="utf-8"))["issues"]}
sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()

# number -> (what Claude finished, PRs, remaining, tests, approvals)
W = {
 3: ("Nothing decided on anyone's behalf; draft vision/boundary text exists in docs.", "-", "Product vision and boundaries must be approved by the project owner/supervisor.", "python scripts/check_traceability.py", "Project owner / supervisor"),
 4: ("Methodology drafts in docs/research.", "-", "The research lead must confirm questions and methodology (blocks #42, #11).", "-", "Research lead / supervisor"),
 6: ("Capability matrix PROPOSED and enforced in code (production start-up refuses an unapproved matrix).", "#153 and earlier", "Stakeholders approve the matrix; then update docs/project/contracts/capability-matrix.json by PR.", "pnpm --filter @makarba/authz test", "Stakeholders who own the matrix"),
 7: ("-", "-", "Baseline functional requirements need #6.", "-", "Project owner"),
 8: ("-", "-", "Non-functional baseline needs #7.", "-", "Project owner"),
 11: ("Consent and protocol drafts only.", "-", "Institutional ethics/legal approval is an institutional act; nothing may be collected before it.", "-", "Ethics committee / institution"),
 23: ("Versioned study_areas table exists (migration 0001).", "earlier", "Boundary validation/versioning workflow and the verified boundary itself (needs #5 verified geography, a human task).", "pnpm --filter @makarba/db test (CI)", "Geography verifier / research lead"),
 30: ("Candidate geometry propose/review exists (#27).", "#212", "Editing workflow beyond propose/review; needs #35.", "pnpm --filter @makarba/api test", "-"),
 32: ("Sessions, OIDC login, MFA-by-role, wired to PostgreSQL with a fake IdP.", "#147, #215", "Real identity provider; closure rule: cannot close before #6.", "pnpm --filter @makarba/api test (CI database job)", "Institution (IdP); stakeholders (#6)"),
 33: ("Invitation redemption, deactivation, training prerequisite, tested end to end.", "#152, #215", "Closure waits for #32/#6; admin screens (#95).", "same", "-"),
 34: ("Role/study authorization with deny-by-default, fake-IdP end-to-end.", "#153, #215", "Closure waits for #32/#6.", "same", "Stakeholders (#6)"),
 35: ("Capability checks on every private route (typo fails closed); audit of every decision.", "#154, #215", "Closure waits for #34/#6; UI enforcement is front-end.", "same", "Stakeholders (#6)"),
 37: ("Scoped, versioned, append-only consent with terminal refusal/withdrawal.", "#216", "Real script texts (#11); interview tables now exist.", "pnpm --filter @makarba/api test; PostGIS consent tests in CI", "Ethics committee (#11)"),
 38: ("Positions/answers are private (owner or assigned lead only), no public path, discard on withdrawal.", "#218, #219", "Needs #35 closure; a formal exposure test suite (#110).", "pnpm --filter @makarba/api test", "-"),
 42: ("Instrument/answer rules package with synthetic instrument.", "#217", "Real questionnaire and #4 approval.", "pnpm --filter @makarba/survey test", "Research lead (#4)"),
 43: ("Immutable published versions with hash and named authority.", "#217", "Needs #42.", "CI database job", "Research lead names the approving authority"),
 44: ("Visits with status history and keep/abandon reconciliation.", "#218", "Needs #23/#35; field app screens.", "CI database job", "-"),
 45: ("Idempotent interview start gated on consent and published version.", "#218", "Needs #20/#43/#44 closure; field app.", "CI database job", "-"),
 46: ("Official claims always pending; independent decision; attributable-only view.", "#219", "Verification route needs a matrix action (#6); participant-category screens.", "CI database job", "Stakeholders (#6)"),
 47: ("Consent + interview metadata retained independently.", "#216, #218", "Needs #37/#45 closure.", "CI database job", "Ethics (#11)"),
 48: ("Permission state capture on the server (granted/denied/unsupported...).", "#219", "Mobile permission UI and real-device behaviour (#121).", "CI database job", "-"),
 49: ("Quality bands, recapture as new revision, raw preserved.", "#219", "Recapture UI; real-device testing.", "pnpm --filter @makarba/survey test", "-"),
 50: ("Independent interview and subject geography.", "#219", "Needs #27 closure confirmation and UI.", "CI database job", "-"),
 51: ("Answer validation/branching rules (survey package).", "#217", "Rendering in the field app and topic-group answers.", "pnpm --filter @makarba/survey test", "-"),
 52: ("Server-side submit + review decisions + history.", "#220", "On-device durable save (#55), field app.", "CI database job", "-"),
 53: ("Own submission history list.", "#220", "Corrections and resubmission workflow (needs #52/#57).", "-", "-"),
 81: ("Public API router, PgPublicRepository, projection tables, server wiring.", "#204, #210", "Publication worker that writes published.*; browser journeys against this server.", "pnpm --filter @makarba/api conformance <base>/api/v1/public", "-"),
 84: ("Pipeline boundary + frozen fixtures (packages/analytics).", "earlier", "PG record source over approved interviews (needs a topic-group answer model and a real questionnaire mapping) and snapshot store.", "pnpm --filter @makarba/analytics test", "Research lead confirms k=5 policy"),
 192: ("-", "-", "-", "-", "-"),
}


def deps_open(n):
    return [h for h in alloc[n]["hard_dependencies"] if all_state.get(h) == "OPEN"] if n in alloc else []


rows = []
for n in sorted(open_a):
    i = open_a[n]
    what, prs, rem, tests, appr = W.get(n, ("No engineering done in this pass.", "-", "Not started; see the issue's acceptance criteria and open prerequisites.", "see issue", "see issue"))
    rows.append({"issue": n, "title": i["title"], "assignee": ", ".join(a["login"] for a in i["assignees"]) or "-", "open_hard_prerequisites": deps_open(n), "claude_completed": what, "prs": prs, "remaining": rem, "tests": tests, "approvals": appr})
json.dump({"main_sha": sha, "open_developer_a": len(rows), "issues": rows}, open("docs/project/remaining-developer-a-issues.json", "w", encoding="utf-8"), indent=1)
tbl = "\n".join("| #%d | %s | %s | %s | %s | %s | %s | %s | %s |" % (r["issue"], r["title"], r["assignee"], ", ".join("#%d" % d for d in r["open_hard_prerequisites"]) or "none", r["claude_completed"], r["prs"], r["remaining"], r["tests"], r["approvals"]) for r in rows)
open("docs/project/REMAINING_DEVELOPER_A_ISSUES.md", "w", encoding="utf-8").write(
    "# Remaining Developer A issues (checkpoint)\n\nGitHub is authoritative; regenerate with `python docs/project/make_remaining_a.py` (read-only). Main at generation: `%s`. Open Developer A issues: %d. This file changes no assignee, label or state; reassignment is the owner's decision.\n\n"
    "Result categories: engineering preparation merged = code + tests on main; **not** an acceptance claim. An issue is closed only when its own acceptance criteria and hard prerequisites are met.\n\n"
    "| Issue | Title | Assignee | Open hard prerequisites | Claude completed | PRs | Remaining | Tests | Approvals needed |\n|---|---|---|---|---|---|---|---|---|\n%s\n" % (sha, len(rows), tbl))
print(len(rows))
