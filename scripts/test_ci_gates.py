import datetime
import json
import os
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import check_budgets as B  # noqa: E402
import check_ci_policy as P  # noqa: E402
import check_dependency_audit as D  # noqa: E402


class CiPolicy(unittest.TestCase):
    OK = "jobs:\n  node:\n    steps:\n      - run: pnpm test\n  conformance:\n    steps:\n      - run: x\n  browser:\n    steps:\n      - run: y\n  database:\n    steps:\n      - run: z\n"
    PLAN = "jobs:\n  planning:\n    steps:\n      - run: python a.py\n"

    def files(self, ci=None):
        return {"ci.yml": ci or self.OK, "planning.yml": self.PLAN}

    def test_clean_workflows_pass(self):
        self.assertEqual(P.check(self.files()), [])

    def test_real_workflows_pass(self):
        files = {p.name: p.read_text(encoding="utf8") for p in (P.ROOT / ".github/workflows").glob("*.yml")}
        self.assertEqual(P.check(files), [])

    def test_continue_on_error_fails(self):
        out = P.check(self.files(self.OK + "      - run: q\n        continue-on-error: true\n"))
        self.assertTrue(any("continue-on-error" in x for x in out))

    def test_continue_on_error_false_is_fine(self):
        self.assertEqual(P.check(self.files(self.OK + "        continue-on-error: false\n")), [])

    def test_or_true_fails(self):
        for tail in ("|| true", "|| exit 0", "||true"):
            self.assertTrue(P.check(self.files(self.OK + f"      - run: pnpm test {tail}\n")), tail)

    def test_disabled_step_fails(self):
        self.assertTrue(P.check(self.files(self.OK + "      - if: false\n        run: x\n")))

    def test_comments_are_ignored(self):
        self.assertEqual(P.check(self.files(self.OK + "      # continue-on-error: true would be bad\n")), [])

    def test_missing_job_and_workflow_fail(self):
        self.assertTrue(any("'browser' is missing" in x for x in P.check(self.files(self.OK.replace("  browser:", "  other:")))))
        self.assertTrue(any("required workflow missing" in x for x in P.check({"ci.yml": self.OK})))


class Audit(unittest.TestCase):
    RAW = {"advisories": {"1": {"github_advisory_id": "GHSA-aaaa", "module_name": "left-pad", "severity": "high", "title": "t", "findings": [{"paths": ["apps__x>left-pad"]}]}}}
    TODAY = datetime.date(2026, 11, 8)

    def base(self, review="2026-12-31"):
        return {"accepted": [{"id": "GHSA-aaaa", "package": "left-pad", "severity": "high", "owner": "developer-a", "reason": "r", "review_by": review}]}

    def test_known_advisory_passes(self):
        self.assertEqual(D.evaluate(D.parse_audit(self.RAW), self.base(), self.TODAY)[0], [])

    def test_new_advisory_fails(self):
        f, _ = D.evaluate(D.parse_audit(self.RAW), {"accepted": []}, self.TODAY)
        self.assertEqual(len(f), 1)
        self.assertIn("NEW high advisory GHSA-aaaa", f[0])

    def test_expired_entry_fails(self):
        f, _ = D.evaluate(D.parse_audit(self.RAW), self.base("2026-11-01"), self.TODAY)
        self.assertTrue(any("EXPIRED" in x for x in f))

    def test_fixed_advisory_is_a_note_not_a_failure(self):
        f, n = D.evaluate({}, self.base(), self.TODAY)
        self.assertEqual(f, [])
        self.assertTrue(any("no longer reported" in x for x in n))

    def test_incomplete_baseline_entry_fails(self):
        b = self.base()
        del b["accepted"][0]["reason"]
        f, _ = D.evaluate(D.parse_audit(self.RAW), b, self.TODAY)
        self.assertTrue(any("missing 'reason'" in x for x in f))

    def test_committed_baseline_is_complete_and_current(self):
        b = json.loads(D.BASELINE.read_text(encoding="utf8"))
        f, _ = D.evaluate({}, b, self.TODAY)
        self.assertEqual(f, [])


class Budgets(unittest.TestCase):
    def dist(self, files):
        d = pathlib.Path(tempfile.mkdtemp())
        (d / "assets").mkdir()
        for name, data in files.items():
            (d / "assets" / name).write_bytes(data)
        return d

    def full(self, **over):
        base = {"index-a.js": b"a" * 100, "index-a.css": b"c" * 100, "MapView-a.js": b"m" * 100, "maplibre-gl-worker-a.mjs": b"w" * 100, "pannellum-a.js": b"p" * 100, "pannellum-a.css": b"s" * 100,
                "MapView-a.css": b"k" * 100, "Forecasts-a.js": b"f" * 100, "Forecasts-a.css": b"o" * 100}
        base.update(over)
        return base

    def test_small_build_passes(self):
        self.assertEqual(B.check_dist(self.dist(self.full())), [])

    def test_oversized_entry_chunk_fails(self):
        big = os.urandom(200 * 1024)  # incompressible, well over 120 KB gzip
        p = B.check_dist(self.dist(self.full(**{"index-a.js": big})))
        self.assertTrue(any(x.startswith("initial_js") for x in p))

    def test_unknown_asset_fails_so_new_bundles_are_a_decision(self):
        self.assertTrue(any("unclassified" in x for x in B.check_dist(self.dist(self.full(**{"surprise-a.js": b"x"})))))

    def test_missing_category_fails(self):
        f = self.full()
        del f["MapView-a.js"]
        self.assertTrue(any("map_chunk_js" in x for x in B.check_dist(self.dist(f))))

    def test_lazy_pages_are_budgeted_together(self):
        big = bytes(range(256)) * 400   # incompressible, ~100 KB gzip
        p = B.check_dist(self.dist(self.full(**{"Insights-a.js": big})))
        self.assertTrue(any("page_js" in x for x in p), p)
        self.assertFalse(any("unclassified" in x for x in p), p)

    def test_missing_dist_fails(self):
        self.assertTrue(B.check_dist(pathlib.Path(tempfile.mkdtemp()) / "nope"))

    def test_p95(self):
        self.assertEqual(B.p95(list(range(1, 101))), 96)


if __name__ == "__main__":
    unittest.main()
