-- Issue #36 privilege tests. Run as a superuser against a database that already ran
-- db/bootstrap/*.sql:  psql -v ON_ERROR_STOP=1 -f db/tests/001_privileges.sql
-- Uses only synthetic tables. Every check raises an exception on failure.
SET client_min_messages = warning;

-- Synthetic fixtures created as the migrator (the only role allowed DDL).
SET ROLE makarba_migrator;
DROP TABLE IF EXISTS private.synthetic_interviews, published.synthetic_places, published.synthetic_later, audit.synthetic_events;
CREATE TABLE private.synthetic_interviews (id int PRIMARY KEY, note text);
CREATE TABLE published.synthetic_places   (id int PRIMARY KEY, name text);
CREATE TABLE audit.synthetic_events       (id int PRIMARY KEY, action text);
INSERT INTO private.synthetic_interviews VALUES (1, 'synthetic');
INSERT INTO published.synthetic_places   VALUES (1, 'synthetic');
RESET ROLE;

CREATE FUNCTION pg_temp.expect_denied(as_role text, stmt text) RETURNS void AS $f$
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', as_role);
  BEGIN
    EXECUTE stmt;
    RAISE EXCEPTION 'ESCALATION: % was allowed to run: %', as_role, stmt USING ERRCODE = 'P0001';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: permission denied
  END;
  RESET ROLE;
END $f$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.expect_allowed(as_role text, stmt text) RETURNS void AS $f$
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', as_role);
  EXECUTE stmt;
  RESET ROLE;
END $f$ LANGUAGE plpgsql;

BEGIN;
-- 1. No runtime role is privileged and bootstrap enables no login.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('makarba_migrator','makarba_private_api','makarba_public_api','makarba_worker')
             AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication)) THEN
    RAISE EXCEPTION 'a makarba role has a dangerous attribute';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('makarba_migrator','makarba_private_api','makarba_public_api','makarba_worker') AND rolcanlogin) THEN
    RAISE EXCEPTION 'bootstrap must not enable login (deployment vault does)';
  END IF;
END $$;

-- 1b. No role can switch into another (SET ROLE needs membership; checked from the catalog,
-- because this test session is a superuser and SET ROLE would always succeed here).
DO $$ DECLARE a text; b text; BEGIN
  FOR a IN SELECT rolname FROM pg_roles WHERE rolname IN ('makarba_migrator','makarba_private_api','makarba_public_api','makarba_worker') LOOP
    FOR b IN SELECT rolname FROM pg_roles WHERE rolname IN ('makarba_migrator','makarba_private_api','makarba_public_api','makarba_worker') AND rolname <> a LOOP
      IF pg_has_role(a, b, 'MEMBER') THEN RAISE EXCEPTION 'ESCALATION: % can become %', a, b; END IF;
    END LOOP;
  END LOOP;
END $$;

-- 2. Public API role: published read only, nothing else.
SELECT pg_temp.expect_allowed('makarba_public_api', 'SELECT * FROM published.synthetic_places');
SELECT pg_temp.expect_denied('makarba_public_api', 'SELECT * FROM private.synthetic_interviews');
SELECT pg_temp.expect_denied('makarba_public_api', 'SELECT * FROM audit.synthetic_events');
SELECT pg_temp.expect_denied('makarba_public_api', 'INSERT INTO published.synthetic_places VALUES (2, ''x'')');
SELECT pg_temp.expect_denied('makarba_public_api', 'UPDATE published.synthetic_places SET name = ''x''');
SELECT pg_temp.expect_denied('makarba_public_api', 'DELETE FROM published.synthetic_places');
SELECT pg_temp.expect_denied('makarba_public_api', 'CREATE TABLE published.evil (id int)');
SELECT pg_temp.expect_denied('makarba_public_api', 'CREATE TABLE public.evil (id int)');
SELECT pg_temp.expect_denied('makarba_public_api', 'CREATE SCHEMA evil');
SELECT pg_temp.expect_denied('makarba_public_api', 'DROP TABLE published.synthetic_places');
SELECT pg_temp.expect_denied('makarba_public_api', 'TRUNCATE published.synthetic_places');
SELECT pg_temp.expect_denied('makarba_public_api', 'CREATE ROLE evil');
SELECT pg_temp.expect_denied('makarba_public_api', 'CREATE EXTENSION IF NOT EXISTS hstore');
SELECT pg_temp.expect_denied('makarba_public_api', 'ALTER ROLE makarba_public_api SUPERUSER');

-- 3. Private (field) API role: DML on private, read published, append audit; no DDL, no publishing.
SELECT pg_temp.expect_allowed('makarba_private_api', 'SELECT * FROM private.synthetic_interviews');
SELECT pg_temp.expect_allowed('makarba_private_api', 'INSERT INTO private.synthetic_interviews VALUES (2, ''synthetic'')');
SELECT pg_temp.expect_allowed('makarba_private_api', 'UPDATE private.synthetic_interviews SET note = ''edited'' WHERE id = 2');
SELECT pg_temp.expect_allowed('makarba_private_api', 'INSERT INTO audit.synthetic_events VALUES (1, ''read'')');
SELECT pg_temp.expect_allowed('makarba_private_api', 'SELECT * FROM published.synthetic_places');
SELECT pg_temp.expect_denied('makarba_private_api', 'DELETE FROM private.synthetic_interviews');
SELECT pg_temp.expect_denied('makarba_private_api', 'INSERT INTO published.synthetic_places VALUES (3, ''x'')');
SELECT pg_temp.expect_denied('makarba_private_api', 'UPDATE published.synthetic_places SET name = ''x''');
SELECT pg_temp.expect_denied('makarba_private_api', 'SELECT * FROM audit.synthetic_events');
SELECT pg_temp.expect_denied('makarba_private_api', 'UPDATE audit.synthetic_events SET action = ''x''');
SELECT pg_temp.expect_denied('makarba_private_api', 'CREATE TABLE private.evil (id int)');
SELECT pg_temp.expect_denied('makarba_private_api', 'ALTER TABLE private.synthetic_interviews ADD COLUMN evil int');
SELECT pg_temp.expect_denied('makarba_private_api', 'DROP TABLE private.synthetic_interviews');
SELECT pg_temp.expect_denied('makarba_private_api', 'TRUNCATE private.synthetic_interviews');
SELECT pg_temp.expect_denied('makarba_private_api', 'CREATE SCHEMA evil');
-- A non-owner GRANT only warns (no privileges granted); prove it had no effect.
SELECT pg_temp.expect_allowed('makarba_private_api', 'GRANT SELECT ON private.synthetic_interviews TO makarba_public_api');
SELECT pg_temp.expect_denied('makarba_public_api', 'SELECT * FROM private.synthetic_interviews');

-- 4. Worker: reads private, writes the public projection only.
SELECT pg_temp.expect_allowed('makarba_worker', 'SELECT * FROM private.synthetic_interviews');
SELECT pg_temp.expect_allowed('makarba_worker', 'INSERT INTO published.synthetic_places VALUES (4, ''synthetic'')');
SELECT pg_temp.expect_allowed('makarba_worker', 'DELETE FROM published.synthetic_places WHERE id = 4');
SELECT pg_temp.expect_denied('makarba_worker', 'UPDATE private.synthetic_interviews SET note = ''x''');
SELECT pg_temp.expect_denied('makarba_worker', 'INSERT INTO private.synthetic_interviews VALUES (9, ''x'')');
SELECT pg_temp.expect_denied('makarba_worker', 'CREATE TABLE published.evil (id int)');

-- 5. Migrator is the only DDL role, but has no superuser powers.
SELECT pg_temp.expect_allowed('makarba_migrator', 'CREATE TABLE private.ddl_probe (id int)');
SELECT pg_temp.expect_allowed('makarba_migrator', 'DROP TABLE private.ddl_probe');
SELECT pg_temp.expect_denied('makarba_migrator', 'CREATE ROLE evil');
SELECT pg_temp.expect_denied('makarba_migrator', 'CREATE EXTENSION IF NOT EXISTS hstore');

-- 6. Default privileges apply to tables created by later migrations.
SET LOCAL ROLE makarba_migrator;
CREATE TABLE published.synthetic_later (id int);
RESET ROLE;
SELECT pg_temp.expect_allowed('makarba_public_api', 'SELECT * FROM published.synthetic_later');

-- 7. Pool limits are configured.
DO $$ BEGIN
  IF (SELECT rolconnlimit FROM pg_roles WHERE rolname = 'makarba_public_api') NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'public role connection limit missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
                 WHERE r.rolname = 'makarba_public_api' AND s.setconfig::text LIKE '%statement_timeout=5s%') THEN
    RAISE EXCEPTION 'public role statement_timeout missing';
  END IF;
END $$;
ROLLBACK;

-- Cleanup of synthetic fixtures.
SET ROLE makarba_migrator;
DROP TABLE IF EXISTS private.synthetic_interviews, published.synthetic_places, published.synthetic_later, audit.synthetic_events;
RESET ROLE;
SELECT 'ALL PRIVILEGE CHECKS PASSED' AS result;
