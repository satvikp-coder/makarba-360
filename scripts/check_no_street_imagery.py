"""Fail if third-party street-imagery providers are wired in before approval (issue #70)."""
from __future__ import annotations
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BANNED = re.compile(r"maps\.googleapis\.com|streetviewpixels|google\.maps\.StreetViewPanorama|graph\.mapillary\.com|tiles\.mapillary\.com|GOOGLE_MAPS_API_KEY|MAPILLARY_(?:CLIENT|ACCESS)_TOKEN|mapillary-js", re.I)
SCAN_DIRS = ["apps", "packages", "scripts", ".github", "docker-compose.yml", ".env.example"]
SKIP = {"node_modules", "dist", "test-results", ".git"}
SELF = pathlib.Path(__file__).resolve()

def files():
    for name in SCAN_DIRS:
        p = ROOT / name
        if p.is_file(): yield p
        elif p.is_dir():
            for f in p.rglob("*"):
                if f.is_file() and not (set(f.parts) & SKIP) and f.suffix in {".ts", ".tsx", ".js", ".json", ".yml", ".yaml", ".py", ".env", ".example", ".html", ".css", ""}: yield f

def main() -> int:
    bad = []
    for f in files():
        if f.resolve() == SELF: continue
        try: text = f.read_text(encoding="utf8")
        except (UnicodeDecodeError, OSError): continue
        for m in BANNED.finditer(text): bad.append(f"{f.relative_to(ROOT)}: {m.group(0)}")
    if bad:
        print("Street-imagery provider references found (requires approval, see docs/research/historical-evidence.md #70):")
        print("\n".join(bad)); return 1
    print("no third-party street-imagery provider references"); return 0

if __name__ == "__main__":
    sys.exit(main())
