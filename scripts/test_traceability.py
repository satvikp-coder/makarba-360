import copy
import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import check_traceability as T  # noqa: E402

MATRIX = json.loads(T.MATRIX.read_text(encoding="utf8"))
REQS = T.parse_requirements(T.REQS.read_text(encoding="utf8"))
IMAP = json.loads(T.ISSUE_MAP.read_text(encoding="utf8"))


class Traceability(unittest.TestCase):
    def mutated(self, fn):
        m = copy.deepcopy(MATRIX)
        fn(m)
        return T.check(m, REQS, IMAP)

    def test_committed_matrix_is_clean(self):
        self.assertEqual(T.check(MATRIX, REQS, IMAP), [])

    def test_generated_markdown_is_up_to_date(self):
        self.assertEqual((T.ROOT / "docs/source/traceability.md").read_text(encoding="utf8"), T.render_md(MATRIX, REQS, IMAP))

    def test_requirement_register_is_parsed(self):
        self.assertEqual(len(REQS), 25)
        self.assertEqual(REQS["R01"][:2], ["00.03", "00.06"])

    def test_missing_page_fails(self):
        p = self.mutated(lambda m: m["entries"].pop(10))
        self.assertTrue(any("expected pages 1..23" in x for x in p))

    def test_duplicate_page_fails(self):
        p = self.mutated(lambda m: m["entries"].append(copy.deepcopy(m["entries"][0])))
        self.assertTrue(any("expected pages 1..23" in x for x in p))

    def test_unknown_requirement_fails(self):
        p = self.mutated(lambda m: m["entries"][2]["requirements"].append("R99"))
        self.assertTrue(any("unknown requirement R99" in x for x in p))

    def test_missing_document_fails(self):
        p = self.mutated(lambda m: m["entries"][4]["documents"].append("docs/nope.md"))
        self.assertTrue(any("document not found: docs/nope.md" in x for x in p))

    def test_page_without_requirement_or_document_fails(self):
        def f(m):
            m["entries"][0]["requirements"] = []
            m["entries"][1]["documents"] = []
        p = self.mutated(f)
        self.assertTrue(any("page 1: maps to no requirement" in x for x in p))
        self.assertTrue(any("page 2: maps to no document" in x for x in p))

    def test_page_with_no_resolvable_issue_fails(self):
        p = T.check(MATRIX, REQS, {})
        self.assertTrue(any("no GitHub issue found" in x for x in p))

    def test_uncovered_requirement_needs_a_reason(self):
        def f(m):
            m["notFromBlueprint"] = []
        p = self.mutated(f)
        self.assertTrue(any("requirement R25" in x for x in p))
        def g(m):
            m["notFromBlueprint"][0]["reason"] = "  "
        self.assertTrue(any("requirement R25" in x for x in self.mutated(g)))

    def test_fictional_example_page_must_stay_flagged(self):
        def f(m):
            m["entries"][10]["caveat"] = ""
        self.assertTrue(any("page 11" in x and "FICTIONAL" in x for x in self.mutated(f)))

    def test_missing_text_hash_fails(self):
        def f(m):
            m["entries"][3]["textSha256"] = "x"
        self.assertTrue(any("page 4: missing text hash" in x for x in self.mutated(f)))

    def test_every_page_has_issues_and_the_numbers_exist(self):
        for e in MATRIX["entries"]:
            ids = [i for r in e["requirements"] for i in REQS[r]]
            nums = T.issue_numbers(IMAP, ids)
            self.assertTrue(nums, f"page {e['page']}")


if __name__ == "__main__":
    unittest.main()
