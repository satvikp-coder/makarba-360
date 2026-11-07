-- 0004 (additive): role catalogue and scoped, revocable, expiring grants (issue #34).
-- The permission policy itself lives in docs/project/contracts/capability-matrix.json
-- (PROPOSED until issue #6 is approved). This schema stores only who holds which role where.
-- Note: study_area_id is not a foreign key because study_areas is keyed (id, version) and a
-- grant applies to the study across versions; the authorization service validates it.

CREATE TABLE private.roles (
  id text PRIMARY KEY CHECK (id IN ('researcher','lead','reviewer','administrator'))
);
INSERT INTO private.roles (id) VALUES ('researcher'), ('lead'), ('reviewer'), ('administrator');

CREATE TABLE private.user_roles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES private.users (id),
  role_id       text        NOT NULL REFERENCES private.roles (id),
  study_area_id uuid,                                  -- NULL only for the system-scoped administrator role
  expires_at    timestamptz,
  granted_by    uuid        NOT NULL REFERENCES private.users (id),
  granted_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  CONSTRAINT admin_is_system_scoped CHECK ((role_id = 'administrator') = (study_area_id IS NULL)),
  CONSTRAINT no_self_grant CHECK (user_id <> granted_by)
);
-- One live grant per user/role/study (NULL study treated as equal).
CREATE UNIQUE INDEX user_roles_live_unique
  ON private.user_roles (user_id, role_id, COALESCE(study_area_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE revoked_at IS NULL;
CREATE INDEX user_roles_user ON private.user_roles (user_id);
CREATE INDEX user_roles_granted_by ON private.user_roles (granted_by);
CREATE INDEX user_roles_role ON private.user_roles (role_id);

-- Defense in depth: the administrator role can only be granted by the migrator/maintenance path,
-- never by a runtime role, even if application authorization were bypassed.
CREATE FUNCTION private.guard_admin_grant() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role_id = 'administrator'
     AND current_user <> 'makarba_migrator'
     AND NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'administrator grants are restricted to the maintenance path' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER user_roles_guard_admin
  BEFORE INSERT OR UPDATE OF role_id ON private.user_roles
  FOR EACH ROW EXECUTE FUNCTION private.guard_admin_grant();
