-- 0011 (additive): immutable questionnaire versions (issues #42, #43).
-- The instrument (questions, options, branch rules, wording) is stored whole as jsonb with its SHA-256, so an interview pins one exact,
-- never-changing definition. A published version can only be retired, never edited or deleted. Publishing needs a named human authority
-- (approved_by) and is done on the maintenance path; the API role can only read. Content here is NOT approved wording until #4 and #11.

CREATE TABLE private.survey_versions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text        NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9._-]{1,40}$'),
  status          text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  instrument      jsonb       NOT NULL CHECK (jsonb_typeof(instrument) = 'object' AND jsonb_typeof(instrument -> 'questions') = 'array'),
  instrument_sha256 text      CHECK (instrument_sha256 ~ '^[0-9a-f]{64}$'),
  created_by      uuid        REFERENCES private.users (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz,
  published_by    uuid        REFERENCES private.users (id),
  approved_by     text,
  retired_at      timestamptz,
  CONSTRAINT published_is_complete CHECK (
    status = 'draft' OR (instrument_sha256 IS NOT NULL AND published_at IS NOT NULL AND approved_by IS NOT NULL AND btrim(approved_by) <> '')),
  CONSTRAINT retired_has_time CHECK ((status = 'retired') = (retired_at IS NOT NULL))
);
CREATE INDEX survey_versions_created_by ON private.survey_versions (created_by);
CREATE INDEX survey_versions_published_by ON private.survey_versions (published_by);

CREATE FUNCTION private.guard_survey_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN RAISE EXCEPTION 'questionnaire versions cannot be truncated' USING ERRCODE = '23001'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'a published questionnaire version can never be deleted' USING ERRCODE = '23001'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'draft' THEN
    IF NEW.status = 'retired' THEN RAISE EXCEPTION 'a draft cannot be retired; publish it first' USING ERRCODE = '23001'; END IF;
    RETURN NEW;
  END IF;
  -- Published or retired: frozen. The only permitted change is published -> retired (with a time).
  IF OLD.status = 'retired' THEN RAISE EXCEPTION 'a retired questionnaire version is frozen' USING ERRCODE = '23001'; END IF;
  IF NEW.status <> 'retired'
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.code IS DISTINCT FROM OLD.code OR NEW.instrument IS DISTINCT FROM OLD.instrument
     OR NEW.instrument_sha256 IS DISTINCT FROM OLD.instrument_sha256 OR NEW.published_at IS DISTINCT FROM OLD.published_at
     OR NEW.published_by IS DISTINCT FROM OLD.published_by OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'a published questionnaire version is immutable' USING ERRCODE = '23001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER survey_versions_guard BEFORE UPDATE OR DELETE ON private.survey_versions
  FOR EACH ROW EXECUTE FUNCTION private.guard_survey_version();
CREATE TRIGGER survey_versions_no_truncate BEFORE TRUNCATE ON private.survey_versions
  FOR EACH STATEMENT EXECUTE FUNCTION private.guard_survey_version();

REVOKE INSERT, UPDATE ON private.survey_versions FROM makarba_private_api;
