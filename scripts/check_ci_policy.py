"""CI policy check (issue #115): no check may be silently non-blocking, and the expected jobs must exist.

Fails on `continue-on-error`, `|| true` / `|| exit 0` in run steps, `if: false` / `if: ${{ false }}`, and on a missing required job.
Prints the job names that should be set as required status checks in branch protection (a repository-owner setting).
Usage: python scripts/check_ci_policy.py [workflow.yml ...]
"""
from __future__ import annotations
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
REQUIRED_JOBS = {"ci.yml": ["node", "conformance", "browser", "database"], "planning.yml": ["planning"]}
BAD = [
    (re.compile(r"^\s*continue-on-error\s*:\s*(?!false\b)\S", re.I), "continue-on-error makes a failure non-blocking"),
    (re.compile(r"\|\|\s*(true|exit\s+0|:)\s*(#.*)?$"), "'|| true' hides a failing command"),
    (re.compile(r"^\s*(-\s*)?if\s*:\s*(\$\{\{\s*)?false\b", re.I), "a step or job is permanently disabled with 'if: false'"),
]


def problems_in(text: str, name: str) -> list[str]:
    out: list[str] = []
    for i, line in enumerate(text.splitlines(), 1):
        if line.lstrip().startswith("#"):
            continue
        for rx, why in BAD:
            if rx.search(line):
                out.append(f"{name}:{i}: {why}: {line.strip()}")
    return out


def jobs_in(text: str) -> set[str]:
    m = re.search(r"^jobs:\s*\n((?:[ \t]+.*\n?|\n)*)", text, re.M)
    return set(re.findall(r"^  ([A-Za-z0-9_-]+):\s*$", m.group(1), re.M)) if m else set()


def check(files: dict[str, str], required: dict[str, list[str]] = REQUIRED_JOBS) -> list[str]:
    out: list[str] = []
    for name, text in files.items():
        out += problems_in(text, name)
    for name, jobs in required.items():
        if name not in files:
            out.append(f"{name}: required workflow missing")
            continue
        have = jobs_in(files[name])
        out += [f"{name}: required job '{j}' is missing" for j in jobs if j not in have]
    return out


def main() -> int:
    paths = [pathlib.Path(a) for a in sys.argv[1:]] or sorted((ROOT / ".github/workflows").glob("*.yml"))
    files = {p.name: p.read_text(encoding="utf8") for p in paths}
    out = check(files)
    print("jobs to require in branch protection:", ", ".join(f"{n.removesuffix('.yml')}/{j}" for n, js in REQUIRED_JOBS.items() for j in js))
    if out:
        print("CI POLICY FAILED:")
        for o in out:
            print(" -", o)
        return 1
    print("no non-blocking checks; all required jobs present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
