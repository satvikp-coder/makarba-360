-- 0013 (additive): interview position (GPS), independent subject places, official claims (issues #46, #48, #49, #50).
-- The interview position (where the researcher stood) and the subject place (what was discussed) live in DIFFERENT tables and are never
-- derived from each other. Raw device readings are immutable: a correction is a new revision that keeps every earlier one.
-- Everything here is private; nothing is exposed publicly, and withdrawal discards it. Synthetic data only until ethics approval (#11).

CREATE TABLE private.interview_positions (
  interview_id    uuid        NOT NULL REFERENCES private.interviews (id),
  revision        integer     NOT NULL CHECK (revision >= 1),
  state           text        NOT NULL CHECK (state IN ('device_fix','manual_pin','denied','unavailable')),
  permission_state text       NOT NULL CHECK (permission_state IN ('granted','denied','prompt','unsupported','unknown')),
  raw_geometry    geometry(Point, 4326),                 -- what the device reported; never overwritten
  geometry        geometry(Point, 4326),                 -- the position in effect for this revision
  accuracy_m      numeric     CHECK (accuracy_m IS NULL OR (accuracy_m >= 0 AND accuracy_m < 100000)),
  captured_at     timestamptz,
  reason          text        CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 300),
  recorded_by     uuid        NOT NULL REFERENCES private.users (id),
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (interview_id, revision),
  CONSTRAINT position_ranges CHECK (
    (geometry IS NULL OR (ST_X(geometry) BETWEEN -180 AND 180 AND ST_Y(geometry) BETWEEN -90 AND 90))
    AND (raw_geometry IS NULL OR (ST_X(raw_geometry) BETWEEN -180 AND 180 AND ST_Y(raw_geometry) BETWEEN -90 AND 90))),
  -- A device fix has a position, an accuracy and a capture time. A manual pin has a position and a reason but NO invented accuracy.
  -- Denied/unavailable have no position at all and say why.
  CONSTRAINT position_state_shape CHECK (
    (state = 'device_fix'  AND geometry IS NOT NULL AND raw_geometry IS NOT NULL AND accuracy_m IS NOT NULL AND captured_at IS NOT NULL AND permission_state = 'granted')
 OR (state = 'manual_pin'  AND geometry IS NOT NULL AND accuracy_m IS NULL AND reason IS NOT NULL)
 OR (state IN ('denied','unavailable') AND geometry IS NULL AND raw_geometry IS NULL AND accuracy_m IS NULL AND reason IS NOT NULL))
);
CREATE INDEX interview_positions_recorder ON private.interview_positions (recorded_by);

CREATE FUNCTION private.guard_interview_position() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i private.interviews%ROWTYPE; latest integer;
BEGIN
  IF TG_OP = 'TRUNCATE' THEN RAISE EXCEPTION 'positions cannot be truncated' USING ERRCODE = '23001'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF coalesce(current_setting('makarba.discarding', true), '') = 'on' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'positions are append-only; withdrawal discards them' USING ERRCODE = '23001';
  END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'positions are append-only; record a new revision instead' USING ERRCODE = '23001'; END IF;
  SELECT * INTO i FROM private.interviews WHERE id = NEW.interview_id;
  IF i.status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'positions can only change while the interview is a draft' USING ERRCODE = '23001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.interview_id::text, 1));
  SELECT max(revision) INTO latest FROM private.interview_positions WHERE interview_id = NEW.interview_id;
  IF NEW.revision IS DISTINCT FROM coalesce(latest, 0) + 1 THEN
    RAISE EXCEPTION 'revision must be the next one (%)', coalesce(latest, 0) + 1 USING ERRCODE = '23001';
  END IF;
  IF NEW.recorded_by <> i.collector_id THEN RAISE EXCEPTION 'only the collecting researcher records the position' USING ERRCODE = '23001'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER interview_positions_guard BEFORE INSERT OR UPDATE OR DELETE ON private.interview_positions
  FOR EACH ROW EXECUTE FUNCTION private.guard_interview_position();
CREATE TRIGGER interview_positions_no_truncate BEFORE TRUNCATE ON private.interview_positions
  FOR EACH STATEMENT EXECUTE FUNCTION private.guard_interview_position();

-- What an interview discusses. Either an existing place or a private candidate geometry of its own. Never copied from the interview position.
CREATE TABLE private.subject_places (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id    uuid        NOT NULL REFERENCES private.interviews (id),
  topic_group     integer     NOT NULL CHECK (topic_group BETWEEN 1 AND 20),   -- one answer group per place, so one opinion is never counted twice
  location_id     uuid        REFERENCES private.locations (id),
  candidate_geometry geometry(Geometry, 4326),
  candidate_note  text        CHECK (candidate_note IS NULL OR length(candidate_note) BETWEEN 1 AND 300),
  same_spot_confirmed boolean NOT NULL DEFAULT false,   -- the researcher's explicit statement that the subject is where they stood
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, topic_group),
  CONSTRAINT subject_is_place_xor_candidate CHECK ((location_id IS NULL) <> (candidate_geometry IS NULL)),
  CONSTRAINT subject_candidate_valid CHECK (candidate_geometry IS NULL OR (
    GeometryType(candidate_geometry) IN ('POINT','MULTILINESTRING','MULTIPOLYGON') AND ST_IsValid(candidate_geometry) AND NOT ST_IsEmpty(candidate_geometry)
    AND ST_XMin(candidate_geometry) >= -180 AND ST_XMax(candidate_geometry) <= 180 AND ST_YMin(candidate_geometry) >= -90 AND ST_YMax(candidate_geometry) <= 90))
);
CREATE INDEX subject_places_location ON private.subject_places (location_id);

CREATE FUNCTION private.guard_subject_place() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i private.interviews%ROWTYPE; pos geometry;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF coalesce(current_setting('makarba.discarding', true), '') = 'on' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'subject places are not deleted; withdrawal discards them' USING ERRCODE = '23001';
  END IF;
  SELECT * INTO i FROM private.interviews WHERE id = NEW.interview_id;
  IF i.status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'subject places can only change while the interview is a draft' USING ERRCODE = '23001'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.interview_id <> OLD.interview_id OR NEW.topic_group <> OLD.topic_group) THEN RAISE EXCEPTION 'subject identity is fixed' USING ERRCODE = '23001'; END IF;
  -- Independence: a candidate that is exactly the interview position, without the researcher's explicit confirmation, was copied.
  IF NEW.candidate_geometry IS NOT NULL AND NOT NEW.same_spot_confirmed THEN
    SELECT geometry INTO pos FROM private.interview_positions WHERE interview_id = NEW.interview_id AND geometry IS NOT NULL ORDER BY revision DESC LIMIT 1;
    IF pos IS NOT NULL AND ST_Equals(pos, NEW.candidate_geometry) THEN
      RAISE EXCEPTION 'subject place equals the interview position; confirm explicitly that it is the same spot' USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER subject_places_guard BEFORE INSERT OR UPDATE OR DELETE ON private.subject_places
  FOR EACH ROW EXECUTE FUNCTION private.guard_subject_place();

-- Official claims are recorded privately as PENDING. Only a different person (never the collector) can verify, and only verified claims
-- are ever eligible for attribution (the view below is the only thing a publication step may read).
CREATE TABLE private.official_claims (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id  uuid        NOT NULL UNIQUE REFERENCES private.interviews (id),
  claimed_role  text        NOT NULL CHECK (length(btrim(claimed_role)) BETWEEN 1 AND 120),
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  claimed_by    uuid        NOT NULL REFERENCES private.users (id),
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  verified_by   uuid        REFERENCES private.users (id),
  verified_at   timestamptz,
  CONSTRAINT claim_decision_complete CHECK ((status = 'pending') = (verified_by IS NULL AND verified_at IS NULL)),
  CONSTRAINT verifier_is_not_collector CHECK (verified_by IS NULL OR verified_by <> claimed_by)
);
CREATE INDEX official_claims_claimed_by ON private.official_claims (claimed_by);
CREATE INDEX official_claims_verified_by ON private.official_claims (verified_by);

CREATE FUNCTION private.guard_official_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF coalesce(current_setting('makarba.discarding', true), '') = 'on' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'claims are not deleted; withdrawal discards them' USING ERRCODE = '23001';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN RAISE EXCEPTION 'a claim starts pending; the dropdown never produces a verified official' USING ERRCODE = '23001'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'a decided claim is final' USING ERRCODE = '23001'; END IF;
  IF NEW.interview_id <> OLD.interview_id OR NEW.claimed_role <> OLD.claimed_role OR NEW.claimed_by <> OLD.claimed_by THEN RAISE EXCEPTION 'the claim itself is fixed' USING ERRCODE = '23001'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER official_claims_guard BEFORE INSERT OR UPDATE OR DELETE ON private.official_claims
  FOR EACH ROW EXECUTE FUNCTION private.guard_official_claim();

CREATE VIEW private.attributable_official_claims AS
  SELECT c.interview_id, c.claimed_role, c.verified_at FROM private.official_claims c JOIN private.interviews i ON i.id = c.interview_id
   WHERE c.status = 'verified' AND i.status <> 'withdrawn';

-- Withdrawal also discards positions, subject places and claims.
CREATE OR REPLACE FUNCTION private.discard_on_consent_loss() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = private, pg_temp AS $$
BEGIN
  IF NEW.scope = 'participation' AND NEW.decision IN ('refused','withdrawn') THEN
    PERFORM set_config('makarba.discarding', 'on', true);
    DELETE FROM private.interview_answers WHERE interview_id = NEW.interview_id;
    DELETE FROM private.interview_positions WHERE interview_id = NEW.interview_id;
    DELETE FROM private.subject_places WHERE interview_id = NEW.interview_id;
    DELETE FROM private.official_claims WHERE interview_id = NEW.interview_id;
    PERFORM set_config('makarba.discarding', 'off', true);
    UPDATE private.interviews SET status = 'withdrawn' WHERE id = NEW.interview_id AND status <> 'withdrawn';
  END IF;
  RETURN NEW;
END $$;

REVOKE UPDATE, DELETE ON private.interview_positions FROM makarba_private_api;
REVOKE DELETE ON private.subject_places, private.official_claims FROM makarba_private_api;
-- Claims are decided on the maintenance/verification path, not by the collecting API role.
REVOKE UPDATE ON private.official_claims FROM makarba_private_api;
