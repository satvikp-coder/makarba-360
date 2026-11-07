# Environment and authorization audit

Audited 2026-11-07 in `C:/Users/satvi/Desktop/SPS-CS` using PowerShell. The supplied workspace initially contained the blueprint PDF and was not a Git repository. No existing application or history was overwritten.

- Git 2.56.0.windows.4 and GitHub CLI 2.103.3 available.
- GitHub CLI authenticated as `satvikp-coder`; credentials remain in the system keyring and are not recorded here.
- Initial lookup found no `satvikp-coder/makarba-360`; a new private repository and local child directory were created, with `main` as default branch.
- Actual repository API reports admin, maintain, push, triage and pull permissions. Labels, milestones and issue creation succeeded through the supported GitHub REST API via CLI.
- Available token scopes include repo/workflow but omit GitHub Projects access. Actual GraphQL `viewer.projectsV2` query returned `INSUFFICIENT_SCOPES` requiring `read:project`. Board creation/population was therefore unavailable; no board URL is claimed. No credentials or scope changes were attempted.
- All 23 source pages were text-extracted with PyMuPDF and read. SHA-256 provenance and page traceability are recorded. Original PDF remains in the supplied parent workspace, outside Git.
- The original supplied issue inventory totals 133. Added focused tasks: institutional ethics/legal gate, structured field observations, and conditional approved ODK/Kobo importer; final planned total is 136.

Planning-only actions are authorised by the user. No product implementation, participant collection, paid-service activation, force push, existing-work deletion or external message to people occurred. Planning publication scripts use local stable IDs and verify existing issue markers before creation. A temporary connection failure was recovered by reconciliation rather than restarting the backlog blindly.
