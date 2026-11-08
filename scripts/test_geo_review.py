import copy
import datetime
import hashlib
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import check_geo_review as G  # noqa: E402

TODAY = datetime.date(2026, 11, 8)


class GeoReview(unittest.TestCase):
    def setUp(self):
        self.root = pathlib.Path(tempfile.mkdtemp())
        (self.root / "b.geojson").write_text('{"type":"FeatureCollection","features":[]}', encoding="utf8")
        h = hashlib.sha256((self.root / "b.geojson").read_bytes()).hexdigest()
        self.item = {
            "id": "boundary-v1", "kind": "boundary", "file": "b.geojson", "fileSha256": h, "importedBy": "Ira",
            "source": {"name": "Synthetic authority", "date": "2026-10-01", "licence": "CC0-1.0"}, "importCheck": "accepted", "decision": "approved",
            "review": {"reviewerName": "Rita", "reviewerRole": "research lead", "method": "both", "reviewedOn": "2026-11-01", "evidence": ["note-1"]},
        }

    def state(self, it=None):
        return G.check_item(it or self.item, TODAY, self.root)

    def test_complete_review_is_verified(self):
        self.assertEqual(self.state(), ("VERIFIED", []))

    def test_shipped_register_is_empty_and_nothing_is_verified(self):
        import json
        self.assertEqual(json.loads(G.REGISTER.read_text(encoding="utf8"))["items"], [])
        self.assertEqual(G.main([]), 0)
        self.assertEqual(G.main(["--require-boundary"]), 1)

    def test_approval_is_a_recorded_event_not_a_flag(self):
        it = copy.deepcopy(self.item); del it["review"]
        st, p = self.state(it)
        self.assertEqual(st, "INVALID")
        self.assertTrue(any("review.reviewerName" in x for x in p) and any("review.evidence" in x for x in p))

    def test_changed_file_invalidates_the_review(self):
        (self.root / "b.geojson").write_text('{"type":"FeatureCollection","features":[{}]}', encoding="utf8")
        self.assertTrue(any("SHA-256 mismatch" in x for x in self.state()[1]))

    def test_reviewer_must_differ_from_importer(self):
        it = copy.deepcopy(self.item); it["review"]["reviewerName"] = "Ira"
        self.assertTrue(any("must differ" in x for x in self.state(it)[1]))
        it2 = copy.deepcopy(self.item); del it2["importedBy"]
        self.assertTrue(any("importedBy" in x for x in self.state(it2)[1]))

    def test_import_check_licence_method_and_date_are_enforced(self):
        for mut, text in [
            (lambda i: i.update(importCheck="rejected"), "importCheck"),
            (lambda i: i["source"].update(licence="all-rights-reserved"), "licence"),
            (lambda i: i["review"].update(method="guess"), "method"),
            (lambda i: i["review"].update(reviewedOn="2027-01-01"), "future"),
            (lambda i: i["review"].update(reviewedOn="soon"), "ISO date"),
            (lambda i: i.update(kind="lake"), "kind"),
            (lambda i: i["source"].update(name=" "), "source.name"),
        ]:
            it = copy.deepcopy(self.item); mut(it)
            st, p = self.state(it)
            self.assertEqual(st, "INVALID", text)
            self.assertTrue(any(text in x for x in p), f"{text}: {p}")

    def test_pending_and_rejected_are_not_verified(self):
        it = copy.deepcopy(self.item); it["decision"] = "pending"
        self.assertEqual(self.state(it)[0], "PENDING")
        it2 = copy.deepcopy(self.item); it2["decision"] = "rejected"
        self.assertEqual(self.state(it2)[0], "REJECTED")

    def test_missing_file_and_missing_fields(self):
        it = copy.deepcopy(self.item); it["file"] = "nope.geojson"
        self.assertTrue(any("file not found" in x for x in self.state(it)[1]))
        self.assertEqual(self.state({"id": "x"})[0], "INVALID")


if __name__ == "__main__":
    unittest.main()
