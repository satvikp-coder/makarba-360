-- 0007 (additive): public projection tables for history, media, insights snapshot and stories (issue #81).
-- Written only by the publication worker (default privileges: public API and private API read, worker writes). Each row holds the
-- already-validated public DTO as jsonb; the API validates it again against the shared contract before sending. Rows are DELETED on
-- withdrawal, so a withdrawn item answers 404 at once. No private table is referenced and nothing here stores interview positions.

CREATE TABLE published.history (
  slug         text        PRIMARY KEY REFERENCES published.locations (slug) ON DELETE CASCADE,
  payload      jsonb       NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  revision     integer     NOT NULL CHECK (revision >= 1),
  snapshot_id  text        NOT NULL
);

CREATE TABLE published.media (
  id           text        PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$'),
  location_id  uuid        NOT NULL REFERENCES published.locations (id) ON DELETE CASCADE,
  payload      jsonb       NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  revision     integer     NOT NULL CHECK (revision >= 1),
  snapshot_id  text        NOT NULL
);
CREATE INDEX published_media_location ON published.media (location_id);

-- Exactly one snapshot may be current; publishing a new one replaces the row, withdrawal deletes it.
CREATE TABLE published.insights_snapshots (
  id           text        PRIMARY KEY,
  is_current   boolean     NOT NULL DEFAULT false,
  payload      jsonb       NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX published_one_current_snapshot ON published.insights_snapshots ((true)) WHERE is_current;

CREATE TABLE published.stories (
  id           text        PRIMARY KEY,
  payload      jsonb       NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  revision     integer     NOT NULL CHECK (revision >= 1),
  snapshot_id  text        NOT NULL
);
