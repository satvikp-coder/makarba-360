# Versioned Study Boundary Storage and Invariants Sign-off

**Date:** 2026-11-09  
**Approver:** Varun Karthic, Core Platform Lead / Developer A  
**Issue:** [#23](https://github.com/satvikp-coder/makarba-360/issues/23)  
**Status:** IMPLEMENTED / VERIFIED

## Scope & Spatial Verification
1. **Schema & Versioning:**
   - Table `private.study_areas` stores versioned study boundaries with composite key `(id, version)`.
   - Captures `name`, `source_ref`, `verified_by`, `state` ('candidate', 'reviewed', 'approved', 'archived'), and `created_at`.
   - `private.locations` maintains a composite foreign key referencing `(study_area_id, study_area_version)`.

2. **Negative Invariants Verified:**
   - Check constraints enforce 2D EPSG:4326, `ST_IsValid`, non-empty, and valid lat/long coordinate bounds.
   - Invalid polygons, self-intersecting boundaries, wrong SRID, or out-of-range coordinates are rejected at the database level.
   - Locations cannot reference an unverified or nonexistent study boundary version.
