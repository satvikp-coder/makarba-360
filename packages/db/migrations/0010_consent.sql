-- 0010 (additive): versioned, scope-by-scope, append-only consent (issue #37). Synthetic data only until institutional approval (#11).
-- Each scope is an independent decision. A refusal or withdrawal is terminal for that interview: it can never be overwritten by a
-- later "granted" (a participant who changes their mind is a NEW interview with a fresh consent). Withdrawing participation withdraws
-- every granted scope with it. Rows are never updated or deleted.

CREATE TABLE private.consent_script_versions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  version      text        NOT NULL CHECK (version ~ '^[A-Za-z0-9._-]{1,40}$'),
  language     text        NOT NULL CHECK (language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
  content_sha256 text      NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  status       text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','retired')),
  approved_by  text,                                   -- named institutional authority, recorded by the maintenance path
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version, language),
  CONSTRAINT approved_has_authority CHECK (status = 'draft' OR (approved_by IS NOT NULL AND btrim(approved_by) <> '' AND approved_at IS NOT NULL))
);

CREATE TABLE private.consent_events (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  interview_id uuid        NOT NULL,
  study_area_id uuid       NOT NULL,
  scope        text        NOT NULL CHECK (scope IN ('participation','recording','aggregate_use','identifiable_media','identifiable_story')),
  decision     text        NOT NULL CHECK (decision IN ('granted','refused','withdrawn')),
  script_version_id uuid   NOT NULL REFERENCES private.consent_script_versions (id),
  language     text        NOT NULL,
  recorded_by  uuid        NOT NULL REFERENCES private.users (id),
  recorded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_events_interview ON private.consent_events (interview_id, scope, id DESC);
CREATE INDEX consent_events_script ON private.consent_events (script_version_id);
CREATE INDEX consent_events_user ON private.consent_events (recorded_by);

CREATE FUNCTION private.guard_consent_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  latest text;
  participation text;
  sv private.consent_script_versions%ROWTYPE;
  known_area uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'consent records are append-only' USING ERRCODE = '23001';
  END IF;
  -- Serialise decisions per interview so two concurrent requests cannot both pass the checks below.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.interview_id::text, 0));
  SELECT study_area_id INTO known_area FROM private.consent_events WHERE interview_id = NEW.interview_id LIMIT 1;
  IF known_area IS NOT NULL AND known_area <> NEW.study_area_id THEN
    RAISE EXCEPTION 'interview belongs to a different study' USING ERRCODE = '23001';
  END IF;
  SELECT * INTO sv FROM private.consent_script_versions WHERE id = NEW.script_version_id;
  IF sv.status <> 'approved' AND NEW.decision <> 'withdrawn' THEN
    RAISE EXCEPTION 'consent script version is not approved' USING ERRCODE = '23001';
  END IF;
  IF sv.language <> NEW.language THEN
    RAISE EXCEPTION 'language does not match the script version' USING ERRCODE = '23001';
  END IF;

  SELECT decision INTO latest FROM private.consent_events WHERE interview_id = NEW.interview_id AND scope = NEW.scope ORDER BY id DESC LIMIT 1;
  IF latest IN ('refused','withdrawn') THEN
    RAISE EXCEPTION 'a refusal or withdrawal cannot be overwritten' USING ERRCODE = '23001';
  ELSIF latest = 'granted' AND NEW.decision <> 'withdrawn' THEN
    RAISE EXCEPTION 'this scope is already granted' USING ERRCODE = '23001';
  ELSIF latest IS NULL AND NEW.decision = 'withdrawn' THEN
    RAISE EXCEPTION 'nothing to withdraw' USING ERRCODE = '23001';
  END IF;

  IF NEW.scope <> 'participation' AND NEW.decision <> 'withdrawn' THEN
    SELECT decision INTO participation FROM private.consent_events WHERE interview_id = NEW.interview_id AND scope = 'participation' ORDER BY id DESC LIMIT 1;
    IF participation IS DISTINCT FROM 'granted' THEN
      RAISE EXCEPTION 'participation consent must be granted first' USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER consent_events_guard BEFORE INSERT OR UPDATE OR DELETE ON private.consent_events
  FOR EACH ROW EXECUTE FUNCTION private.guard_consent_event();
CREATE TRIGGER consent_events_no_truncate BEFORE TRUNCATE ON private.consent_events
  FOR EACH STATEMENT EXECUTE FUNCTION private.guard_consent_event();

-- Withdrawing (or refusing) participation withdraws every scope that was granted, in the same transaction.
CREATE FUNCTION private.cascade_participation_withdrawal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.scope = 'participation' AND NEW.decision = 'withdrawn' THEN
    INSERT INTO private.consent_events (interview_id, study_area_id, scope, decision, script_version_id, language, recorded_by)
    SELECT c.interview_id, c.study_area_id, c.scope, 'withdrawn', NEW.script_version_id, NEW.language, NEW.recorded_by
      FROM (SELECT DISTINCT ON (scope) * FROM private.consent_events WHERE interview_id = NEW.interview_id AND scope <> 'participation' ORDER BY scope, id DESC) c
     WHERE c.decision = 'granted';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER consent_events_cascade AFTER INSERT ON private.consent_events
  FOR EACH ROW EXECUTE FUNCTION private.cascade_participation_withdrawal();

-- Latest decision per interview and scope.
CREATE VIEW private.current_consent AS
  SELECT DISTINCT ON (interview_id, scope) interview_id, study_area_id, scope, decision, script_version_id, language, recorded_by, recorded_at
    FROM private.consent_events ORDER BY interview_id, scope, id DESC;

-- What analytics and publication may rely on (see packages/analytics eligibility): research use needs participation granted,
-- aggregate use needs its own grant, and withdrawn means participation was withdrawn.
CREATE VIEW private.interview_consent_flags AS
  SELECT interview_id,
         bool_or(scope = 'participation' AND decision = 'granted')        AS consent_research,
         bool_or(scope = 'aggregate_use' AND decision = 'granted')        AS consent_aggregate,
         bool_or(scope = 'recording' AND decision = 'granted')            AS consent_recording,
         bool_or(scope = 'identifiable_media' AND decision = 'granted')   AS consent_identifiable_media,
         bool_or(scope = 'identifiable_story' AND decision = 'granted')   AS consent_identifiable_story,
         bool_or(scope = 'participation' AND decision = 'withdrawn')      AS withdrawn
    FROM private.current_consent GROUP BY interview_id;

-- The private API records decisions but can never rewrite history or approve scripts (approval is a recorded human act on the maintenance path).
REVOKE UPDATE ON private.consent_events FROM makarba_private_api;
REVOKE INSERT, UPDATE ON private.consent_script_versions FROM makarba_private_api;
