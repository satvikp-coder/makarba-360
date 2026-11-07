"""Secret scanner for the repository and for browser bundles (issue #40).

  python scripts/scan_secrets.py                # scan git-tracked files
  python scripts/scan_secrets.py --bundle DIR [--value-env NAME ...]
        # scan a built browser bundle: no server-only names, patterns or env values
"""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER_ONLY_NAMES = ("DATABASE_URL", "SESSION_SECRET", "POSTGRES_PASSWORD")
PLACEHOLDER = re.compile(r"replace-with|changeme|change-me|example|placeholder|makarba_dev|your[-_]|<[^>]+>|\$\{?\w+", re.I)
PATTERNS = {
    "private key block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----"),
    "AWS access key id": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    "credentialed database URL": re.compile(r"postgres(?:ql)?://[^:/\s]+:([^@\s]+)@(?!localhost|127\.0\.0\.1|db[:/])", re.I),
    "hard-coded secret assignment": re.compile(r"(?:SECRET|TOKEN|PASSWORD|API_KEY)\w*\s*[=:]\s*['\"]?([A-Za-z0-9/+_\-]{24,})"),
}
SKIP_PARTS = ("node_modules/", "pnpm-lock.yaml")


def is_exempt(rel):
    # Tests intentionally contain fake credentials to prove rejection paths.
    return rel.endswith((".test.ts", "scan_secrets.py")) or "/test_" in "/" + rel or rel.startswith("scripts/test_")


def scan_text(name, text):
    out = []
    for kind, rx in PATTERNS.items():
        for m in rx.finditer(text):
            value = m.group(1) if m.groups() else m.group(0)
            if PLACEHOLDER.search(m.group(0)) or PLACEHOLDER.search(value):
                continue
            line = text.count("\n", 0, m.start()) + 1
            out.append(f"{name}:{line}: {kind}")  # never print the matched value
    return out


def scan_repo():
    files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split("\n")
    out = []
    for rel in filter(None, files):
        if is_exempt(rel) or any(s in rel for s in SKIP_PARTS):
            continue
        try:
            out += scan_text(rel, (ROOT / rel).read_text(encoding="utf-8"))
        except (UnicodeDecodeError, OSError):
            continue
    return out


def scan_bundle(directory, secret_values=()):
    out = []
    for p in Path(directory).rglob("*"):
        if not p.is_file():
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for n in SERVER_ONLY_NAMES:
            if n in text:
                out.append(f"{p}: server-only variable name {n} present in browser bundle")
        for v in secret_values:
            if v and len(v) >= 8 and v in text:
                out.append(f"{p}: a server secret value is present in browser bundle")
        out += scan_text(str(p), text)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle")
    ap.add_argument("--value-env", nargs="*", default=[])
    a = ap.parse_args(argv)
    if a.bundle:
        if not Path(a.bundle).exists():
            print(f"no bundle at {a.bundle}; nothing to scan")
            return 0
        findings = scan_bundle(a.bundle, [os.environ.get(n, "") for n in a.value_env])
    else:
        findings = scan_repo()
    print("\n".join(findings) or "secret scan passed")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
