# Functional Requirements Catalogue Baseline Approval

**Date:** 2026-11-09  
**Approver:** Varun Karthic, Core Platform Lead / Developer A  
**Issue:** [#7](https://github.com/satvikp-coder/makarba-360/issues/7)  
**Status:** APPROVED / BASELINED

## Requirements Catalogue Review
1. **Scope and Traceability:**
   - 25 core functional and domain requirements (R01 to R25) are baselined with stable IDs, release allocations, and screen inventories in `docs/product/requirements.md`.
   - Verified by `python scripts/check_traceability.py` across all 23 source blueprint pages and 25 requirement definitions.

2. **Negative Invariants Verified:**
   - Requirement R10 establishes that the private interview location (where the interview physically happens) and the subject place geometry (place discussed) are stored independently in the database (`interviews.interview_location` vs `subject_locations`). A discussion about place B captured at place A remains distinct.
   - Requirement R01 strictly prevents public submission forms.
