-- 0005 (additive): non-content security audit events (issue #39).
-- Deliberately has NO payload columns: only actor, action, outcome, reason code, subject
-- identifiers and revision. Runtime roles can only INSERT (default privileges on the audit schema);
-- UPDATE/DELETE are additionally blocked by trigger so even the table owner cannot silently edit history.

CREATE TABLE audit.security_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  at            timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid,                                   -- NULL for anonymous/unauthenticated attempts
  action        text        NOT NULL CHECK (action ~ '^[a-z][a-z_.]{2,60}$'),
  outcome       text        NOT NULL CHECK (outcome IN ('allow','deny')),
  reason_code   text        NOT NULL CHECK (reason_code IN
                  ('ok','unauthenticated','forbidden','csrf','session_expired','mfa_required','not_provisioned','invalid_request','break_glass')),
  study_area_id uuid,
  resource_type text        CHECK (resource_type ~ '^[a-z_]{2,40}$'),
  resource_id   uuid,
  revision      integer     CHECK (revision >= 0),
  request_id    text        CHECK (request_id ~ '^[A-Za-z0-9_-]{8,64}$')
);
CREATE INDEX security_events_at ON audit.security_events (at);
CREATE INDEX security_events_actor ON audit.security_events (actor_id, at);
CREATE INDEX security_events_resource ON audit.security_events (resource_type, resource_id);

CREATE FUNCTION audit.block_event_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '42501';
END $$;

CREATE TRIGGER security_events_immutable
  BEFORE UPDATE OR DELETE ON audit.security_events
  FOR EACH ROW EXECUTE FUNCTION audit.block_event_changes();
CREATE TRIGGER security_events_no_truncate
  BEFORE TRUNCATE ON audit.security_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit.block_event_changes();
