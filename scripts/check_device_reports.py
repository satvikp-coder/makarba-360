"""Acceptance checker for real-device offline-probe reports (issue #54; also useful for #117).

Usage: python scripts/check_device_reports.py report1.json report2.json ...
Exit 0 only if at least one genuine Android report AND one genuine iOS report each pass every rule. A desktop or headless browser
report is never accepted as device evidence. The checker cannot know a person really held the phone; it checks the report is consistent
with a real phone run done as documented in tools/offline-probe/README.md, and a human still reads the notes.
"""
from __future__ import annotations
import json, pathlib, re, sys

REQUIRED_PASS = ["features", "idb", "vault", "keystore", "recovery"]
MIN_NOTES = 60


def platform_of(ua: str) -> str | None:
    if re.search(r"Headless", ua, re.I) or re.search(r"Windows NT|Macintosh|X11; Linux x86_64(?!.*Android)", ua) and not re.search(r"Android|iPhone|iPad", ua):
        return None
    if re.search(r"Android", ua) and re.search(r"Chrome|Firefox|SamsungBrowser|EdgA", ua):
        return "android"
    if re.search(r"iPhone|iPad", ua) and re.search(r"Safari|CriOS|FxiOS", ua):
        return "ios"
    return None


def check_report(r: dict) -> tuple[str | None, list[str]]:
    """Returns (platform, problems)."""
    p: list[str] = []
    if r.get("probe") != "makarba-offline-probe" or r.get("version") != 1:
        return None, ["not an offline-probe report"]
    plat = platform_of(str(r.get("userAgent", "")))
    if plat is None:
        p.append("user agent is not a real Android or iOS phone browser (desktop and headless runs are not device evidence)")
    if r.get("syntheticDataOnly") is not True:
        p.append("report does not state synthetic data only")
    if r.get("isSecureContext") is not True:
        p.append("page was not a secure context")
    results = {x.get("id"): x for x in r.get("results", []) if isinstance(x, dict)}
    for rid in REQUIRED_PASS:
        st = results.get(rid, {}).get("status")
        if st != "pass":
            hint = {"keystore": " (run again after reloading the page)", "recovery": " (run again after killing and reopening the browser)"}.get(rid, "")
            p.append(f"check '{rid}' is '{st}', expected 'pass'{hint}")
    fails = [k for k, v in results.items() if v.get("status") == "fail"]
    if fails:
        p.append("failed checks: " + ", ".join(fails))
    notes = str(r.get("notes", "")).strip()
    if len(notes) < MIN_NOTES:
        p.append(f"notes are too short (<{MIN_NOTES} characters): record device model, OS and browser version, how the app was killed")
    if not re.search(r"airplane|aeroplane|flight mode|offline", notes, re.I):
        p.append("notes do not record the airplane-mode / offline reload step")
    if not re.search(r"\d", notes):
        p.append("notes do not contain any version number")
    return plat, p


def main(paths: list[str]) -> int:
    ok: dict[str, list[str]] = {"android": [], "ios": []}
    for path in paths:
        try:
            r = json.loads(pathlib.Path(path).read_text(encoding="utf8"))
        except (OSError, json.JSONDecodeError) as e:
            print(f"REJECT {path}: unreadable ({e})")
            continue
        plat, problems = check_report(r)
        if problems:
            print(f"REJECT {path}" + (f" [{plat}]" if plat else ""))
            for x in problems:
                print("   -", x)
        else:
            print(f"ACCEPT {path} [{plat}]")
            ok[plat or ""].append(path)
    missing = [k for k, v in ok.items() if not v]
    if missing:
        print("NOT ENOUGH EVIDENCE: no accepted report for: " + ", ".join(missing))
        return 1
    print("ACCEPTED: at least one Android and one iOS report pass. A human still reads the notes before closing issue #54.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1:]))
