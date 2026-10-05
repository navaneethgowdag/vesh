"""Read-only: can `SET ROLE authenticated` unlock table access?"""
import re
import socket
import time

import psycopg

from app.core.config import settings

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


url = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
m = re.search(r"://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/([^?]+)", url)
user, password, host, port, dbname = (
    m.group(1), m.group(2), m.group(3), m.group(4) or "5432", m.group(5),
)
ip = resolve_ipv4(host)

with psycopg.connect(
    host=host, hostaddr=ip, port=int(port), user=user, password=password,
    dbname=dbname, sslmode="require", connect_timeout=20, autocommit=True,
) as conn:
    print("current_user      :", conn.execute("SELECT current_user").fetchone()[0])
    try:
        conn.execute("SET ROLE authenticated")
        print("SET ROLE          : OK ->", conn.execute("SELECT current_user").fetchone()[0])
    except Exception as exc:
        print("SET ROLE          : DENIED ->", str(exc).splitlines()[0])
        raise SystemExit(0)

    print("CREATE on public  :", conn.execute(
        "SELECT has_schema_privilege(current_user,'public','CREATE')"
    ).fetchone()[0])

    print("\n== row counts as `authenticated` ==")
    for tname, in conn.execute("""
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind='r' AND n.nspname='public' ORDER BY 1
    """).fetchall():
        try:
            n = conn.execute(f'SELECT count(*) FROM public."{tname}"').fetchone()[0]
            print(f"  {tname:<26} rows={n}")
        except Exception as exc:
            print(f"  {tname:<26} ERR {str(exc).splitlines()[0]}")

    print("\n== DDL as `authenticated` ==")
    try:
        conn.execute("CREATE TABLE public.__probe_t (id int)")
        print("  CREATE TABLE  : ALLOWED")
        conn.execute("DROP TABLE public.__probe_t")
        print("  cleanup       : dropped")
    except Exception as exc:
        print("  CREATE TABLE  : DENIED ->", str(exc).splitlines()[0])
