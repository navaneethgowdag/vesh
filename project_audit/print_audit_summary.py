import json

with open('project_audit/neon_database_audit_result.json', encoding='utf-8') as f:
    data = json.load(f)

print("=== 1. DATABASE INFO ===")
print("DB Info:", data['database_info'])
print("Alembic version in DB:", data.get('alembic_versions'))
print("Installed Extensions:", [e['name'] for e in data.get('extensions', [])])
print("pg_stat_statements:", data.get('pg_stat_statements'))

print("\n=== 2. TABLES IN PUBLIC SCHEMA (17 Total) ===")
print(f"{'Table':<25} {'Rows':<8} {'Total Size':<12} {'Table Size':<12} {'Index Size':<12}")
print("-" * 70)
total_db_bytes = 0
for t in data['tables']:
    total_db_bytes += t['total_bytes']
    print(f"{t['table_name']:<25} {str(t['exact_rows']):<8} {t['total_size']:<12} {t['table_size']:<12} {t['indexes_size']:<12}")
print(f"Total Public DB Size: {total_db_bytes / (1024*1024):.2f} MB")

print("\n=== 3. UNINDEXED FOREIGN KEYS ===")
unindexed_fks = data.get('unindexed_foreign_keys', [])
print(f"Total unindexed FKs found: {len(unindexed_fks)}")
for fk in unindexed_fks:
    print(f"  • {fk['table_name']}.{fk['column_name']}  (FK constraint: {fk['fk_name']})")

print("\n=== 4. OVERLAPPING / DUPLICATE INDEXES ===")
overlaps = data.get('overlapping_indexes', [])
print(f"Total overlapping index pairs found: {len(overlaps)}")
for ov in overlaps:
    print(f"  • {ov['table_name']}: [{ov['type']}] {ov['index1']} vs {ov['index2']}")
    print(f"      index1: {ov['index1_def']}")
    print(f"      index2: {ov['index2_def']}")

print("\n=== 5. EXISTING INDEXES PER TABLE ===")
indexes_by_tbl = {}
for idx in data.get('existing_indexes', []):
    t = idx['table_name']
    indexes_by_tbl.setdefault(t, []).append(idx)

for t, idcs in sorted(indexes_by_tbl.items()):
    print(f"\n[{t}] ({len(idcs)} indexes):")
    for idx in idcs:
        print(f"   - {idx['index_name']}: {idx['index_def']}")

print("\n=== 6. TABLE SCAN STATS (Seq Scans vs Index Scans) ===")
for ts in data.get('table_stats', []):
    print(f"{ts['table_name']:<25} SeqScans: {ts['seq_scan']:<6} IdxScans: {ts['idx_scan']:<6} LiveTup: {ts['n_live_tup']:<6} Ins: {ts['n_tup_ins']:<6} Upd: {ts['n_tup_upd']:<6}")
