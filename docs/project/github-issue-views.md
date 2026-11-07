# GitHub tracking views

The actual Projects audit returned INSUFFICIENT_SCOPES (read:project unavailable); no existing board could be inspected or updated and no duplicate board was created. No board URL is claimed. These issue filters work with actual ownership/phase labels and do not depend on Varun being assignable.

- [All issues](https://github.com/satvikp-coder/makarba-360/issues?q=is%3Aissue) — `is:issue`
- [My tasks — A](https://github.com/satvikp-coder/makarba-360/issues?q=is%3Aissue+is%3Aopen+label%3Aowner%3Adeveloper-a) — `is:issue is:open label:owner:developer-a`
- [Friend tasks — B (reserved)](https://github.com/satvikp-coder/makarba-360/issues?q=is%3Aissue+is%3Aopen+label%3Aowner%3Adeveloper-b) — `is:issue is:open label:owner:developer-b`
- [Ready now (technical prerequisites)](https://github.com/satvikp-coder/makarba-360/issues?q=is%3Aissue+is%3Aopen+label%3Astatus%3Aready) — `is:issue is:open label:status:ready`
- [Blocked by hard dependency](https://github.com/satvikp-coder/makarba-360/issues?q=is%3Aissue+is%3Aopen+label%3Adependency%3Ablocked) — `is:issue is:open label:dependency:blocked`
- [In progress](https://github.com/satvikp-coder/makarba-360/issues?q=is%3Aissue+is%3Aopen+label%3Astatus%3Ain-progress) — `is:issue is:open label:status:in-progress`
- [In review](https://github.com/satvikp-coder/makarba-360/issues?q=is%3Aissue+is%3Aopen+label%3Astatus%3Aneeds-review) — `is:issue is:open label:status:needs-review`
- [Integration](https://github.com/satvikp-coder/makarba-360/issues?q=is%3Aissue+is%3Aopen+label%3Aphase%3Aintegration) — `is:issue is:open label:phase:integration`
- [Completed](https://github.com/satvikp-coder/makarba-360/issues?q=is%3Aissue+is%3Aclosed) — `is:issue is:closed`

In-progress and in-review filters are intentionally empty until implementation starts. Move status labels deliberately when prerequisites/evidence change; assignment alone is not In Progress. Milestones remain the original 13 and are not renamed/deleted. See [milestones](https://github.com/satvikp-coder/makarba-360/milestones).
