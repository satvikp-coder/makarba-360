"""Validate docs/project/contracts/capability-matrix.json invariants (issue #6)."""
import json
import sys
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "docs/project/contracts/capability-matrix.json"
PRIVATE = {"interview.view_private", "gps.capture", "interview.edit_draft",
           "interview.review_correction", "consent.verify", "content.publish"}
ACCESS = {"read", "own", "assigned", "grant"}
SCOPES = {"public", "study", "record", "system"}


def validate(m):
    errs = []
    roles = set(m["roles"])
    seen = set()
    for a in m["actions"]:
        i = a.get("id", "?")
        if i in seen:
            errs.append(f"{i}: duplicate action")
        seen.add(i)
        if a.get("scope") not in SCOPES:
            errs.append(f"{i}: missing/invalid study scope")
        if not a.get("ownership_policy"):
            errs.append(f"{i}: missing ownership policy")
        if not a.get("grants"):
            errs.append(f"{i}: no role may perform it")
        for r, v in a.get("grants", {}).items():
            if r not in roles:
                errs.append(f"{i}: unknown role {r}")
            if v not in ACCESS:
                errs.append(f"{i}: invalid access {v}")
            if r == "visitor" and a.get("scope") != "public":
                errs.append(f"{i}: visitor granted non-public action")
        # Admin alone must never see raw research records
        if i in PRIVATE and "administrator" in a.get("grants", {}):
            errs.append(f"{i}: administrator has implicit private access")
        if a.get("scope") in {"study", "record"} and "assigned" not in str(a.get("grants")) \
                and "own" not in str(a.get("grants")) and "grant" not in str(a.get("grants")) \
                and a.get("scope") != "public":
            errs.append(f"{i}: private action without scoped grant")
    pub = next((a for a in m["actions"] if a["id"] == "content.publish"), None)
    if not pub or "researcher" in pub["grants"] or pub["ownership_policy"] != "independent_reviewer":
        errs.append("content.publish must require an independent reviewer, not researchers")
    if m.get("approved_by") and m["status"].startswith("PROPOSED"):
        errs.append("status contradicts approval fields")
    if not m.get("approved_by") and not m["status"].startswith("PROPOSED"):
        errs.append("approval claimed without approver")
    return errs


if __name__ == "__main__":
    e = validate(json.loads(PATH.read_text(encoding="utf-8")))
    print("\n".join(e) or "capability matrix valid (status: pending approval)")
    sys.exit(1 if e else 0)
