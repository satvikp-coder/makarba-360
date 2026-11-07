# Source repository visibility decision

2026-11-07: the repository was created private as originally requested. After the architecture, issue backlog and planning QA were completed, the owner explicitly requested: “make repo public too”. GitHub visibility was changed to **public** and verified through the repository API (`private: false`, `visibility: public`, default branch `main`).

The committed content is planning documentation, issue mappings, governance and planning automation. The original supplied PDF remains outside Git. No real participant records, raw interview coordinates, credentials or original research media were committed. A lightweight credential-pattern scan and tracked-file review found no such material; this is not a formal security certification.

Public source visibility does not change application authorization, researcher-only collection, consent, exact-GPS restrictions, publication approval or future data-storage policy. Do not commit genuine research datasets to this repository. Source and media licensing remain separate decisions; no licence has been invented or automatically granted by changing visibility.

The publisher respects the recorded `expected_visibility: public` decision in setup-progress.json and will not silently restore private visibility or treat the owner's authorization as an error. Initial-private statements in the environment audit describe the historical setup sequence.
