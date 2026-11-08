"""Static checks of the deployment files (issue #124): no secrets, pinned images, non-root, health checks, header parity.
Usage: python scripts/check_deploy_config.py
"""
from __future__ import annotations
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SECRET = re.compile(r"(postgres(ql)?://[^\s:@]+:[^\s@]+@|SESSION_SECRET\s*=\s*\S{8,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|password\s*[:=]\s*\S{6,})", re.I)


def check(files: dict[str, str], headers: dict) -> list[str]:
    p: list[str] = []
    for name, text in files.items():
        if SECRET.search(text):
            p.append(f"{name}: looks like it contains a credential; secrets come from the platform secret store at run time")
    for name in ("deploy/Dockerfile.web", "deploy/Dockerfile.api"):
        t = files.get(name, "")
        if not t:
            p.append(f"{name} is missing"); continue
        for img in re.findall(r"^FROM\s+(\S+)", t, re.M):
            if img.endswith(":latest") or ":" not in img and " AS " not in img and img != "scratch":
                p.append(f"{name}: image '{img}' is not pinned to a version")
        if "HEALTHCHECK" not in t:
            p.append(f"{name}: no HEALTHCHECK")
    if "USER node" not in files.get("deploy/Dockerfile.api", "") :
        p.append("deploy/Dockerfile.api: must run as a non-root user")
    if "nginx-unprivileged" not in files.get("deploy/Dockerfile.web", ""):
        p.append("deploy/Dockerfile.web: must use the unprivileged nginx image")
    if "scan_secrets.py --bundle" not in files.get("deploy/Dockerfile.web", ""):
        p.append("deploy/Dockerfile.web: the bundle secret scan must run during the build")
    ng = files.get("deploy/nginx.conf", "")
    for name, value in headers["headers"].items():
        if f'add_header {name} "{value}" always;' not in ng:
            p.append(f"deploy/nginx.conf: header {name} differs from deploy/headers.json")
    for name, value in headers["httpsOnly"].items():
        if f'# add_header {name} "{value}" always;' not in ng:
            p.append(f"deploy/nginx.conf: expected the commented HTTPS-only line for {name}")
    for needle, why in [("server_tokens off", "server version must be hidden"), ("proxy_hide_header Set-Cookie", "public API must not set cookies"),
                        ("location ~* \\.map$ { return 404; }", "source maps must not be served"), ('"no-store"', "HTML and API must be no-store")]:
        if needle not in ng:
            p.append(f"deploy/nginx.conf: {why}")
    if "TODO(platform)" not in files.get("deploy/rollback.sh", ""):
        p.append("deploy/rollback.sh: provider-specific parts must stay marked TODO(platform) until a provider is approved")
    return p


def main() -> int:
    names = ["deploy/Dockerfile.web", "deploy/Dockerfile.api", "deploy/nginx.conf", "deploy/rollback.sh", "deploy/README.md"]
    files = {n: (ROOT / n).read_text(encoding="utf8") for n in names if (ROOT / n).exists()}
    problems = check(files, json.loads((ROOT / "deploy/headers.json").read_text(encoding="utf8")))
    if problems:
        print("DEPLOY CONFIG CHECK FAILED:")
        for x in problems:
            print(" -", x)
        return 1
    print("deploy configuration checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
