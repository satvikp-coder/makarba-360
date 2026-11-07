"""Regression checks for reruns and preserving technical/historical issue content."""
import unittest
from swap_ownership import ownership_body,OLD,NEW

def sample(role):
    return ('### Acceptance criteria\n- [ ] Preserve consent and private GPS.\n'
            'Historical PR: https://github.com/satvikp-coder/makarba-360/pull/147\n'
            '<!-- two-developer-allocation:start -->\n'
            '### Two-developer ownership and execution plan\n\n'
            f'Primary owner: **Developer {role} — `{OLD[role]}`**.\n\n'
            'Actual GitHub assignment: previous mapping.\n\n'
            'Workstream: keep technical role unchanged.\n'
            '<!-- two-developer-allocation:end -->\n'
            'Existing acceptance evidence: original author and SHA stay untouched.\n')

class OwnershipSafety(unittest.TestCase):
    def test_rerun_cannot_swap_a_back(self):
        once=ownership_body(sample('A'),'A',NEW['A'],True)
        self.assertEqual(once,ownership_body(once,'A',NEW['A'],True))
    def test_rerun_cannot_swap_b_back(self):
        once=ownership_body(sample('B'),'B',NEW['B'],False)
        self.assertEqual(once,ownership_body(once,'B',NEW['B'],False))
    def test_preserves_acceptance_evidence_repo_url_and_suffix(self):
        original=sample('A'); updated=ownership_body(original,'A',NEW['A'],True)
        self.assertEqual(original.split('<!-- two-developer-allocation:start -->')[0],updated.split('<!-- two-developer-allocation:start -->')[0])
        self.assertEqual(original.split('<!-- two-developer-allocation:end -->')[1],updated.split('<!-- two-developer-allocation:end -->')[1])
    def test_unknown_owner_does_not_silently_toggle(self):
        with self.assertRaises(RuntimeError): ownership_body(sample('A').replace('`satvikp-coder`','`unverified-user`'),'A',NEW['A'],True)
    def test_windows_issue_note_cannot_claim_unverified_assignment(self):
        original=sample('A').replace('\n','\r\n')
        updated=ownership_body(original,'A',NEW['A'],True)
        self.assertIn('pending Varun invitation acceptance/eligibility',updated)
        self.assertNotIn('Actual GitHub assignment: previous mapping',updated)
        self.assertEqual(original.split('<!-- two-developer-allocation:start -->')[0],updated.split('<!-- two-developer-allocation:start -->')[0])

if __name__=='__main__': unittest.main()
