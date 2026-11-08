-- 0008 (additive): location category taxonomy (issue #26).
-- Stable codes, localizable labels, distinct icons among active categories, archive-not-delete, and a public read model.

ALTER TABLE private.location_categories
  ADD COLUMN sort_order  integer     NOT NULL DEFAULT 0,
  ADD COLUMN description jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(description) = 'object'),
  ADD COLUMN color_token text        CHECK (color_token IS NULL OR color_token ~ '^[a-z][a-z0-9-]{1,30}$'),
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN replaced_by text        REFERENCES private.location_categories (id);

ALTER TABLE private.location_categories
  ADD CONSTRAINT category_icon_format CHECK (icon ~ '^[a-z][a-z0-9-]{1,40}$'),
  -- English is the required fallback locale; every label must be a non-empty string.
  ADD CONSTRAINT category_labels_valid CHECK (
    jsonb_typeof(labels -> 'en') = 'string' AND length(btrim(labels ->> 'en')) > 0
    AND NOT jsonb_path_exists(labels, '$.* ? (@.type() != "string" || @ like_regex "^\s*$")')),
  ADD CONSTRAINT category_archive_consistent CHECK ((archived AND archived_at IS NOT NULL) OR (NOT archived AND archived_at IS NULL)),
  ADD CONSTRAINT category_not_self_replacement CHECK (replaced_by IS DISTINCT FROM id);

-- Distinct icons: no two ACTIVE categories may share an icon (an archived category frees its icon).
CREATE UNIQUE INDEX location_categories_active_icon ON private.location_categories (icon) WHERE NOT archived;

-- Codes are stable: they can never be renamed, and a category can never be deleted (history keeps pointing at it).
CREATE FUNCTION private.guard_location_category() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'location categories are archived, never deleted' USING ERRCODE = '23001';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'category codes are stable and cannot change' USING ERRCODE = '23001';
  END IF;
  IF NEW.replaced_by IS NOT NULL AND EXISTS (SELECT 1 FROM private.location_categories c WHERE c.id = NEW.replaced_by AND c.archived) THEN
    RAISE EXCEPTION 'replacement category must be active' USING ERRCODE = '23001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER location_categories_guard BEFORE UPDATE OR DELETE ON private.location_categories
  FOR EACH ROW EXECUTE FUNCTION private.guard_location_category();

-- An archived category stays on existing places (history intact) but cannot be given to new places or moved onto.
CREATE FUNCTION private.guard_location_category_use() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.category_id IS DISTINCT FROM OLD.category_id)
     AND EXISTS (SELECT 1 FROM private.location_categories c WHERE c.id = NEW.category_id AND c.archived) THEN
    RAISE EXCEPTION 'category % is archived', NEW.category_id USING ERRCODE = '23001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER locations_category_use BEFORE INSERT OR UPDATE OF category_id ON private.locations
  FOR EACH ROW EXECUTE FUNCTION private.guard_location_category_use();

-- Append-only record of taxonomy changes.
CREATE TABLE audit.location_category_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id text        NOT NULL,
  action      text        NOT NULL CHECK (action IN ('create','update','archive','restore')),
  snapshot    jsonb       NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION private.record_location_category() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit.location_category_events (category_id, action, snapshot)
  VALUES (NEW.id,
          CASE WHEN TG_OP = 'INSERT' THEN 'create' WHEN NEW.archived AND NOT OLD.archived THEN 'archive' WHEN OLD.archived AND NOT NEW.archived THEN 'restore' ELSE 'update' END,
          to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER location_categories_audit AFTER INSERT OR UPDATE ON private.location_categories
  FOR EACH ROW EXECUTE FUNCTION private.record_location_category();

-- Approved read model for the public site: written only by the publication worker. Holds archived rows still referenced by published places
-- so old places keep a label; `archived` tells the filter UI not to offer them.
CREATE TABLE published.categories (
  id         text    PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_]{1,40}$'),
  labels     jsonb   NOT NULL CHECK (jsonb_typeof(labels) = 'object'),
  icon       text    NOT NULL,
  color_token text,
  sort_order integer NOT NULL DEFAULT 0,
  archived   boolean NOT NULL DEFAULT false
);
