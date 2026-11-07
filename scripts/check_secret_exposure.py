"""Fail on secret-exposure mistakes in the dev scaffold (issue #10)."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER_ONLY = ("DATABASE_URL", "SESSION_SECRET", "POSTGRES_PASSWORD", "POSTGRES_USER")
BROWSER_PREFIX = re.compile(r"^(VITE_|PUBLIC_|NEXT_PUBLIC_)", re.M)


def env_example_problems(text):
    errs = []
    for line in text.splitlines():
        name = line.split("=", 1)[0].strip()
        if BROWSER_PREFIX.match(name) and any(s in name for s in ("SECRET", "PASSWORD", "DATABASE", "TOKEN", "KEY")):
            errs.append(f"secret-like variable exposed to browser bundle: {name}")
        if name in SERVER_ONLY and BROWSER_PREFIX.match(name):
            errs.append(f"server-only variable has browser prefix: {name}")
        if name == "SESSION_SECRET" and not line.split("=", 1)[1].startswith("replace-with"):
            errs.append("SESSION_SECRET example must be an obvious placeholder")
    return errs


def tracked_env_problems(tracked):
    return [f"tracked secret file: {f}" for f in tracked if re.search(r"(^|/)\.env($|\.(?!example))", f)]


def main():
    errs = env_example_problems((ROOT / ".env.example").read_text(encoding="utf-8"))
    tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    errs += tracked_env_problems(tracked)
    if ".env" not in (ROOT / ".gitignore").read_text(encoding="utf-8"):
        errs.append(".env is not git-ignored")
    print("\n".join(errs) or "secret exposure check passed")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
