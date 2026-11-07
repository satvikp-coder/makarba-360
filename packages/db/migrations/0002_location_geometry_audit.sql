-- 0002 (additive): immutable geometry revision history for locations.
-- Runtime roles may only append (default privileges on the audit schema grant INSERT only).

CREATE TABLE audit.location_geometry_revisions (
  location_id uuid        NOT NULL,
  revision    integer     NOT NULL,
  geometry    geometry(Geometry, 4326) NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, revision)
);

CREATE FUNCTION private.record_location_geometry() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.geometry IS DISTINCT FROM OLD.geometry THEN
    IF TG_OP = 'UPDATE' THEN NEW.revision := OLD.revision + 1; END IF;
    INSERT INTO audit.location_geometry_revisions (location_id, revision, geometry)
    VALUES (NEW.id, NEW.revision, NEW.geometry);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER locations_geometry_revision
  BEFORE INSERT OR UPDATE ON private.locations
  FOR EACH ROW EXECUTE FUNCTION private.record_location_geometry();
