"""Dependency advisory gate (issue #115).

Runs `pnpm audit --json` and fails on any advisory that is not in the reviewed baseline, or whose baseline entry has expired.
The baseline lists known advisories with an owner, reason and review date, so existing issues stay visible and new ones
cannot slip in. Usage: python scripts/check_dependency_audit.py [--from-file audit.json] [--today YYYY-MM-DD]
"""
from __future__ import annotations
import argparse, datetime, json, pathlib, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASELINE = ROOT / "docs/project/audit-baseline.json"
SEVERITIES = ("low", "moderate", "high", "critical")

def parse_audit(raw: dict) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for a in (raw.get("advisories") or {}).values():
        gid = a.get("github_advisory_id") or str(a.get("id"))
        paths = sorted({f["paths"][0] for f in a.get("findings", []) if f.get("paths")})
        out[gid] = {"package": a.get("module_name"), "severity": a.get("severity"), "title": a.get("title"), "paths": paths}
    return out

def evaluate(found: dict[str, dict], baseline: dict, today: datetime.date) -> tuple[list[str], list[str]]:
    """Returns (failures, notes)."""
    accepted = {e["id"]: e for e in baseline.get("accepted", [])}
    failures: list[str] = []
    notes: list[str] = []
    for gid, a in sorted(found.items()):
        e = accepted.get(gid)
        if e is None:
            failures.append(f"NEW {a['severity']} advisory {gid} in {a['package']} ({a['paths'][0] if a['paths'] else '?'}): {a['title']}")
            continue
        if datetime.date.fromisoformat(e["review_by"]) < today:
            failures.append(f"EXPIRED baseline entry {gid} ({a['package']}, owner {e['owner']}): review date {e['review_by']} has passed")
    for gid, e in sorted(accepted.items()):
        if gid not in found:
            notes.append(f"baseline entry {gid} ({e['package']}) no longer reported; remove it from the baseline")
    for e in baseline.get("accepted", []):
        for k in ("id", "package", "severity", "owner", "reason", "review_by"):
            if not e.get(k):
                failures.append(f"baseline entry {e.get('id', '?')} is missing '{k}'")
    return failures, notes

def run_audit() -> dict:
    last = ""
    for attempt in range(3):
        p = subprocess.run(["pnpm", "audit", "--json"], cwd=ROOT, capture_output=True, text=True, encoding="utf8", errors="replace", shell=sys.platform == "win32")
        try:
            return json.loads(p.stdout)          # pnpm exits non-zero when it finds advisories; the JSON is still valid
        except json.JSONDecodeError:
            last = (p.stderr or p.stdout)[-300:]
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f"could not obtain audit results (registry unreachable?): {last}")

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-file"); ap.add_argument("--today")
    a = ap.parse_args()
    raw = json.loads(pathlib.Path(a.from_file).read_text(encoding="utf8")) if a.from_file else run_audit()
    today = datetime.date.fromisoformat(a.today) if a.today else datetime.date.today()
    found = parse_audit(raw)
    failures, notes = evaluate(found, json.loads(BASELINE.read_text(encoding="utf8")), today)
    by_sev = {s: sum(1 for x in found.values() if x["severity"] == s) for s in SEVERITIES}
    print(f"advisories reported: {len(found)} {by_sev}; accepted in baseline: {len(json.loads(BASELINE.read_text(encoding='utf8')).get('accepted', []))}")
    for n in notes: print("note:", n)
    if failures:
        print("DEPENDENCY AUDIT FAILED:"); [print(" -", f) for f in failures]; return 1
    print("no new or expired advisories"); return 0

if __name__ == "__main__":
    sys.exit(main())
