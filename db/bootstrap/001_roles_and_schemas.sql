-- Issue #36: least-privilege roles and schemas. Run once per database by a superuser
-- (deployment bootstrap). Idempotent. Contains NO passwords: roles are created NOLOGIN;
-- the deployment vault enables login per environment, e.g.
--   ALTER ROLE makarba_public_api LOGIN PASSWORD '<from vault>';
-- Roles:
--   makarba_migrator    owns schemas, runs migrations (DDL). Used only by the deploy job.
--   makarba_private_api private/field API runtime: DML on private schema, read-only on published.
--   makarba_public_api  public read-only API runtime: SELECT on published only.
--   makarba_worker      publication/media worker: reads private, writes published.
-- Runtime roles can never run DDL, create roles/databases, bypass RLS or become another role.

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['makarba_migrator','makarba_private_api','makarba_public_api','makarba_worker'] LOOP
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT', r);
    ELSE
      EXECUTE format('ALTER ROLE %I NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', r);
    END IF;
  END LOOP;
END $$;

-- Pool-safety limits on runtime roles (the public role is the tightest).
ALTER ROLE makarba_public_api  SET statement_timeout = '5s';
ALTER ROLE makarba_public_api  SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE makarba_public_api  CONNECTION LIMIT 20;
ALTER ROLE makarba_private_api SET statement_timeout = '30s';
ALTER ROLE makarba_private_api SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE makarba_private_api CONNECTION LIMIT 40;
ALTER ROLE makarba_worker      SET statement_timeout = '120s';
ALTER ROLE makarba_worker      SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE makarba_worker      CONNECTION LIMIT 10;

-- Extensions are provisioned by the superuser so the migrator never needs that power.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Database and default schema lock-down.
DO $$ BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO makarba_migrator, makarba_private_api, makarba_public_api, makarba_worker', current_database());
END $$;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
-- PostGIS functions live in public.
GRANT USAGE ON SCHEMA public TO makarba_migrator, makarba_private_api, makarba_public_api, makarba_worker;

CREATE SCHEMA IF NOT EXISTS private   AUTHORIZATION makarba_migrator;  -- restricted source records
CREATE SCHEMA IF NOT EXISTS published AUTHORIZATION makarba_migrator;  -- allowlisted public projection
CREATE SCHEMA IF NOT EXISTS audit     AUTHORIZATION makarba_migrator;  -- non-content security audit
CREATE SCHEMA IF NOT EXISTS migrations AUTHORIZATION makarba_migrator; -- migration ledger; no runtime access
REVOKE ALL ON SCHEMA private, published, audit, migrations FROM PUBLIC;

GRANT USAGE ON SCHEMA private   TO makarba_private_api, makarba_worker;
GRANT USAGE ON SCHEMA published TO makarba_private_api, makarba_public_api, makarba_worker;
GRANT USAGE ON SCHEMA audit     TO makarba_private_api, makarba_worker;
-- makarba_public_api has no privilege of any kind on private or audit.

-- Privileges for objects the migrator creates later (so each migration need not re-grant).
-- No DELETE on private for the API: withdrawal is a controlled workflow, not an ad-hoc delete.
ALTER DEFAULT PRIVILEGES FOR ROLE makarba_migrator IN SCHEMA private
  GRANT SELECT, INSERT, UPDATE ON TABLES TO makarba_private_api;
ALTER DEFAULT PRIVILEGES FOR ROLE makarba_migrator IN SCHEMA private
  GRANT SELECT ON TABLES TO makarba_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE makarba_migrator IN SCHEMA private
  GRANT USAGE, SELECT ON SEQUENCES TO makarba_private_api;
ALTER DEFAULT PRIVILEGES FOR ROLE makarba_migrator IN SCHEMA published
  GRANT SELECT ON TABLES TO makarba_public_api, makarba_private_api;
ALTER DEFAULT PRIVILEGES FOR ROLE makarba_migrator IN SCHEMA published
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO makarba_worker;
-- Audit is append-only for runtime roles.
ALTER DEFAULT PRIVILEGES FOR ROLE makarba_migrator IN SCHEMA audit
  GRANT INSERT ON TABLES TO makarba_private_api, makarba_worker;
