import unittest
from pathlib import Path
from check_architecture_review import FIXTURE, REVIEW, ROOT, review_problems, unqualified_provider_lines

R = (ROOT / REVIEW).read_text(encoding="utf-8")
F = (ROOT / FIXTURE).read_bytes()
P = {p.relative_to(ROOT).as_posix() for p in (ROOT / "docs").rglob("*.md")}


class ArchitectureReview(unittest.TestCase):
    def test_baseline_valid(self):
        self.assertEqual(review_problems(R, F, P), [])

    def test_missing_boundary_detected(self):
        self.assertTrue(review_problems(R.replace("| Trust: database", "| x"), F, P))

    def test_interface_without_consumer_detected(self):
        bad = R.replace("| C01 Location API | A | B |", "| C01 Location API | A |  |")
        self.assertTrue(any("C01" in e for e in review_problems(bad, F, P)))

    def test_fixture_drift_detected(self):
        self.assertTrue(review_problems(R, F + b" ", P))

    def test_silent_provider_promise_detected(self):
        self.assertTrue(unqualified_provider_lines("x", "The site includes Google Street View tours."))
        self.assertFalse(unqualified_provider_lines("x", "Optional Google panorama provider, disabled by default."))

    def test_provider_dropped_from_register_detected(self):
        self.assertTrue(review_problems(R.replace("Marzipano tours", "tours"), F, P))

    def test_claimed_approval_detected(self):
        self.assertTrue(review_problems(R.replace("INDEPENDENT HUMAN REVIEW PENDING", "done"), F, P))


if __name__ == "__main__":
    unittest.main()
