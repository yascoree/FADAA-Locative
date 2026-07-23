from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    print([(r[0], r[1]) for r in conn.execute(text("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')")).fetchall()])
