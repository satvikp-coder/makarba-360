-- 0014 (additive): submitting an interview and independent review decisions (issues #52 server side, groundwork for #53 and #99).
-- Submit is the ONLY way a draft becomes "submitted": a definer function checks consent, an explicit interview-position state, and drops
-- answers to questions that the final answers hide. Review decisions are append-only and never by the collector.
-- Synthetic data only until ethics approval (#11).

ALTER TABLE private.interviews ADD COLUMN submitted_at timestamptz;

CREATE FUNCTION private.guard_interview_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
    IF coalesce(current_setting('makarba.submitting', true), '') <> 'on' OR NEW.submitted_at IS NULL THEN
      RAISE EXCEPTION 'an interview can only be submitted through submit_interview' USING ERRCODE = '23001';
    END IF;
  END IF;
  IF OLD.submitted_at IS NOT NULL AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'submission time is fixed' USING ERRCODE = '23001';
  END IF;
  IF NEW.status = 'draft' AND NEW.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'a draft has no submission time' USING ERRCODE = '23001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER interviews_submission_guard BEFORE UPDATE ON private.interviews
  FOR EACH ROW EXECUTE FUNCTION private.guard_interview_submission();

-- Submits a draft. `p_prune` lists answered questions that are hidden by the final answers (decided by the application using the pinned
-- questionnaire); they are removed so nothing "not asked" is kept as if it were answered. Idempotent for an already submitted interview.
CREATE FUNCTION private.submit_interview(p_id uuid, p_actor uuid, p_prune text[]) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = private, public, pg_temp AS $$
DECLARE i private.interviews%ROWTYPE;
BEGIN
  SELECT * INTO i FROM private.interviews WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown interview' USING ERRCODE = '23001'; END IF;
  IF i.collector_id <> p_actor THEN RAISE EXCEPTION 'only the collecting researcher submits' USING ERRCODE = '23001'; END IF;
  IF i.status = 'submitted' THEN RETURN 'already_submitted'; END IF;
  IF i.status <> 'draft' THEN RAISE EXCEPTION 'only a draft can be submitted' USING ERRCODE = '23001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.consent_events e WHERE e.interview_id = p_id AND e.scope = 'participation' AND e.decision = 'granted')
     OR EXISTS (SELECT 1 FROM private.consent_events e WHERE e.interview_id = p_id AND e.scope = 'participation' AND e.decision IN ('refused','withdrawn')) THEN
    RAISE EXCEPTION 'participation consent is not in force' USING ERRCODE = '23001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.interview_positions WHERE interview_id = p_id) THEN
    RAISE EXCEPTION 'record the interview position (or why there is none) before submitting' USING ERRCODE = '23001';
  END IF;
  PERFORM set_config('makarba.discarding', 'on', true);
  DELETE FROM private.interview_answers WHERE interview_id = p_id AND question_code = ANY(coalesce(p_prune, '{}'));
  PERFORM set_config('makarba.discarding', 'off', true);
  PERFORM set_config('makarba.submitting', 'on', true);
  UPDATE private.interviews SET status = 'submitted', submitted_at = now() WHERE id = p_id;
  PERFORM set_config('makarba.submitting', 'off', true);
  RETURN 'submitted';
END $$;
REVOKE ALL ON FUNCTION private.submit_interview(uuid, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.submit_interview(uuid, uuid, text[]) TO makarba_private_api;

CREATE TABLE private.interview_reviews (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  interview_id uuid        NOT NULL REFERENCES private.interviews (id),
  decision     text        NOT NULL CHECK (decision IN ('approved','changes_requested','rejected')),
  reviewer_id  uuid        NOT NULL REFERENCES private.users (id),
  note         text        CHECK (note IS NULL OR length(note) BETWEEN 1 AND 500),
  decided_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interview_reviews_interview ON private.interview_reviews (interview_id, id DESC);
CREATE INDEX interview_reviews_reviewer ON private.interview_reviews (reviewer_id);

CREATE FUNCTION private.guard_interview_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i private.interviews%ROWTYPE; last_decision text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'review decisions are append-only' USING ERRCODE = '23001'; END IF;
  SELECT * INTO i FROM private.interviews WHERE id = NEW.interview_id;
  IF i.status IS DISTINCT FROM 'submitted' THEN RAISE EXCEPTION 'only a submitted interview can be reviewed' USING ERRCODE = '23001'; END IF;
  IF i.collector_id = NEW.reviewer_id THEN RAISE EXCEPTION 'nobody reviews their own interview' USING ERRCODE = '23001'; END IF;
  SELECT decision INTO last_decision FROM private.interview_reviews WHERE interview_id = NEW.interview_id ORDER BY id DESC LIMIT 1;
  IF last_decision IN ('approved','rejected') THEN RAISE EXCEPTION 'this review is already decided' USING ERRCODE = '23001'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER interview_reviews_guard BEFORE INSERT OR UPDATE OR DELETE ON private.interview_reviews
  FOR EACH ROW EXECUTE FUNCTION private.guard_interview_review();

-- Latest decision per interview ("pending" when none).
CREATE VIEW private.interview_review_status AS
  SELECT i.id AS interview_id, coalesce(r.decision, 'pending') AS review_status, r.reviewer_id, r.decided_at
    FROM private.interviews i
    LEFT JOIN LATERAL (SELECT decision, reviewer_id, decided_at FROM private.interview_reviews WHERE interview_id = i.id ORDER BY id DESC LIMIT 1) r ON true
   WHERE i.status = 'submitted';

REVOKE INSERT, UPDATE, DELETE ON private.interview_reviews FROM makarba_private_api;
