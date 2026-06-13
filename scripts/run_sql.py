"""Ejecuta un archivo .sql contra la BD usando pg8000 (puro Python, SSL para Supabase).

Uso:
    DATABASE_URL="postgresql://..." python scripts/run_sql.py supabase/migrations/0003_import_hash.sql

Pensado para migraciones simples (sentencias separadas por ';', sin ';' dentro de strings).
"""
import os
import re
import ssl
import sys

import pg8000.dbapi


def get_conn():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("ERROR: define DATABASE_URL"); sys.exit(1)
    m = re.match(
        r"postgres(?:ql)?://(?P<u>[^:]+):(?P<p>[^@]+)@(?P<h>[^:/]+)(?::(?P<port>\d+))?/(?P<db>[^?]+)",
        url,
    )
    if not m:
        print("ERROR: DATABASE_URL con formato inválido"); sys.exit(1)
    d = m.groupdict()
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.dbapi.connect(
        user=d["u"], password=d["p"], host=d["h"],
        port=int(d["port"] or 5432), database=d["db"], ssl_context=ctx,
    )


def main():
    if len(sys.argv) < 2:
        print("uso: run_sql.py <archivo.sql>"); sys.exit(1)
    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    lines = [ln for ln in raw.split("\n") if not ln.strip().startswith("--")]
    statements = [s.strip() for s in "\n".join(lines).split(";") if s.strip()]

    conn = get_conn()
    cur = conn.cursor()
    try:
        for st in statements:
            cur.execute(st)
        conn.commit()
        print(f"OK: {len(statements)} sentencias ejecutadas desde {path}")
    except Exception as e:
        conn.rollback()
        print(f"ERROR ejecutando {path}: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
