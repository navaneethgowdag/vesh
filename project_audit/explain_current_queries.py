"""
Captures baseline EXPLAIN (ANALYZE, BUFFERS) for all core queries in TailorBird on Neon PostgreSQL.
"""
import json
from sqlalchemy import text
from app.core.database import get_engine, verify_database_connection

def run_query_analysis():
    verify_database_connection(fast=False)
    active_engine = get_engine()
    results = {}
    with active_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        # Pick real representative user_id, post_id, outfit_id, clothing_id from DB
        sample_user_id = conn.execute(text("SELECT id FROM users ORDER BY created_at DESC LIMIT 1")).scalar()
        sample_post_id = conn.execute(text("SELECT id FROM posts ORDER BY created_at DESC LIMIT 1")).scalar()
        sample_clothing_id = conn.execute(text("SELECT id FROM clothing ORDER BY created_at DESC LIMIT 1")).scalar()
        sample_outfit_id = conn.execute(text("SELECT id FROM outfits ORDER BY created_at DESC LIMIT 1")).scalar()

        print(f"Sample IDs: user={sample_user_id}, post={sample_post_id}, clothing={sample_clothing_id}, outfit={sample_outfit_id}")

        queries = [
            (
                "wardrobe_list_user",
                "SELECT id, name, category, created_at FROM clothing WHERE user_id = :uid ORDER BY created_at DESC LIMIT 100",
                {"uid": str(sample_user_id)}
            ),
            (
                "wardrobe_filter_category",
                "SELECT id, name, category, created_at FROM clothing WHERE user_id = :uid AND category = 'Tops' ORDER BY created_at DESC LIMIT 100",
                {"uid": str(sample_user_id)}
            ),
            (
                "post_feed_global",
                "SELECT id, user_id, caption, created_at FROM posts WHERE caption NOT LIKE '[MOMENT:%' ORDER BY created_at DESC LIMIT 30",
                {}
            ),
            (
                "post_list_by_user",
                "SELECT id, user_id, caption, created_at FROM posts WHERE user_id = :uid AND caption NOT LIKE '[MOMENT:%' ORDER BY created_at DESC LIMIT 30",
                {"uid": str(sample_user_id)}
            ),
            (
                "moments_user_active",
                "SELECT id, user_id, caption, created_at FROM posts WHERE user_id = :uid AND caption LIKE '[MOMENT:24H:%' AND created_at >= NOW() - INTERVAL '24 hours' ORDER BY created_at DESC",
                {"uid": str(sample_user_id)}
            ),
            (
                "moments_discovery_feed",
                """
                SELECT id, user_id, caption, created_at 
                FROM posts 
                WHERE caption LIKE '[MOMENT:24H:%' 
                  AND created_at >= NOW() - INTERVAL '24 hours'
                  AND user_id IN (SELECT following_id FROM follows WHERE follower_id = :uid)
                ORDER BY created_at DESC LIMIT 30
                """,
                {"uid": str(sample_user_id)}
            ),
            (
                "followers_count",
                "SELECT count(*) FROM follows WHERE following_id = :uid",
                {"uid": str(sample_user_id)}
            ),
            (
                "following_list",
                "SELECT following_id FROM follows WHERE follower_id = :uid",
                {"uid": str(sample_user_id)}
            ),
            (
                "comments_by_post",
                "SELECT id, user_id, content, created_at FROM comments WHERE post_id = :pid ORDER BY created_at ASC",
                {"pid": str(sample_post_id) if sample_post_id else "00000000-0000-0000-0000-000000000000"}
            ),
            (
                "likes_count_by_post",
                "SELECT count(*) FROM likes WHERE post_id = :pid",
                {"pid": str(sample_post_id) if sample_post_id else "00000000-0000-0000-0000-000000000000"}
            ),
            (
                "notifications_list_user",
                "SELECT id, type, title, is_read, created_at FROM notifications WHERE user_id = :uid ORDER BY created_at DESC LIMIT 50",
                {"uid": str(sample_user_id)}
            ),
            (
                "notifications_unread_count",
                "SELECT count(*) FROM notifications WHERE user_id = :uid AND is_read = false",
                {"uid": str(sample_user_id)}
            ),
            (
                "recommendations_active_occasion",
                """
                SELECT id, outfit_id, occasion, recommendation_score, created_at 
                FROM recommendations 
                WHERE user_id = :uid AND occasion = 'Casual Daily' AND created_at >= NOW() - INTERVAL '24 hours'
                ORDER BY created_at DESC LIMIT 1
                """,
                {"uid": str(sample_user_id)}
            ),
            (
                "recommendations_history",
                "SELECT id, outfit_id, occasion, created_at FROM recommendations WHERE user_id = :uid ORDER BY created_at DESC LIMIT 30",
                {"uid": str(sample_user_id)}
            ),
            (
                "wear_history_recent",
                "SELECT id, outfit_id, worn_at FROM wear_history WHERE user_id = :uid AND worn_at >= NOW() - INTERVAL '14 days' ORDER BY worn_at DESC",
                {"uid": str(sample_user_id)}
            ),
            (
                "collections_user_list",
                "SELECT id, name, created_at FROM collections WHERE user_id = :uid ORDER BY created_at DESC",
                {"uid": str(sample_user_id)}
            ),
            (
                "outfit_clothing_by_garment",
                "SELECT outfit_id FROM outfit_clothing WHERE clothing_id = :cid",
                {"cid": str(sample_clothing_id) if sample_clothing_id else "00000000-0000-0000-0000-000000000000"}
            ),
            (
                "user_login_email_ilike",
                "SELECT id, username, email FROM users WHERE lower(email) = 'test@example.com' LIMIT 1",
                {}
            ),
            (
                "user_profile_username_ilike",
                "SELECT id, username, first_name, last_name FROM users WHERE lower(username) = 'test' LIMIT 1",
                {}
            ),
            (
                "user_search_pattern",
                "SELECT id, username, first_name, last_name FROM users WHERE is_active = true AND (lower(username) LIKE '%alex%' OR lower(first_name) LIKE '%alex%') LIMIT 20",
                {}
            )
        ]

        for qname, qsql, qparams in queries:
            try:
                explain_sql = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {qsql}"
                raw = conn.execute(text(explain_sql), qparams).scalar()
                # parse JSON plan
                if isinstance(raw, str):
                    plan_data = json.loads(raw)[0]
                else:
                    plan_data = raw[0]

                plan_node = plan_data["Plan"]
                exec_time = plan_data.get("Execution Time", 0.0)
                planning_time = plan_data.get("Planning Time", 0.0)

                # Extract scan types
                scan_types = []
                def extract_scans(node):
                    st = node.get("Node Type", "")
                    rel = node.get("Relation Name", "")
                    idx = node.get("Index Name", "")
                    if "Scan" in st:
                        scan_types.append(f"{st} on {rel}" + (f" using {idx}" if idx else ""))
                    for sub in node.get("Plans", []):
                        extract_scans(sub)
                extract_scans(plan_node)

                results[qname] = {
                    "sql": qsql.strip(),
                    "params": qparams,
                    "execution_time_ms": exec_time,
                    "planning_time_ms": planning_time,
                    "scan_types": scan_types,
                    "plan": plan_node
                }
                print(f"[{qname:<30}] Exec: {exec_time:.3f}ms | Scans: {', '.join(scan_types)}")
            except Exception as e:
                print(f"[{qname:<30}] ERROR: {e}")
                results[qname] = {"error": str(e)}

    with open("project_audit/baseline_query_plans.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("SUCCESS: Wrote project_audit/baseline_query_plans.json")

if __name__ == "__main__":
    run_query_analysis()
