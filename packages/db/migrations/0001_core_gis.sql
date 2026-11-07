-- 0001: study areas, location taxonomy, locations and the public projection.
-- Runs as makarba_migrator after db/bootstrap/001_roles_and_schemas.sql (which provisions
-- extensions, schemas and default grants). Synthetic fixtures live in tests, never here.
-- Geometry is 2D EPSG:4326 (longitude, latitude).

-- Versioned research extent. Not an official boundary unless verified (state).
CREATE TABLE private.study_areas (
  id           uuid        NOT NULL,
  version      integer     NOT NULL CHECK (version >= 1),
  name         text        NOT NULL CHECK (length(btrim(name)) > 0),
  geometry     geometry(MultiPolygon, 4326) NOT NULL,
  source_ref   text,                       -- FK to historical_sources arrives with that table
  verified_by  uuid,                       -- FK to users arrives with #32
  state        text        NOT NULL DEFAULT 'candidate'
               CHECK (state IN ('candidate','reviewed','approved','archived')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version),
  CONSTRAINT study_area_geometry_valid CHECK (
    NOT ST_IsEmpty(geometry) AND ST_IsValid(geometry) AND ST_NDims(geometry) = 2
    AND ST_XMin(geometry) >= -180 AND ST_XMax(geometry) <= 180
    AND ST_YMin(geometry) >= -90  AND ST_YMax(geometry) <= 90),
  CONSTRAINT study_area_verified_has_reviewer CHECK (state NOT IN ('approved') OR verified_by IS NOT NULL)
);
CREATE INDEX study_areas_geometry_gist ON private.study_areas USING gist (geometry);

-- Stable taxonomy codes; archived, never deleted, once referenced.
CREATE TABLE private.location_categories (
  id        text    PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_]{1,40}$'),
  labels    jsonb   NOT NULL CHECK (jsonb_typeof(labels) = 'object'),
  icon      text    NOT NULL,
  archived  boolean NOT NULL DEFAULT false
);

-- Places. Point / MultiLineString / MultiPolygon only; valid, non-empty, in range.
CREATE TABLE private.locations (
  id               uuid        PRIMARY KEY,
  study_area_id    uuid        NOT NULL,
  study_area_version integer   NOT NULL,
  category_id      text        NOT NULL REFERENCES private.location_categories (id),
  name             jsonb       NOT NULL CHECK (jsonb_typeof(name) = 'object'),
  aliases          jsonb       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(aliases) = 'array'),
  geometry         geometry(Geometry, 4326) NOT NULL,
  evidence_ref     text,
  revision         integer     NOT NULL DEFAULT 1 CHECK (revision >= 1),
  state            text        NOT NULL DEFAULT 'candidate'
                   CHECK (state IN ('candidate','reviewed','approved','published','archived','withdrawn')),
  last_reviewed_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (study_area_id, study_area_version) REFERENCES private.study_areas (id, version),
  CONSTRAINT location_geometry_type CHECK (GeometryType(geometry) IN ('POINT','MULTILINESTRING','MULTIPOLYGON')),
  CONSTRAINT location_geometry_valid CHECK (
    NOT ST_IsEmpty(geometry) AND ST_IsValid(geometry) AND ST_NDims(geometry) = 2
    AND ST_XMin(geometry) >= -180 AND ST_XMax(geometry) <= 180
    AND ST_YMin(geometry) >= -90  AND ST_YMax(geometry) <= 90),
  CONSTRAINT location_published_is_reviewed CHECK (state NOT IN ('approved','published') OR last_reviewed_at IS NOT NULL)
);
CREATE INDEX locations_geometry_gist ON private.locations USING gist (geometry);
CREATE INDEX locations_state_area ON private.locations (state, study_area_id);
CREATE INDEX locations_category ON private.locations (category_id);
CREATE INDEX locations_study_area_fk ON private.locations (study_area_id, study_area_version);

-- Public projection: allowlisted columns only, written by the worker. Never SELECT * from private.
-- Contains verified place geometry, never interview positions.
CREATE TABLE published.locations (
  id               uuid        PRIMARY KEY,
  slug             text        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,80}$'),
  category_id      text        NOT NULL,
  name             jsonb       NOT NULL CHECK (jsonb_typeof(name) = 'object'),
  geometry         geometry(Geometry, 4326) NOT NULL,
  last_reviewed_at timestamptz NOT NULL,
  revision         integer     NOT NULL CHECK (revision >= 1),
  snapshot_id      text        NOT NULL,
  CONSTRAINT published_geometry_type CHECK (GeometryType(geometry) IN ('POINT','MULTILINESTRING','MULTIPOLYGON')),
  CONSTRAINT published_geometry_valid CHECK (
    NOT ST_IsEmpty(geometry) AND ST_IsValid(geometry) AND ST_NDims(geometry) = 2
    AND ST_XMin(geometry) >= -180 AND ST_XMax(geometry) <= 180
    AND ST_YMin(geometry) >= -90  AND ST_YMax(geometry) <= 90)
);
CREATE INDEX published_locations_geometry_gist ON published.locations USING gist (geometry);
CREATE INDEX published_locations_category ON published.locations (category_id);
