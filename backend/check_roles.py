from sqlalchemy import text
from app.core.database import engine

with engine.connect() as conn:
    roles = conn.execute(text("SELECT rolname FROM pg_roles;")).fetchall()
    print("Database roles:", [r[0] for r in roles])

