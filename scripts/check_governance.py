"""Fail if governance docs invent a licence or a contact address (issue #1)."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ["README.md", "CONTRIBUTING.md", "SECURITY.md", "AGENTS.md",
        "docs/project/governance.md"]
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
LICENCE = re.compile(
    r"(licen[sc]ed under|SPDX-License-Identifier|\b(MIT|Apache-2\.0|GPL-?\d?|BSD-\d-Clause)\s+licen[sc]e)",
    re.I)


def check_text(name, text):
    problems = []
    for line in text.splitlines():
        if EMAIL.search(line):
            problems.append(f"{name}: contact address invented: {line.strip()[:80]}")
        if LICENCE.search(line) and not re.search(r"\b(no|not|none|until)\b", line, re.I):
            problems.append(f"{name}: licence declared: {line.strip()[:80]}")
    return problems


def main():
    problems = []
    for rel in DOCS:
        problems += check_text(rel, (ROOT / rel).read_text(encoding="utf-8"))
    if not (ROOT / "docs/project/governance.md").exists():
        problems.append("governance.md missing")
    if (ROOT / "LICENSE").exists() or (ROOT / "LICENSE.md").exists():
        problems.append("LICENSE file present but no licence decision recorded")
    print("\n".join(problems) or "governance check passed")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
