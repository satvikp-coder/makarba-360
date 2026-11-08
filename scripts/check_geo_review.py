"""Geography verification register checker (issues #5, #28, #120).

docs/research/geo-review-register.json records REAL review events for the study boundary, road corridors and candidate places. An item is
VERIFIED only if it carries a complete, dated review by a named person with evidence, the reviewed file's SHA-256 still matches, and the
geometry import check was recorded as accepted. Anything else stays UNVERIFIED. The shipped register is empty: no geography is verified.

Usage: python scripts/check_geo_review.py [--require-boundary] [--today YYYY-MM-DD]
`--require-boundary` is the release gate: it fails unless an approved study boundary exists.
"""
from __future__ import annotations
import argparse, datetime, hashlib, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
REGISTER = ROOT / "docs/research/geo-review-register.json"
KINDS = {"boundary", "road", "place"}
METHODS = {"site_visit", "authoritative_map", "both"}
LICENCES = {"ODbL-1.0", "CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0", "public-domain", "project-own"}


def check_item(it: dict, today: datetime.date, root: pathlib.Path = ROOT) -> tuple[str, list[str]]:
    """Returns (state, problems). state is VERIFIED, REJECTED, PENDING or INVALID."""
    p: list[str] = []
    for k in ("id", "kind", "file", "fileSha256", "source", "importCheck", "decision"):
        if k not in it:
            p.append(f"missing '{k}'")
    if p:
        return "INVALID", p
    if it["kind"] not in KINDS:
        p.append(f"kind must be one of {sorted(KINDS)}")
    f = root / it["file"]
    if not f.is_file():
        p.append(f"file not found: {it['file']}")
    elif hashlib.sha256(f.read_bytes()).hexdigest() != it["fileSha256"]:
        p.append("file changed after it was reviewed (SHA-256 mismatch); it must be reviewed again")
    s = it["source"] if isinstance(it["source"], dict) else {}
    for k in ("name", "date"):
        if not str(s.get(k, "")).strip():
            p.append(f"source.{k} is required")
    if s.get("licence") not in LICENCES:
        p.append("source.licence must be on the approved list")
    if it["decision"] == "pending":
        return ("INVALID" if p else "PENDING"), p
    if it["decision"] not in ("approved", "rejected"):
        return "INVALID", p + ["decision must be approved, rejected or pending"]
    r = it.get("review") if isinstance(it.get("review"), dict) else {}
    for k in ("reviewerName", "reviewerRole", "method", "reviewedOn", "evidence"):
        if not r.get(k):
            p.append(f"review.{k} is required for a decision")
    if r.get("method") and r["method"] not in METHODS:
        p.append(f"review.method must be one of {sorted(METHODS)}")
    try:
        d = datetime.date.fromisoformat(str(r.get("reviewedOn")))
        if d > today:
            p.append("review date is in the future")
    except ValueError:
        p.append("review.reviewedOn must be an ISO date")
    if it["decision"] == "approved":
        if it.get("importCheck") != "accepted":
            p.append("approved item must have importCheck 'accepted' (run: pnpm --filter @makarba/gis-io check ...)")
        if r.get("reviewerName") and r.get("reviewerName") == it.get("importedBy"):
            p.append("the reviewer must differ from the person who imported the file")
        if not it.get("importedBy"):
            p.append("importedBy is required so independence can be checked")
    return ("INVALID" if p else ("VERIFIED" if it["decision"] == "approved" else "REJECTED")), p


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--require-boundary", action="store_true"); ap.add_argument("--today")
    a = ap.parse_args(argv)
    today = datetime.date.fromisoformat(a.today) if a.today else datetime.date.today()
    reg = json.loads(REGISTER.read_text(encoding="utf8"))
    states: dict[str, str] = {}
    bad = False
    for it in reg.get("items", []):
        st, p = check_item(it, today)
        states[it.get("id", "?")] = st
        print(f"{st:9} {it.get('kind', '?'):8} {it.get('id', '?')}")
        for x in p:
            print("            -", x)
        bad = bad or st == "INVALID"
    verified_boundary = any(it.get("kind") == "boundary" and states.get(it.get("id")) == "VERIFIED" for it in reg.get("items", []))
    if not verified_boundary:
        print("UNVERIFIED: no approved study boundary is recorded. Geography must not be treated as verified.")
    print(f"{len(states)} item(s): " + ", ".join(f"{k}={sum(1 for v in states.values() if v == k)}" for k in ("VERIFIED", "REJECTED", "PENDING", "INVALID")))
    if bad:
        return 1
    if a.require_boundary and not verified_boundary:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
