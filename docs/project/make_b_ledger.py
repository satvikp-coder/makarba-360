"""Regenerates the Developer B ledger from GitHub (authoritative) + allocation JSON. Run: python docs/project/make_b_ledger.py"""
import json, subprocess
R = "satvikp-coder/makarba-360"
gh = lambda *a: json.loads(subprocess.check_output(["gh", *a], text=True))
issues = {i["number"]: i for i in gh("issue", "list", "-R", R, "--label", "owner:developer-b", "--state", "all", "--limit", "200", "--json", "number,title,state")}
alloc = {r["number"]: r for r in json.load(open("docs/project/developer-issue-allocation.json", encoding="utf-8"))["issues"] if r["owner"] == "B"}
a_issues = {i["number"]: i["state"] for i in gh("issue", "list", "-R", R, "--label", "owner:developer-a", "--state", "all", "--limit", "200", "--json", "number,state")}
merged = {12: ("#156", "b6f17fb"), 13: ("#157", "fb2f741"), 14: ("#158", "ffed2ff"), 15: ("#158", "ffed2ff"), 24: ("#158", "ffed2ff")}
human = {118: "H6", 117: "H6", 62: "H6", 119: "H6", 124: "H7", 5: "H9 (verified geography)", 120: "H9", 123: "H9", 102: "H9"}
sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
def closed(n): return issues[n]["state"] == "CLOSED" if n in issues else a_issues.get(n) == "CLOSED"
rows = []
for n in sorted(issues):
    i, a = issues[n], alloc[n]
    hard = [h for h in a["hard_dependencies"] if not closed(h)]
    if i["state"] == "CLOSED": st, note = "VERIFIED_COMPLETE", ""
    elif n in human: st, note = "WAITING_FOR_HUMAN_REVIEW", "see DEVELOPER_B_HUMAN_ACTION_REQUIRED.md " + human[n]
    elif hard:
        own = [h for h in hard if h in issues]; other = [h for h in hard if h not in issues]
        st = "WAITING_FOR_OWN_PREREQUISITE" if own else "WAITING_FOR_DEVELOPER_A"
        note = "open hard prerequisites: " + ", ".join("#%d" % h for h in hard)
    else: st, note = "READY_NOW", "hard prerequisites closed; integration deps use mocks"
    rows.append({"issue": n, "title": i["title"], "state": i["state"], "status": st, "pr": merged.get(n, ("", ""))[0], "merge_sha": merged.get(n, ("", ""))[1], "note": note})
json.dump({"main_sha": sha, "total": len(rows), "closed": sum(r["state"] == "CLOSED" for r in rows), "issues": rows}, open("docs/project/claude-developer-b-progress.json", "w"), indent=1)
ready = [r["issue"] for r in rows if r["status"] == "READY_NOW"]
tbl = "\n".join("| #%d | %s | %s | %s | %s | %s |" % (r["issue"], r["title"], r["status"], r["pr"], r["merge_sha"], r["note"]) for r in rows)
open("docs/project/CLAUDE_DEVELOPER_B_PROGRESS.md", "w", encoding="utf-8").write(
    "# Developer B progress ledger (Claude, for satvikp-coder)\n\nGitHub is authoritative; this is a regenerable checkpoint (`python docs/project/make_b_ledger.py`). Main SHA at generation: `%s`.\n\nTotal Developer B issues: %d. Closed: %d. Ready now: %s.\n\nThe earlier Developer A history is in CLAUDE_DEVELOPER_A_PROGRESS.md and is unchanged.\n\n| Issue | Title | Status | PR | Merge SHA | Note |\n|---|---|---|---|---|---|\n%s\n" % (sha, len(rows), sum(r["state"] == "CLOSED" for r in rows), ", ".join("#%d" % n for n in ready), tbl))
print(len(rows), ready)
