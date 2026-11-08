"""Page-level traceability of the source blueprint (issue #2).

Checks docs/source/page-traceability.json against the repository:
  * all 23 pages are present once, with a title and a caveat where the page is fictional, suggested or illustrative;
  * every requirement it cites exists in docs/product/requirements.md, and every requirement is covered by a page or listed as
    "not from the blueprint" with a reason;
  * every document it cites exists;
  * every page resolves to at least one existing GitHub issue number through the requirement's stable issue ids;
  * optionally (--pdf / --text, local only, the source file is not in Git): the PDF SHA-256 and each page's text hash match.
`--write-md` regenerates docs/source/traceability.md from the JSON.
"""
from __future__ import annotations
import argparse, hashlib, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MATRIX = ROOT / "docs/source/page-traceability.json"
REQS = ROOT / "docs/product/requirements.md"
ISSUE_MAP = ROOT / "docs/project/github-issue-map.json"
PAGES = 23


def parse_requirements(text: str) -> dict[str, list[str]]:
    """R01 -> ['00.03', ...] from the register table."""
    out: dict[str, list[str]] = {}
    for line in text.splitlines():
        m = re.match(r"\|\s*(R\d\d)\s*\|[^|]*\|[^|]*\|\s*([0-9. ]+?)\s*\|", line)
        if m:
            out[m.group(1)] = m.group(2).split()
    return out


def issue_numbers(issue_map: dict, ids: list[str]) -> list[int]:
    nums: list[int] = []
    for i in ids:
        v = issue_map.get(i)
        n = v.get("number") if isinstance(v, dict) else v
        if isinstance(n, int):
            nums.append(n)
    return sorted(set(nums))


def check(matrix: dict, reqs: dict[str, list[str]], issue_map: dict, root: pathlib.Path = ROOT) -> list[str]:
    problems: list[str] = []
    entries = matrix.get("entries", [])
    pages = [e.get("page") for e in entries]
    if sorted(pages) != list(range(1, PAGES + 1)):
        problems.append(f"expected pages 1..{PAGES} exactly once, found {sorted(pages)}")
    covered: set[str] = set()
    for e in entries:
        p = e.get("page")
        if not e.get("title", "").strip():
            problems.append(f"page {p}: no title")
        if not e.get("requirements"):
            problems.append(f"page {p}: maps to no requirement")
        if not e.get("documents"):
            problems.append(f"page {p}: maps to no document")
        if not re.fullmatch(r"[0-9a-f]{64}", e.get("textSha256", "")):
            problems.append(f"page {p}: missing text hash")
        for r in e.get("requirements", []):
            covered.add(r)
            if r not in reqs:
                problems.append(f"page {p}: unknown requirement {r}")
        for d in e.get("documents", []):
            if not (root / d).is_file():
                problems.append(f"page {p}: document not found: {d}")
        ids = [i for r in e.get("requirements", []) for i in reqs.get(r, [])]
        if not issue_numbers(issue_map, ids):
            problems.append(f"page {p}: no GitHub issue found for its requirements")
    excused = {x["requirement"] for x in matrix.get("notFromBlueprint", []) if x.get("reason", "").strip()}
    for r in sorted(set(reqs) - covered - excused):
        problems.append(f"requirement {r} is neither covered by a page nor listed under notFromBlueprint with a reason")
    for p in (11,):
        e = next((x for x in entries if x.get("page") == p), None)
        if e is not None and "FICTIONAL" not in e.get("caveat", ""):
            problems.append("page 11 (made-up example record) must carry a FICTIONAL caveat so it can never become a result")
    return problems


def render_md(matrix: dict, reqs: dict[str, list[str]], issue_map: dict) -> str:
    rows = ["# Source blueprint page traceability", "",
            f"Source: `{matrix['source']}` (SHA-256 `{matrix['pdfSha256']}`; the file itself stays outside Git). Generated from `page-traceability.json` by `scripts/check_traceability.py --write-md`; do not edit by hand.", "",
            "| Page | Title | Requirements | Documents | GitHub issues | Caveat |", "|---|---|---|---|---|---|"]
    for e in matrix["entries"]:
        ids = [i for r in e["requirements"] for i in reqs.get(r, [])]
        nums = ", ".join(f"#{n}" for n in issue_numbers(issue_map, ids))
        rows.append(f"| {e['page']} | {e['title']} | {' '.join(e['requirements'])} | {'<br>'.join(e['documents'])} | {nums} | {e.get('caveat', '')} |")
    rows += ["", "Requirements not taken from a blueprint page:", ""]
    rows += [f"- {x['requirement']}: {x['reason']}" for x in matrix.get("notFromBlueprint", [])]
    rows += ["", "Facts are never taken from this matrix: it only says where a page's content is planned, specified and tracked. Boundary, place access, site conditions, historical images and survey findings remain unverified until the research steps in the human-action list are done."]
    return "\n".join(rows) + "\n"


def verify_source(matrix: dict, pdf: pathlib.Path | None, text: pathlib.Path | None) -> list[str]:
    problems: list[str] = []
    if pdf:
        h = hashlib.sha256(pdf.read_bytes()).hexdigest()
        if h != matrix["pdfSha256"]:
            problems.append(f"PDF hash {h} does not match the recorded {matrix['pdfSha256']}")
    if text:
        parts = re.split(r"=== PAGE (\d+) ===\n", text.read_text(encoding="utf8"))
        pages = {int(parts[i]): parts[i + 1] for i in range(1, len(parts), 2)}
        for e in matrix["entries"]:
            h = hashlib.sha256(pages.get(e["page"], "").encode("utf8")).hexdigest()
            if h != e["textSha256"]:
                problems.append(f"page {e['page']}: extracted text no longer matches the recorded hash")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf"); ap.add_argument("--text"); ap.add_argument("--write-md", action="store_true")
    a = ap.parse_args()
    matrix = json.loads(MATRIX.read_text(encoding="utf8"))
    reqs = parse_requirements(REQS.read_text(encoding="utf8"))
    imap = json.loads(ISSUE_MAP.read_text(encoding="utf8"))
    problems = check(matrix, reqs, imap) + verify_source(matrix, pathlib.Path(a.pdf) if a.pdf else None, pathlib.Path(a.text) if a.text else None)
    md = render_md(matrix, reqs, imap)
    out = ROOT / "docs/source/traceability.md"
    if a.write_md:
        out.write_text(md, encoding="utf8")
    elif not out.exists() or out.read_text(encoding="utf8") != md:
        problems.append("docs/source/traceability.md is out of date; run with --write-md")
    if problems:
        print("TRACEABILITY FAILED:")
        for p in problems:
            print(" -", p)
        return 1
    print(f"{len(matrix['entries'])} pages traced; {len(reqs)} requirements checked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
