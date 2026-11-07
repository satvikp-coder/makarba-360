import tempfile
import unittest
from pathlib import Path
from scan_secrets import scan_bundle, scan_repo, scan_text

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


if __name__ == "__main__":
    unittest.main()
