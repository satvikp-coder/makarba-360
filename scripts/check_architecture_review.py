"""Verify architecture review evidence for issue #9 (documents only, no network)."""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REVIEW = "docs/architecture/review-baseline.md"
FIXTURE = "docs/project/contracts/fixture-bundle.json"
ARCH = ["overview", "system-context", "component-diagram", "deployment", "data-model", "gis-design",
        "offline-sync", "media-pipeline", "analytics", "privacy-security", "api-design"]
# provider -> must be qualified on the same line wherever it appears
PROVIDERS = ["google", "street view", "marzipano", "odk", "kobo", "redis", "kafka"]
QUALIFIER = re.compile(r"optional|disabled|alternative|fallback|after approval|not promised|avoid|"
                       r"default|no |not |only|without|universal|complex|feasib|\bor\b", re.I)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def unqualified_provider_lines(name, text):
    out = []
    for line in text.splitlines():
        low = line.lower()
        if any(p in low for p in PROVIDERS) and not QUALIFIER.search(line):
            out.append(f"{name}: provider mentioned without optional/disabled qualifier: {line.strip()[:80]}")
    return out


def review_problems(review, fixture_bytes, existing_paths):
    errs = []
    for h in ("Provisional authorisation assumptions", "Boundary review", "Interface ownership",
              "Optional-provider register", "Findings", "H0 contract freeze"):
        if h not in review:
            errs.append(f"review missing section: {h}")
    for b in ("Context", "Components", "Deployment", "Trust: device", "Trust: identity",
              "Trust: database", "Trust: object storage", "Trust: third parties"):
        if f"| {b}" not in review:
            errs.append(f"boundary not reviewed: {b}")
    rows = re.findall(r"^\| (C0\d [^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|$", review, re.M)
    if len(rows) < 6:
        errs.append("interface table must cover C01-C06")
    for name, prod, cons, contract in rows:
        if not (prod.strip() and cons.strip() and contract.strip()):
            errs.append(f"{name.strip()}: missing producer/consumer/contract")
        m = re.search(r"`(docs/[^`#]+)", contract)
        if m and m.group(1) not in existing_paths:
            errs.append(f"{name.strip()}: contract file missing {m.group(1)}")
    reg = review.split("Optional-provider register")[-1].split("## Findings")[0].lower()
    for p in ("street view", "marzipano", "odk", "redis"):
        if p not in reg:
            errs.append(f"provider register omits {p}")
    if "approved by" in review.lower() and "pending" not in review.lower():
        errs.append("review claims approval")
    if "independent human review pending" not in review.lower():
        errs.append("review must state human review status honestly")
    m = re.search(r"sha256: `([0-9a-f]{64})`", review)
    actual = hashlib.sha256(fixture_bytes.replace(b"\r\n", b"\n")).hexdigest()
    if not m or m.group(1) != actual:
        errs.append("fixture bundle hash does not match frozen H0 hash")
    if EMAIL.search(review):
        errs.append("review contains an email address")
    return errs


def main():
    review = (ROOT / REVIEW).read_text(encoding="utf-8")
    existing = {p.relative_to(ROOT).as_posix() for p in (ROOT / "docs").rglob("*.md")}
    errs = review_problems(review, (ROOT / FIXTURE).read_bytes(), existing)
    for n in ARCH:
        errs += unqualified_provider_lines(n, (ROOT / f"docs/architecture/{n}.md").read_text(encoding="utf-8"))
    for p in (ROOT / "docs/architecture/adr").glob("*.md"):
        errs += unqualified_provider_lines(p.name, p.read_text(encoding="utf-8"))
    print("\n".join(errs) or "architecture review evidence valid")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
