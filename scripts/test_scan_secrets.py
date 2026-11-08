import tempfile
import unittest
from pathlib import Path
import os
from unittest import mock
from scan_secrets import main, scan_bundle, scan_log, scan_repo, scan_text

KEY = "-----BEGIN " + "RSA PRIVATE KEY-----"
AWS = "AKIA" + "ABCDEFGHIJKLMNOP"


class ScanSecrets(unittest.TestCase):
    def test_repository_is_clean(self):
        self.assertEqual(scan_repo(), [])

    def test_detects_real_looking_secrets_without_printing_them(self):
        for text in (KEY, AWS, "postgres://svc:Kq83nd02xZpLmm@db.prod.corp.net/app",
                     "SESSION_SECRET=Zx9qL2vB7kT4mN8pR1wY5cD3hG6jF0sA"):
            f = scan_text("f", text)
            self.assertTrue(f, text)
            self.assertNotIn("Kq83nd02xZpLmm", "".join(f))

    def test_placeholders_and_local_urls_allowed(self):
        self.assertEqual(scan_text("f", "SESSION_SECRET=replace-with-a-random-string-of-at-least-32-characters"), [])
        self.assertEqual(scan_text("f", "postgres://u:p@localhost:5432/d"), [])

    def test_bundle_with_server_secret_fails(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "app.js").write_text('const x="Zx9qL2vB7kT4mN8pR1wY5cD3";', encoding="utf-8")
            self.assertTrue(scan_bundle(d, ["Zx9qL2vB7kT4mN8pR1wY5cD3"]))
            (Path(d) / "b.js").write_text("process.env.SESSION_SECRET", encoding="utf-8")
            self.assertTrue(any("SESSION_SECRET" in f for f in scan_bundle(d)))

    def test_clean_bundle_passes(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "app.js").write_text("console.log('hello')", encoding="utf-8")
            self.assertEqual(scan_bundle(d, ["Zx9qL2vB7kT4mN8pR1wY5cD3"]), [])

    def test_log_with_secret_value_or_pattern_fails_and_clean_log_passes(self):
        with tempfile.TemporaryDirectory() as d:
            log = Path(d) / "ci.log"
            log.write_text("building... connecting Zx9qL2vB7kT4mN8pR1wY5cD3", encoding="utf-8")
            self.assertTrue(scan_log(log, ["Zx9qL2vB7kT4mN8pR1wY5cD3"]))
            log.write_text("building... done", encoding="utf-8")
            self.assertEqual(scan_log(log, ["Zx9qL2vB7kT4mN8pR1wY5cD3"]), [])
            log.write_text("token " + AWS, encoding="utf-8")
            self.assertTrue(scan_log(log))

    def test_value_check_refuses_to_run_silently_when_the_canary_is_unset(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CANARY_SECRET_X", None)
            self.assertEqual(main(["--bundle", d, "--value-env", "CANARY_SECRET_X"]), 1)
            os.environ["CANARY_SECRET_X"] = "Zx9qL2vB7kT4mN8pR1wY5cD3"
            self.assertEqual(main(["--bundle", d, "--value-env", "CANARY_SECRET_X"]), 0)
            (Path(d) / "a.js").write_text("x='Zx9qL2vB7kT4mN8pR1wY5cD3'", encoding="utf-8")
            self.assertEqual(main(["--bundle", d, "--value-env", "CANARY_SECRET_X"]), 1)

    def test_new_server_only_names_are_flagged_in_bundles(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "a.js").write_text("OIDC_CLIENT_SECRET", encoding="utf-8")
            self.assertTrue(scan_bundle(d))


if __name__ == "__main__":
    unittest.main()
