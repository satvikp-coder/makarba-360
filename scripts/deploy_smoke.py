"""Deployment smoke test for the public tier (issue #124). Provider-neutral: give it the public address of any environment.

Usage: python scripts/deploy_smoke.py <base-url> [--expect-https] [--no-api]
Checks: the app and a deep link load, required security headers match deploy/headers.json, HTML is not cached, source maps and
server version are not exposed, and (unless --no-api) the public API answers read-only, cookie-free, with a plain 404 for an
unknown place. It proves nothing about the database or about data correctness: run the API conformance suite for that.
"""
from __future__ import annotations
import argparse, json, pathlib, re, ssl, sys, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
HEADERS = json.loads((ROOT / "deploy/headers.json").read_text(encoding="utf8"))


def fetch(url: str, method: str = "GET", timeout: float = 10.0):
    req = urllib.request.Request(url, method=method, headers={"Accept": "*/*"})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()


def check(base: str, expect_https: bool = False, api: bool = True) -> list[str]:
    base = base.rstrip("/")
    out: list[str] = []
    if expect_https and not base.startswith("https://"):
        out.append("address is not https:// but --expect-https was given")
    try:
        st, h, body = fetch(base + "/")
    except Exception as e:  # noqa: BLE001
        return [f"cannot reach {base}/: {e}"]
    if st != 200 or b"<div id=\"root\"" not in body and b"id=\"root\"" not in body:
        out.append(f"/ did not return the app shell (status {st})")
    for name, want in HEADERS["headers"].items():
        if h.get(name) != want:
            out.append(f"header {name} is {h.get(name)!r}, expected the value in deploy/headers.json")
    if base.startswith("https://") or expect_https:
        for name, want in HEADERS["httpsOnly"].items():
            if h.get(name) != want:
                out.append(f"header {name} missing or different over HTTPS")
    if "no-store" not in (h.get("Cache-Control") or ""):
        out.append("HTML is cacheable: Cache-Control must contain no-store (withdrawn content must disappear)")
    if re.search(r"\d", h.get("Server") or ""):
        out.append(f"Server header discloses a version: {h.get('Server')}")
    st2, _, b2 = fetch(base + "/explore")
    if st2 != 200 or b"id=\"root\"" not in b2:
        out.append("deep link /explore does not fall back to the app")
    m = re.search(rb'/assets/[^"\']+\.js', body)
    if m:
        st3, _, _ = fetch(base + m.group(0).decode() + ".map")
        if st3 == 200:
            out.append("a source map is publicly served")
    if api:
        st4, h4, b4 = fetch(base + "/api/v1/public/locations?limit=1")
        if st4 != 200:
            out.append(f"public API /locations answered {st4}")
        else:
            if h4.get("Set-Cookie"):
                out.append("public API sets a cookie")
            if "no-store" not in (h4.get("Cache-Control") or ""):
                out.append("public API response is cacheable")
            if re.search(rb"interview(latitude|longitude)|researcherid|rawanswers", b4, re.I):
                out.append("public API response contains a private field name")
        st5, _, _ = fetch(base + "/api/v1/public/locations/definitely-not-published/history")
        if st5 != 404:
            out.append(f"unknown place answered {st5}, expected 404")
        st6, _, _ = fetch(base + "/api/v1/public/locations", method="POST")
        if not (400 <= st6 < 500):
            out.append(f"POST to the public API answered {st6}, expected a 4xx")
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base"); ap.add_argument("--expect-https", action="store_true"); ap.add_argument("--no-api", action="store_true")
    a = ap.parse_args()
    problems = check(a.base, a.expect_https, not a.no_api)
    if problems:
        print("SMOKE TEST FAILED:")
        for p in problems:
            print(" -", p)
        return 1
    print(f"smoke test passed for {a.base}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
