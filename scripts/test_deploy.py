import copy
import json
import pathlib
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import check_deploy_config as C  # noqa: E402
import deploy_smoke as S  # noqa: E402

SHELL = b'<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/index-abc.js"></script></body></html>'


def make_server(mod=None):
    mod = mod or {}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def version_string(self):
            return mod.get("server", "nginx")

        def date_time_string(self, timestamp=None):
            return super().date_time_string(timestamp)

        def send(self, status, body=b"{}", ctype="application/json", extra=None):
            self.send_response(status)
            hdrs = {} if mod.get("no_headers") else dict(S.HEADERS["headers"])
            hdrs["Content-Type"] = ctype
            hdrs["Cache-Control"] = mod.get("cache", "no-store")
            hdrs.update(extra or {})
            for k, v in hdrs.items():
                self.send_header(k, v)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            p = self.path.split("?")[0]
            if p == "/assets/index-abc.js.map":
                return self.send(200 if mod.get("map") else 404, b"{}", "application/json")
            if p.startswith("/api/v1/public/locations/") and p.endswith("/history"):
                return self.send(404)
            if p == "/api/v1/public/locations":
                body = b'{"interviewLatitude":1}' if mod.get("leak") else b'{"features":[]}'
                return self.send(200, body, extra={"Set-Cookie": "a=b"} if mod.get("cookie") else None)
            return self.send(200, SHELL, "text/html")

        def do_POST(self):
            return self.send(405 if not mod.get("post_ok") else 200)

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


class Smoke(unittest.TestCase):
    def run_with(self, mod=None, **kw):
        srv, base = make_server(mod)
        try:
            return S.check(base, **kw)
        finally:
            srv.shutdown()

    def test_correct_site_passes(self):
        self.assertEqual(self.run_with(), [])

    def test_missing_headers_are_reported_by_name(self):
        out = self.run_with({"no_headers": True})
        for name in S.HEADERS["headers"]:
            self.assertTrue(any(name in x for x in out), name)

    def test_cacheable_html_version_leak_source_map_cookie_private_field_and_open_post_fail(self):
        for mod, text in [({"cache": "public, max-age=600"}, "cacheable"), ({"server": "nginx/1.27.0"}, "version"), ({"map": True}, "source map"),
                          ({"cookie": True}, "cookie"), ({"leak": True}, "private field"), ({"post_ok": True}, "POST")]:
            self.assertTrue(any(text in x for x in self.run_with(mod)), text)

    def test_https_expectation_on_plain_http_fails(self):
        self.assertTrue(any("not https" in x for x in self.run_with(expect_https=True)))

    def test_unreachable_site_is_a_failure_not_a_pass(self):
        self.assertTrue(S.check("http://127.0.0.1:1")[0].startswith("cannot reach"))

    def test_api_checks_can_be_skipped_for_a_static_only_environment(self):
        self.assertEqual(self.run_with(api=False), [])


class DeployConfig(unittest.TestCase):
    def files(self):
        names = ["deploy/Dockerfile.web", "deploy/Dockerfile.api", "deploy/nginx.conf", "deploy/rollback.sh", "deploy/README.md"]
        return {n: (C.ROOT / n).read_text(encoding="utf8") for n in names}

    headers = json.loads((C.ROOT / "deploy/headers.json").read_text(encoding="utf8"))

    def test_committed_files_pass(self):
        self.assertEqual(C.check(self.files(), self.headers), [])

    def test_credentials_unpinned_images_root_and_header_drift_are_caught(self):
        f = self.files(); f["deploy/nginx.conf"] += "\n# DATABASE postgres://admin:hunter22@db/prod\n"
        self.assertTrue(any("credential" in x for x in C.check(f, self.headers)))
        f = self.files(); f["deploy/Dockerfile.api"] = f["deploy/Dockerfile.api"].replace("node:22.11-alpine", "node:latest")
        self.assertTrue(any("not pinned" in x for x in C.check(f, self.headers)))
        f = self.files(); f["deploy/Dockerfile.api"] = f["deploy/Dockerfile.api"].replace("USER node", "")
        self.assertTrue(any("non-root" in x for x in C.check(f, self.headers)))
        h = copy.deepcopy(self.headers); h["headers"]["Referrer-Policy"] = "origin"
        self.assertTrue(any("Referrer-Policy" in x for x in C.check(self.files(), h)))
        f = self.files(); f["deploy/nginx.conf"] = f["deploy/nginx.conf"].replace("server_tokens off", "")
        self.assertTrue(any("server version" in x for x in C.check(f, self.headers)))
        f = self.files(); f["deploy/Dockerfile.web"] = f["deploy/Dockerfile.web"].replace("scan_secrets.py --bundle", "true")
        self.assertTrue(any("secret scan" in x for x in C.check(f, self.headers)))

    def test_rollback_template_must_not_pretend_to_know_a_provider(self):
        f = self.files(); f["deploy/rollback.sh"] = "echo done"
        self.assertTrue(any("TODO(platform)" in x for x in C.check(f, self.headers)))


if __name__ == "__main__":
    unittest.main()
