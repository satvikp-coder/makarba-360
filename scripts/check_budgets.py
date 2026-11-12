"""Performance budgets for the public site and the synthetic API (issue #115).

Budgets are PROPOSED defaults (gzip sizes of the production build) and need team agreement; see docs/project/test-strategy.md.
Usage:
  python scripts/check_budgets.py --dist apps/web/dist [--fixture docs/project/contracts/fixture-bundle.json] [--api http://127.0.0.1:4010]
"""
from __future__ import annotations
import argparse, gzip, json, pathlib, re, sys, time, urllib.request, concurrent.futures

BUDGET_KB = {            # gzip kilobytes
    "initial_js": 120,    # the entry chunk every visitor downloads (home page)
    "map_chunk_js": 340,  # loaded only on the explorer
    "map_worker": 170,
    "css": 15,
    "panorama_js": 25,    # loaded only when a visitor asks for the 360 view
    "panorama_css": 5,
    # Added with the v2 dashboard (2026-11-12): splitting work OUT of the entry bundle creates these chunks; each is fetched only
    # when its page is opened, and together they are still budgeted. The entry budgets above did not change.
    "map_css": 15,        # MapLibre's stylesheet plus map chrome, loaded with the explorer (was previously inside "css")
    "page_js": 60,        # lazily loaded pages, summed: Outlook, Insights, Voices, place profile, panorama page, Then & Now, research
    "page_css": 5,        # Outlook-only styles
}
FIXTURE_MAX_KB = 200
API_P95_MS = 300
API_REQUESTS = 120

def gz_kb(path: pathlib.Path) -> float:
    return len(gzip.compress(path.read_bytes(), 9)) / 1024

def classify(name: str) -> str | None:
    if re.match(r"MapView-.*\.js$", name): return "map_chunk_js"
    if re.match(r"maplibre-gl-worker-.*\.mjs$", name): return "map_worker"
    if re.match(r"pannellum-.*\.js$", name): return "panorama_js"
    if re.match(r"pannellum-.*\.css$", name): return "panorama_css"
    if re.match(r"MapView-.*\.css$", name): return "map_css"
    if re.match(r"(Forecasts|Insights|Voices|Profile|Panorama|PanoramaPage|ThenNowPage|ThenNowView|ResearchPages|ComparisonIndex)-.*\.js$", name): return "page_js"
    if re.match(r"(Forecasts|Insights|Voices|Profile|ThenNowPage|ResearchPages|ComparisonIndex)-.*\.css$", name): return "page_css"
    if re.match(r"index-.*\.js$", name): return "initial_js"
    if re.match(r"index-.*\.css$", name): return "css"
    return None

def check_dist(dist: pathlib.Path, budget: dict[str, float] = BUDGET_KB) -> list[str]:
    assets = dist / "assets"
    if not assets.is_dir():
        return [f"{assets} not found; run the production build first"]
    seen: dict[str, float] = {}
    problems: list[str] = []
    for f in sorted(assets.iterdir()):
        kind = classify(f.name)
        if kind is None:
            problems.append(f"unclassified asset {f.name}: add it to a budget category")   # a new unbudgeted bundle must be a conscious decision
            continue
        seen[kind] = seen.get(kind, 0) + gz_kb(f)
    for kind, limit in budget.items():
        if kind not in seen:
            problems.append(f"expected asset category missing: {kind}")
        elif seen[kind] > limit:
            problems.append(f"{kind}: {seen[kind]:.1f} KB gzip exceeds budget {limit} KB")
    for kind, size in sorted(seen.items()):
        print(f"  {kind:14} {size:7.1f} KB gzip (budget {budget.get(kind, '-')})")
    return problems

def check_fixture(path: pathlib.Path) -> list[str]:
    kb = path.stat().st_size / 1024
    print(f"  fixture bundle  {kb:7.1f} KB (budget {FIXTURE_MAX_KB})")
    return [f"fixture bundle {kb:.0f} KB exceeds {FIXTURE_MAX_KB} KB"] if kb > FIXTURE_MAX_KB else []

def p95(values: list[float]) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(0.95 * len(s)))]

def check_api(base: str, requests: int = API_REQUESTS) -> list[str]:
    urls = [f"{base}/api/v1/public/{p}" for p in ("locations", "insights", "locations/junction-fruit-carts/history", "media/synthetic-media-1")]
    def one(i: int) -> float:
        t = time.perf_counter()
        with urllib.request.urlopen(urls[i % len(urls)], timeout=10) as r:
            r.read()
        return (time.perf_counter() - t) * 1000
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        times = list(ex.map(one, range(requests)))
    v = p95(times)
    print(f"  mock API p95    {v:7.1f} ms over {requests} requests, 8 at a time (budget {API_P95_MS})")
    return [f"mock API p95 {v:.0f} ms exceeds {API_P95_MS} ms"] if v > API_P95_MS else []

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist"); ap.add_argument("--fixture"); ap.add_argument("--api")
    a = ap.parse_args()
    problems: list[str] = []
    if a.dist: problems += check_dist(pathlib.Path(a.dist))
    if a.fixture: problems += check_fixture(pathlib.Path(a.fixture))
    if a.api: problems += check_api(a.api)
    if not (a.dist or a.fixture or a.api):
        print("nothing to check"); return 2
    if problems:
        print("BUDGET FAILURES:"); [print(" -", p) for p in problems]; return 1
    print("all budgets met"); return 0

if __name__ == "__main__":
    sys.exit(main())
