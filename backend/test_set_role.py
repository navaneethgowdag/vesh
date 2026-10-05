from sqlalchemy import text
from app.core.database import engine

with engine.connect() as conn:
    for r in ['neondb_owner', 'neon_auth', 'authenticated', 'neon_superuser']:
        try:
            conn.execute(text(f"SET ROLE {r}"))
            print(f"Successfully switched to role: {r}")
            # Try create table
            conn.execute(text("CREATE TABLE IF NOT EXISTS test_table (id int)"))
            print("Successfully created test table under role:", r)
            conn.execute(text("DROP TABLE test_table"))
            break
        except Exception as e:
            print(f"Cannot switch to or create under role {r}: {e}")

