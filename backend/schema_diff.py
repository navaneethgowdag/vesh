"""Diff SQLAlchemy model metadata against the live Neon schema.

Read-only. Run: python schema_diff.py
Exit code 0 = in sync, 1 = drift found.
"""
import re
import socket
import time

import psycopg
from sqlalchemy import create_engine, inspect

from app.core.config import settings
from app.models import Base  # noqa: F401  (import registers all mappers)

PUBLIC_DNS = ["8.8.8.8", "1.1.1.1", "9.9.9.9"]


def resolve_ipv4(host: str, attempts: int = 8) -> str:
    last_err = None
    for i in range(attempts):
        try:
            return socket.gethostbyname(host)
        except socket.gaierror as e:
            last_err = e
        try:
            import dns.resolver

            r = dns.resolver.Resolver()
            r.nameservers = PUBLIC_DNS
            r.timeout, r.lifetime = 3, 4
            for a in r.resolve(host, "A"):
                return a.to_text()
        except Exception as e:  # noqa: BLE001
            last_err = e
        time.sleep(1.0 + i * 0.5)
    raise RuntimeError(f"could not resolve {host}: {last_err}")


url = settings.sync_database_url
m = re.search(r"://[^:]+:[^@]+@([^:/]+)(?::(\d+))?/", url)
host, port = m.group(1), m.group(2) or "5432"
ip = resolve_ipv4(host)

engine = create_engine(
    url,
    connect_args={"hostaddr": ip, "options": "-c role=authenticated"},
)
model_tables = set(Base.metadata.tables)

with engine.connect() as conn:
    print("== session role ==", conn.exec_driver_sql("SELECT current_user").scalar())
    insp = inspect(conn)
    db_tables = set(insp.get_table_names(schema="public"))

db_tables = set(insp.get_table_names(schema="public"))

print("== alembic ==")
print(f"  alembic_version table present : {'alembic_version' in db_tables}")
db_tables = db_tables - {"alembic_version"}

print("\n== tables ==")
missing = sorted(model_tables - db_tables)
extra = sorted(db_tables - model_tables)
print(f"  model tables : {len(model_tables)}")
print(f"  db tables    : {len(db_tables)}")
for t in sorted(model_tables & db_tables):
    pass  # intersection reported per-column below
if missing:
    print("  MISSING in DB :", missing)
if extra:
    print("  EXTRA in DB   :", extra)
if not missing and not extra:
    print("  table set     : MATCH")

print("\n== column diff for shared tables ==")
any_drift = False
for table in sorted(model_tables & db_tables):
    model_cols = {c.name for c in Base.metadata.tables[table].columns}
    db_cols = set(insp.get_columns(table, schema="public"))
    miss = sorted(model_cols - db_cols)
    ext = sorted(db_cols - model_cols)
    if miss or ext:
        any_drift = True
        print(f"  {table}:")
        if miss:
            print(f"      missing in DB : {miss}")
        if ext:
            print(f"      extra in DB   : {ext}")

if not any_drift:
    print("  all shared tables: columns MATCH")

raise SystemExit(1 if (missing or any_drift) else 0)
