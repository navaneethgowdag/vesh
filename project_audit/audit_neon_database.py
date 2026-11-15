"""
Comprehensive PostgreSQL Database & Indexing Audit for TailorBird (Neon PostgreSQL)
Queries pg_catalog, pg_stat_user_tables, pg_stat_user_indexes, pg_constraint, pg_indexes.
Uses autocommit mode so failed queries do not abort subsequent queries.
"""
import json
from sqlalchemy import text
from app.core.database import engine

def run_catalog_audit():
    audit_data = {}
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        # 1. Database & Version info
        db_info = conn.execute(text("""
            SELECT current_database(), current_user, version()
        """)).fetchone()
        audit_data["database_info"] = {
            "database": db_info[0],
            "user": db_info[1],
            "version": db_info[2]
        }

        # 2. Check extensions
        exts = conn.execute(text("""
            SELECT extname, extversion FROM pg_extension ORDER BY extname
        """)).fetchall()
        audit_data["extensions"] = [{"name": e[0], "version": e[1]} for e in exts]

        # 3. Check alembic_version
        try:
            alembic_rev = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
            audit_data["alembic_versions"] = [r[0] for r in alembic_rev]
        except Exception as e:
            audit_data["alembic_versions"] = f"Table absent: {str(e).splitlines()[0]}"

        # 4. Tables with row counts and sizes
        tables_query = conn.execute(text("""
            SELECT 
                c.relname AS table_name,
                c.reltuples::bigint AS estimated_rows,
                pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
                pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
                pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size,
                pg_total_relation_size(c.oid) AS total_bytes,
                pg_relation_size(c.oid) AS table_bytes,
                pg_indexes_size(c.oid) AS indexes_bytes
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
            ORDER BY c.relname
        """)).fetchall()
        
        tables_list = []
        for row in tables_query:
            tname = row[0]
            try:
                exact_count = conn.execute(text(f'SELECT count(*) FROM public."{tname}"')).scalar()
            except Exception as e:
                exact_count = f"Error: {e}"
            tables_list.append({
                "table_name": tname,
                "exact_rows": exact_count,
                "estimated_rows": row[1],
                "total_size": row[2],
                "table_size": row[3],
                "indexes_size": row[4],
                "total_bytes": row[5],
                "table_bytes": row[6],
                "indexes_bytes": row[7]
            })
        audit_data["tables"] = tables_list

        # 5. Columns by table
        columns_query = conn.execute(text("""
            SELECT 
                table_name,
                column_name,
                data_type,
                udt_name,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        """)).fetchall()
        
        cols_by_table = {}
        for c in columns_query:
            tname = c[0]
            if tname not in cols_by_table:
                cols_by_table[tname] = []
            cols_by_table[tname].append({
                "column_name": c[1],
                "data_type": c[2],
                "udt_name": c[3],
                "is_nullable": c[4],
                "column_default": c[5]
            })
        audit_data["columns_by_table"] = cols_by_table

        # 6. Existing Indexes
        indexes_query = conn.execute(text("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname
        """)).fetchall()
        
        indexes_list = []
        for idx in indexes_query:
            indexes_list.append({
                "table_name": idx[1],
                "index_name": idx[2],
                "index_def": idx[3]
            })
        audit_data["existing_indexes"] = indexes_list

        # 7. Index usage stats
        idx_stats_query = conn.execute(text("""
            SELECT 
                relname AS table_name,
                indexrelname AS index_name,
                idx_scan,
                idx_tup_read,
                idx_tup_fetch
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            ORDER BY relname, indexrelname
        """)).fetchall()
        audit_data["index_stats"] = [
            {
                "table_name": s[0],
                "index_name": s[1],
                "idx_scan": s[2],
                "idx_tup_read": s[3],
                "idx_tup_fetch": s[4]
            } for s in idx_stats_query
        ]

        # 8. Table scan stats (Seq scans vs Index scans)
        tbl_stats_query = conn.execute(text("""
            SELECT 
                relname AS table_name,
                seq_scan,
                seq_tup_read,
                idx_scan,
                idx_tup_fetch,
                n_tup_ins,
                n_tup_upd,
                n_tup_del,
                n_live_tup,
                n_dead_tup
            FROM pg_stat_user_tables
            WHERE schemaname = 'public'
            ORDER BY relname
        """)).fetchall()
        audit_data["table_stats"] = [
            {
                "table_name": s[0],
                "seq_scan": s[1],
                "seq_tup_read": s[2],
                "idx_scan": s[3],
                "idx_tup_fetch": s[4],
                "n_tup_ins": s[5],
                "n_tup_upd": s[6],
                "n_tup_del": s[7],
                "n_live_tup": s[8],
                "n_dead_tup": s[9]
            } for s in tbl_stats_query
        ]

        # 9. Constraints (Primary Keys, Foreign Keys, Unique constraints)
        constraints_query = conn.execute(text("""
            SELECT
                tc.table_name,
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            LEFT JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position
        """)).fetchall()
        
        audit_data["constraints"] = [
            {
                "table_name": c[0],
                "constraint_name": c[1],
                "constraint_type": c[2],
                "column_name": c[3],
                "foreign_table_name": c[4],
                "foreign_column_name": c[5]
            } for c in constraints_query
        ]

        # 10. Foreign keys check: Which FK columns lack an index starting with that column?
        fk_unindexed_query = conn.execute(text("""
            WITH fk_cols AS (
                SELECT
                    conrelid::regclass::text AS table_name,
                    conname AS fk_name,
                    attname AS column_name
                FROM pg_constraint c
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
            ),
            indexed_leading_cols AS (
                SELECT
                    indrelid::regclass::text AS table_name,
                    a.attname AS leading_column
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
                JOIN pg_class c ON c.oid = i.indrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
            )
            SELECT 
                f.table_name,
                f.fk_name,
                f.column_name
            FROM fk_cols f
            LEFT JOIN indexed_leading_cols idx 
              ON idx.table_name = f.table_name 
             AND idx.leading_column = f.column_name
            WHERE idx.leading_column IS NULL
            ORDER BY f.table_name, f.column_name
        """)).fetchall()
        audit_data["unindexed_foreign_keys"] = [
            {
                "table_name": row[0],
                "fk_name": row[1],
                "column_name": row[2]
            } for row in fk_unindexed_query
        ]

        # 11. Overlapping or duplicate indexes (fetch index keys and compare in Python)
        try:
            raw_indexes = conn.execute(text("""
                SELECT 
                    tbl.relname AS table_name,
                    i.relname AS index_name,
                    idx.indkey::text AS indkey_str,
                    idx.indisunique,
                    pg_get_indexdef(idx.indexrelid) AS index_def
                FROM pg_index idx
                JOIN pg_class i ON i.oid = idx.indexrelid
                JOIN pg_class tbl ON tbl.oid = idx.indrelid
                JOIN pg_namespace n ON n.oid = tbl.relnamespace
                WHERE n.nspname = 'public'
                ORDER BY tbl.relname, i.relname
            """)).fetchall()

            indexes_by_table = {}
            for r in raw_indexes:
                tname, iname, ikey_str, is_uniq, idef = r[0], r[1], r[2], r[3], r[4]
                if tname not in indexes_by_table:
                    indexes_by_table[tname] = []
                indexes_by_table[tname].append({
                    "name": iname,
                    "keys": [int(k) for k in ikey_str.split() if k.isdigit() and int(k) > 0],
                    "is_unique": is_uniq,
                    "def": idef
                })

            overlapping = []
            for tname, idcs in indexes_by_table.items():
                for idx_a in range(len(idcs)):
                    for idx_b in range(idx_a + 1, len(idcs)):
                        ia = idcs[idx_a]
                        ib = idcs[idx_b]
                        keys_a = ia["keys"]
                        keys_b = ib["keys"]
                        if not keys_a or not keys_b:
                            continue
                        if keys_a == keys_b:
                            overlapping.append({
                                "table_name": tname,
                                "type": "EXACT_DUPLICATE",
                                "index1": ia["name"],
                                "index2": ib["name"],
                                "index1_def": ia["def"],
                                "index2_def": ib["def"]
                            })
                        elif len(keys_a) < len(keys_b) and keys_b[:len(keys_a)] == keys_a:
                            overlapping.append({
                                "table_name": tname,
                                "type": "PREFIX_OVERLAP",
                                "index1": ia["name"],
                                "index2": ib["name"],
                                "description": f"{ia['name']} is a leading prefix of {ib['name']}",
                                "index1_def": ia["def"],
                                "index2_def": ib["def"]
                            })
                        elif len(keys_b) < len(keys_a) and keys_a[:len(keys_b)] == keys_b:
                            overlapping.append({
                                "table_name": tname,
                                "type": "PREFIX_OVERLAP",
                                "index1": ib["name"],
                                "index2": ia["name"],
                                "description": f"{ib['name']} is a leading prefix of {ia['name']}",
                                "index1_def": ib["def"],
                                "index2_def": ia["def"]
                            })
            audit_data["overlapping_indexes"] = overlapping
        except Exception as e:
            audit_data["overlapping_indexes"] = f"Error: {e}"

        # 12. pg_stat_statements check
        try:
            stat_stmt_check = conn.execute(text("""
                SELECT query, calls, total_exec_time, mean_exec_time, rows
                FROM pg_stat_statements
                ORDER BY total_exec_time DESC
                LIMIT 15
            """)).fetchall()
            audit_data["pg_stat_statements"] = [
                {
                    "query": s[0][:150],
                    "calls": s[1],
                    "total_exec_time_ms": s[2],
                    "mean_exec_time_ms": s[3],
                    "rows": s[4]
                } for s in stat_stmt_check
            ]
        except Exception as e:
            audit_data["pg_stat_statements"] = f"Not available or accessible: {str(e).splitlines()[0]}"

    with open("project_audit/neon_database_audit_result.json", "w", encoding="utf-8") as f:
        json.dump(audit_data, f, indent=2)
    print("SUCCESS: Wrote project_audit/neon_database_audit_result.json")

if __name__ == "__main__":
    run_catalog_audit()
