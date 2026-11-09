-- Issue #23: preserve reviewed study-area versions and require provenance.
-- Existing non-candidate rows without source/reviewer evidence must be resolved
-- before this migration can succeed; do not silently certify historical data.
ALTER TABLE private.study_areas
  ADD CONSTRAINT study_area_review_evidence CHECK (
    state NOT IN ('reviewed', 'approved') OR
    (source_ref IS NOT NULL AND length(btrim(source_ref)) > 0 AND verified_by IS NOT NULL)
  );

CREATE FUNCTION private.guard_study_area_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state IN ('reviewed', 'approved', 'archived') AND NEW.state = 'candidate' THEN
    RAISE EXCEPTION 'reviewed study area cannot return to candidate; create a new version' USING ERRCODE = '23514';
  END IF;
  IF OLD.state IN ('reviewed', 'approved', 'archived') AND
     (NEW.id IS DISTINCT FROM OLD.id OR NEW.version IS DISTINCT FROM OLD.version OR
      NEW.geometry IS DISTINCT FROM OLD.geometry OR NEW.source_ref IS DISTINCT FROM OLD.source_ref OR
      NEW.verified_by IS DISTINCT FROM OLD.verified_by) THEN
    RAISE EXCEPTION 'reviewed study area evidence is immutable; create a new version' USING ERRCODE = '23514';
  END IF;
  IF OLD.state = 'archived' AND NEW.state <> 'archived' THEN
    RAISE EXCEPTION 'archived study area cannot be reactivated' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER study_area_version_guard BEFORE UPDATE ON private.study_areas
  FOR EACH ROW EXECUTE FUNCTION private.guard_study_area_version();
