"""Prove the tests are meaningful: deliberately change a boundary rule and require the tests to FAIL.

Each mutation edits a source file in place, runs the package tests, then restores the original bytes
(also on error). A mutation that leaves the tests green means the tests do not guard that rule.
Usage: python scripts/mutation_check.py [--list]
"""
from __future__ import annotations
import pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "packages/contracts/src/index.ts"
ANALYTICS = ROOT / "packages/analytics/src/index.ts"

# (package, file, original, mutated, description)
MUTATIONS = [
    ("@makarba/contracts", CONTRACTS, "if (n < 5) bad(", "if (n < 4) bad(", "k threshold lowered from 5 to 4"),
    ("@makarba/contracts", CONTRACTS, "if (v + m + u > n)", "if (v + m + u > n + 1)", "denominator allowed to exceed base"),
    ("@makarba/contracts", CONTRACTS, 'if ([c.n, c.validAnswerN, c.missingN, c.unsureN].some((v) => v !== null))', 'if (false)', "suppressed counts allowed to leak"),
    ("@makarba/contracts", CONTRACTS, "if (n === null || v === null || m === null || u === null) return bad(", "if (false) return bad(", "null counts tolerated"),
    ("@makarba/analytics", ANALYTICS, "export const K = 5;", "export const K = 4;", "analytics k threshold lowered from 5 to 4"),
    ("@makarba/analytics", ANALYTICS, "if (hidden.length === 1) {", "if (false) {", "complementary suppression disabled"),
    ("@makarba/analytics", ANALYTICS, 'if (i.withdrawn) bump("withdrawn");', 'if (false) bump("withdrawn");', "withdrawn interviews counted"),
    ("@makarba/analytics", ANALYTICS, "const topics = i.topics.filter((t) => t.subjectId === subjectId);", "const topics = i.topics.filter(() => true);", "ratings no longer limited to the place discussed"),
]

def run(pkg: str) -> int:
    return subprocess.run(["pnpm", "--filter", pkg, "test"], cwd=ROOT, capture_output=True, text=True, encoding="utf8", errors="replace", shell=sys.platform == "win32").returncode

def main() -> int:
    if "--list" in sys.argv:
        for _, f, _, _, d in MUTATIONS: print(f"{f.name}: {d}")
        return 0
    for base in ("@makarba/contracts", "@makarba/analytics"):
        if run(base) != 0:
            print(f"baseline tests of {base} must pass before mutation checking"); return 2
    survived = []
    for pkg, f, orig, mut, desc in MUTATIONS:
        data = f.read_bytes(); text = data.decode("utf8")
        if text.count(orig) != 1:
            print(f"MUTATION NOT APPLICABLE (source changed?): {desc}"); survived.append(desc); continue
        try:
            f.write_bytes(text.replace(orig, mut).encode("utf8"))
            rc = run(pkg)
        finally:
            f.write_bytes(data)
        print(f"{'killed  ' if rc != 0 else 'SURVIVED'}  {desc}")
        if rc == 0: survived.append(desc)
    if survived:
        print(f"\n{len(survived)} mutation(s) not caught by tests"); return 1
    print(f"\nall {len(MUTATIONS)} mutations were caught by the tests"); return 0

if __name__ == "__main__":
    sys.exit(main())
