-- 0006 (additive): invitation-only onboarding and the training prerequisite (issue #33).
-- No e-mail addresses or personal contact data are stored: an invitation carries a display label,
-- the intended role/study, and a one-time token that is stored only as a SHA-256 hash.

CREATE TABLE private.invitations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash     text        NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  label          text        NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  role_id        text        NOT NULL REFERENCES private.roles (id) CHECK (role_id <> 'administrator'),
  study_area_id  uuid        NOT NULL,
  created_by     uuid        NOT NULL REFERENCES private.users (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  accepted_at    timestamptz,
  accepted_user  uuid        REFERENCES private.users (id),
  revoked_at     timestamptz,
  CONSTRAINT accepted_has_user CHECK ((accepted_at IS NULL) = (accepted_user IS NULL)),
  CONSTRAINT expiry_after_creation CHECK (expires_at > created_at)
);
CREATE INDEX invitations_created_by ON private.invitations (created_by);
CREATE INDEX invitations_accepted_user ON private.invitations (accepted_user);
CREATE INDEX invitations_role ON private.invitations (role_id);

-- Training prerequisite for collection. Rows are facts recorded by an authorised user; none are invented.
CREATE TABLE private.researcher_profiles (
  user_id          uuid        PRIMARY KEY REFERENCES private.users (id),
  training_version text        NOT NULL CHECK (length(btrim(training_version)) > 0),
  trained_at       timestamptz NOT NULL,
  recorded_by      uuid        NOT NULL REFERENCES private.users (id),
  CONSTRAINT trainer_is_not_self CHECK (user_id <> recorded_by)
);
CREATE INDEX researcher_profiles_recorded_by ON private.researcher_profiles (recorded_by);
