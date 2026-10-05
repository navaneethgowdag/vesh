-- ===========================================================================
-- StyleSphere one-time database setup (run in Neon SQL Editor as the OWNER)
-- ---------------------------------------------------------------------------
-- The application role `authenticator` can read/write data (USAGE on public)
-- but cannot create schema. Run this once as the database owner so the app can
-- manage its own tables through Alembic migrations afterward.
-- ===========================================================================

-- 1) Allow the app role to create tables in the application schema.
GRANT CREATE ON SCHEMA public TO authenticator;

-- 2) Belt-and-suspenders: let the app role use any tables/sequences created by
--    the owner in this database (covers seed or admin-created objects).
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticator;
