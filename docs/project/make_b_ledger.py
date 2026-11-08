"""Regenerates the Developer B ledger from GitHub (authoritative) + allocation JSON. Run: python docs/project/make_b_ledger.py"""
import json, subprocess
R = "satvikp-coder/makarba-360"
gh = lambda *a: json.loads(subprocess.check_output(["gh", *a], text=True))
issues = {i["number"]: i for i in gh("issue", "list", "-R", R, "--label", "owner:developer-b", "--state", "all", "--limit", "200", "--json", "number,title,state,assignees")}
alloc = {r["number"]: r for r in json.load(open("docs/project/developer-issue-allocation.json", encoding="utf-8"))["issues"] if r["owner"] == "B"}
a_issues = {i["number"]: i["state"] for i in gh("issue", "list", "-R", R, "--label", "owner:developer-a", "--state", "all", "--limit", "200", "--json", "number,state")}
merged = {12: ("#156", "b6f17fb"), 13: ("#157", "fb2f741"), 14: ("#158", "ffed2ff"), 15: ("#158", "ffed2ff"), 24: ("#158", "ffed2ff"), 16: ("#160", "8899300"), 17: ("#160", "8899300"), 19: ("#160", "8899300"), 72: ("#161", "46dfb49"), 25: ("#162", "3a6a8f1"), 74: ("#164", "d0772cc"), 73: ("#165", "2d7d586"), 77: ("#166", "e7debaa"), 18: ("#168", "c2a98df"), 83: ("#169", "bf2221f"),
  106: ("#171", "0edaf0e"), 63: ("#172", "6362696"), 61: ("#173", "96478a5"), 68: ("#174", "da4972a"), 75: ("#175", "c6151b3"), 78: ("#176", "a6a98a4"), 69: ("#177", "ea4b64a"), 29: ("#178", "cdd2e05"), 70: ("#179", "6b13da6"), 20: ("#180", "d4b1020"), 21: ("#181", "d74e209"), 31: ("#182", "3c5f6d4"),
  85: ("#183", "8925556"), 86: ("#183", "8925556"), 87: ("#183", "8925556"), 89: ("#183", "8925556"), 101: ("#184", "dba8878"), 104: ("#185", "2092428"), 64: ("#186", "956dc77"), 65: ("#186", "956dc77"), 66: ("#186", "956dc77"), 67: ("#186", "956dc77"),
  76: ("#187", "414c318"), 79: ("#188", "f9acc79"), 88: ("#189", "164cf81"), 91: ("#189", "164cf81"), 93: ("#189", "164cf81"), 94: ("#190", "8da0ba9"), 102: ("#190", "8da0ba9"), 108: ("#191", "8eb0920"), 2: ("#195", "a710d42"), 71: ("#196", "aed672f"),
  # partial work merged, issue still open:
  80: ("#188", "f9acc79"), 82: ("#167", "9dfabbf"), 113: ("#194", "664f0ba"), 114: ("#198", "cb37972"), 115: ("#192", "7a1298b"), 123: ("#197", "39844ba"), 54: ("#199", "f73df42")}
human = {82: "H6 real-device soft-keyboard check (code merged in #167/9dfabbf)", 118: "H6", 117: "H6", 62: "H6", 119: "H6", 124: "H7", 5: "H9 (verified geography)", 120: "H9", 123: "H9 (tool merged in #197; real content not yet audited)", 54: "H-OFFLINE real Android + iPhone runs of tools/offline-probe (tool merged in #199)", 114: "H-A11Y screen reader / device / language review (automated part merged in #198)", 115: "H-CI branch protection and agreed budgets (gates merged in #192)"}
dev_a = {80: "needs a public contract for approved accounts and live data (partial merged in #188)", 113: "needs the live field app, API and database; model-level journey merged in #194"}
sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
def closed(n): return issues[n]["state"] == "CLOSED" if n in issues else a_issues.get(n) == "CLOSED"
rows = []
for n in sorted(issues):
    i, a = issues[n], alloc[n]
    hard = [h for h in a["hard_dependencies"] if not closed(h)]
    if i["state"] == "CLOSED": st, note = "VERIFIED_COMPLETE", ""
    elif n in dev_a: st, note = "WAITING_FOR_DEVELOPER_A", dev_a[n]
    elif n in human: st, note = "WAITING_FOR_HUMAN_REVIEW", "see DEVELOPER_B_HUMAN_ACTION_REQUIRED.md " + human[n]
    elif hard:
        own = [h for h in hard if h in issues]; other = [h for h in hard if h not in issues]
        st = "WAITING_FOR_OWN_PREREQUISITE" if own else "WAITING_FOR_DEVELOPER_A"
        note = "open hard prerequisites: " + ", ".join("#%d" % h for h in hard)
    else: st, note = "READY_NOW", "hard prerequisites closed; integration deps use mocks"
    rows.append({"issue": n, "title": i["title"], "state": i["state"], "status": st, "pr": merged.get(n, ("", ""))[0], "merge_sha": merged.get(n, ("", ""))[1], "assignee": ", ".join(a["login"] for a in i.get("assignees", [])) or "-", "note": note})
json.dump({"main_sha": sha, "total": len(rows), "closed": sum(r["state"] == "CLOSED" for r in rows), "issues": rows}, open("docs/project/claude-developer-b-progress.json", "w"), indent=1)
ready = [r["issue"] for r in rows if r["status"] == "READY_NOW"]
tbl = "\n".join("| #%d | %s | %s | %s | %s | %s | %s |" % (r["issue"], r["title"], r["status"], r["assignee"], r["pr"], r["merge_sha"], r["note"]) for r in rows)
open("docs/project/CLAUDE_DEVELOPER_B_PROGRESS.md", "w", encoding="utf-8").write(
    "# Developer B progress ledger (Claude, for satvikp-coder)\n\nGitHub is authoritative; this is a regenerable checkpoint (`python docs/project/make_b_ledger.py`). Main SHA at generation: `%s`.\n\nTotal Developer B issues: %d. Closed: %d. Ready now: %s.\n\nAll 26 open issues are assigned to varunkarthic on GitHub (verified 2026-11-08); the `owner:developer-b` label and closed history are unchanged. Stretch issues #128 and #130-#135 are UNFINISHED: only disabled rule modules exist, no UI, not released.\n\nThe earlier Developer A history is in CLAUDE_DEVELOPER_A_PROGRESS.md and is unchanged.\n\n| Issue | Title | Status | Assignee | PR | Merge SHA | Note |\n|---|---|---|---|---|---|---|\n%s\n" % (sha, len(rows), sum(r["state"] == "CLOSED" for r in rows), ", ".join("#%d" % n for n in ready), tbl))
print(len(rows), ready)
