-- 0009 (additive): geometry provenance, author and independent review for private locations (issue #27).

ALTER TABLE private.locations
  ADD COLUMN geometry_provenance jsonb,
  ADD COLUMN proposed_by uuid REFERENCES private.users (id),   -- author of the CURRENT geometry
  ADD COLUMN reviewed_by uuid REFERENCES private.users (id);

ALTER TABLE private.locations
  ADD CONSTRAINT location_provenance_shape CHECK (
    geometry_provenance IS NULL OR (
      jsonb_typeof(geometry_provenance) = 'object'
      AND jsonb_typeof(geometry_provenance -> 'source') = 'string' AND btrim(geometry_provenance ->> 'source') <> ''
      AND geometry_provenance ->> 'method' IN ('digitised','surveyed','imported','reported','gps_walk'))),
  -- A geometry can only leave "candidate" if we can say where it came from.
  ADD CONSTRAINT location_reviewed_has_provenance CHECK (state = 'candidate' OR geometry_provenance IS NOT NULL),
  -- The reviewer is never the author.
  ADD CONSTRAINT location_reviewer_independent CHECK (reviewed_by IS NULL OR reviewed_by IS DISTINCT FROM proposed_by);

ALTER TABLE audit.location_geometry_revisions
  ADD COLUMN provenance jsonb,
  ADD COLUMN changed_by uuid;

-- Revisions now also bump when provenance changes; any change to an already reviewed/approved/published geometry sends it
-- back to "candidate" (it needs a new independent review) and clears the previous reviewer.
CREATE OR REPLACE FUNCTION private.record_location_geometry() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.geometry IS DISTINCT FROM OLD.geometry
     OR NEW.geometry_provenance IS DISTINCT FROM OLD.geometry_provenance THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.revision := OLD.revision + 1;
      IF OLD.state IN ('reviewed','approved','published') AND NEW.state = OLD.state THEN
        NEW.state := 'candidate';
        NEW.last_reviewed_at := NULL;
        NEW.reviewed_by := NULL;
      END IF;
    END IF;
    INSERT INTO audit.location_geometry_revisions (location_id, revision, geometry, provenance, changed_by)
    VALUES (NEW.id, NEW.revision, NEW.geometry, NEW.geometry_provenance, NEW.proposed_by);
  END IF;
  RETURN NEW;
END $$;

-- The private API shows a place's revision history to reviewers. Read only: it still cannot UPDATE or DELETE any audit row.
GRANT SELECT ON audit.location_geometry_revisions TO makarba_private_api;
