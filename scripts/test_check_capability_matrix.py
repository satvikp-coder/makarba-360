import copy
import json
import unittest
from check_capability_matrix import PATH, validate

M = json.loads(PATH.read_text(encoding="utf-8"))


def act(m, i):
    return next(a for a in m["actions"] if a["id"] == i)


class Matrix(unittest.TestCase):
    def test_baseline_valid_and_unapproved(self):
        self.assertEqual(validate(M), [])
        self.assertIsNone(M["approved_by"])
        self.assertTrue(M["status"].startswith("PROPOSED"))

    def test_admin_cannot_read_raw_records(self):
        self.assertNotIn("administrator", act(M, "interview.view_private")["grants"])

    def test_admin_private_grant_rejected(self):
        m = copy.deepcopy(M)
        act(m, "interview.view_private")["grants"]["administrator"] = "grant"
        self.assertTrue(validate(m))

    def test_missing_scope_or_ownership_rejected(self):
        m = copy.deepcopy(M)
        del act(m, "visit.start")["scope"]
        del act(m, "interview.create")["ownership_policy"]
        self.assertEqual(len(validate(m)), 2)

    def test_visitor_private_and_researcher_publish_rejected(self):
        m = copy.deepcopy(M)
        act(m, "visit.start")["grants"]["visitor"] = "read"
        act(m, "content.publish")["grants"]["researcher"] = "own"
        self.assertEqual(len(validate(m)), 2)

    def test_forged_approval_rejected(self):
        m = copy.deepcopy(M)
        m["status"] = "APPROVED"
        self.assertTrue(validate(m))


if __name__ == "__main__":
    unittest.main()
