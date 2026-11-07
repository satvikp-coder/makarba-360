-- 0003 (additive): staff identity mapping and server-side sessions (issue #32).
-- No passwords are stored; credentials and MFA stay with the external OIDC provider.
-- Session tokens are stored only as SHA-256 hashes so a database read cannot replay a session.

CREATE TABLE private.users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  oidc_subject  text        NOT NULL UNIQUE CHECK (length(oidc_subject) > 0),
  display_name  text        NOT NULL DEFAULT '',
  active        boolean     NOT NULL DEFAULT true,   -- deactivation revokes access immediately
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE private.sessions (
  token_hash          text        PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  csrf_hash           text        NOT NULL CHECK (csrf_hash ~ '^[0-9a-f]{64}$'),
  user_id             uuid        NOT NULL REFERENCES private.users (id),
  mfa                 boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  absolute_expires_at timestamptz NOT NULL,
  revoked_at          timestamptz
);
CREATE INDEX sessions_user ON private.sessions (user_id);
CREATE INDEX sessions_expiry ON private.sessions (absolute_expires_at);
