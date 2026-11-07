import unittest
from check_governance import check_text


class GovernanceCheck(unittest.TestCase):
    def test_clean_text_passes(self):
        self.assertEqual(check_text("x", "No source licence has been selected."), [])

    def test_invented_email_fails(self):
        self.assertTrue(check_text("x", "Contact team@example.org"))

    def test_invented_licence_fails(self):
        self.assertTrue(check_text("x", "Released under the MIT license."))
        self.assertTrue(check_text("x", "SPDX-License-Identifier: Apache-2.0"))


if __name__ == "__main__":
    unittest.main()
