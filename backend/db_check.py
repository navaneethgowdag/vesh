"""Database privilege diagnostics (read-only). Run: python db_check.py"""
from sqlalchemy import text
from app.core.database import engine

PUB = "public"

with engine.connect() as conn:
    print("current_user:", conn.execute(text("SELECT current_user")).scalar())
    print("is_superuser:", conn.execute(text("SELECT rolsuper FROM pg_roles WHERE rolname = current_user")).scalar())
    row = conn.execute(
        text("SELECT nspowner::regrole FROM pg_namespace WHERE nspname = :s"),
        {"s": PUB},
    ).scalar()
    print("schema public owner:", row)
    print(
        "has CREATE on public:",
        conn.execute(
            text("SELECT has_schema_privilege(current_user, :s, 'CREATE')"),
            {"s": PUB},
        ).scalar(),
    )
    print(
        "has USAGE on public:",
        conn.execute(
            text("SELECT has_schema_privilege(current_user, :s, 'USAGE')"),
            {"s": PUB},
        ).scalar(),
    )
    tables = conn.execute(
        text("SELECT table_name FROM information_schema.tables WHERE table_schema = :s ORDER BY table_name"),
        {"s": PUB},
    ).fetchall()
    print("tables in public:", [r[0] for r in tables])
