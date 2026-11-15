"""
Automated Before-and-After Performance and Query Plan Benchmark for TailorBird Indexes.
Evaluates the impact of proposed indexes on real data in Neon PostgreSQL.
"""
import json
from sqlalchemy import text
from app.core.database import get_engine, verify_database_connection

def run_benchmark():
    verify_database_connection(fast=False)
    engine = get_engine()
    benchmark_results = []

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        # Get real sample IDs
        uid = conn.execute(text("SELECT id FROM users ORDER BY created_at DESC LIMIT 1")).scalar()
        pid = conn.execute(text("SELECT id FROM posts ORDER BY created_at DESC LIMIT 1")).scalar()
        cid = conn.execute(text("SELECT id FROM clothing ORDER BY created_at DESC LIMIT 1")).scalar()
        
        test_cases = [
            {
                "name": "posts_user_lookbook",
                "table": "posts",
                "create_table": "CREATE TEMP TABLE b_posts AS SELECT id, user_id, caption, created_at FROM posts",
                "index_name": "idx_posts_user_created",
                "index_def": "CREATE INDEX idx_posts_user_created ON b_posts (user_id, created_at DESC)",
                "query": f"SELECT id, user_id, caption, created_at FROM b_posts WHERE user_id = '{uid}' ORDER BY created_at DESC LIMIT 30",
                "drop_table": "DROP TABLE IF EXISTS b_posts",
            },
            {
                "name": "posts_global_feed",
                "table": "posts",
                "create_table": "CREATE TEMP TABLE b_posts AS SELECT id, user_id, caption, created_at FROM posts",
                "index_name": "idx_posts_created_at",
                "index_def": "CREATE INDEX idx_posts_created_at ON b_posts (created_at DESC)",
                "query": "SELECT id, user_id, caption, created_at FROM b_posts WHERE caption NOT LIKE '[MOMENT:%' ORDER BY created_at DESC LIMIT 30",
                "drop_table": "DROP TABLE IF EXISTS b_posts",
            },
            {
                "name": "follows_following_count",
                "table": "follows",
                "create_table": "CREATE TEMP TABLE b_follows AS SELECT id, follower_id, following_id FROM follows",
                "index_name": "idx_follows_following_id",
                "index_def": "CREATE INDEX idx_follows_following_id ON b_follows (following_id, follower_id)",
                "query": f"SELECT count(*) FROM b_follows WHERE following_id = '{uid}'",
                "drop_table": "DROP TABLE IF EXISTS b_follows",
            },
            {
                "name": "comments_by_post",
                "table": "comments",
                "create_table": "CREATE TEMP TABLE b_comments AS SELECT id, post_id, user_id, content, created_at FROM comments",
                "index_name": "idx_comments_post_created",
                "index_def": "CREATE INDEX idx_comments_post_created ON b_comments (post_id, created_at ASC)",
                "query": f"SELECT id, user_id, content, created_at FROM b_comments WHERE post_id = '{pid}' ORDER BY created_at ASC",
                "drop_table": "DROP TABLE IF EXISTS b_comments",
            },
            {
                "name": "likes_count_by_post",
                "table": "likes",
                "create_table": "CREATE TEMP TABLE b_likes AS SELECT id, post_id, user_id, created_at FROM likes",
                "index_name": "idx_likes_post_id",
                "index_def": "CREATE INDEX idx_likes_post_id ON b_likes (post_id)",
                "query": f"SELECT count(*) FROM b_likes WHERE post_id = '{pid}'",
                "drop_table": "DROP TABLE IF EXISTS b_likes",
            },
            {
                "name": "notifications_user_list",
                "table": "notifications",
                "create_table": "CREATE TEMP TABLE b_notifications AS SELECT id, user_id, type, title, is_read, created_at FROM notifications",
                "index_name": "idx_notifications_user_created",
                "index_def": "CREATE INDEX idx_notifications_user_created ON b_notifications (user_id, created_at DESC)",
                "query": f"SELECT id, type, title, is_read, created_at FROM b_notifications WHERE user_id = '{uid}' ORDER BY created_at DESC LIMIT 50",
                "drop_table": "DROP TABLE IF EXISTS b_notifications",
            },
            {
                "name": "notifications_unread_count",
                "table": "notifications",
                "create_table": "CREATE TEMP TABLE b_notifications AS SELECT id, user_id, type, title, is_read, created_at FROM notifications",
                "index_name": "idx_notifications_user_unread",
                "index_def": "CREATE INDEX idx_notifications_user_unread ON b_notifications (user_id) WHERE is_read = false",
                "query": f"SELECT count(*) FROM b_notifications WHERE user_id = '{uid}' AND is_read = false",
                "drop_table": "DROP TABLE IF EXISTS b_notifications",
            },
            {
                "name": "clothing_user_wardrobe",
                "table": "clothing",
                "create_table": "CREATE TEMP TABLE b_clothing AS SELECT id, user_id, category, name, created_at FROM clothing",
                "index_name": "idx_clothing_user_created",
                "index_def": "CREATE INDEX idx_clothing_user_created ON b_clothing (user_id, created_at DESC)",
                "query": f"SELECT id, name, category, created_at FROM b_clothing WHERE user_id = '{uid}' ORDER BY created_at DESC LIMIT 100",
                "drop_table": "DROP TABLE IF EXISTS b_clothing",
            },
            {
                "name": "clothing_category_filter",
                "table": "clothing",
                "create_table": "CREATE TEMP TABLE b_clothing AS SELECT id, user_id, category, name, created_at FROM clothing",
                "index_name": "idx_clothing_user_category",
                "index_def": "CREATE INDEX idx_clothing_user_category ON b_clothing (user_id, category)",
                "query": f"SELECT id, name, category, created_at FROM b_clothing WHERE user_id = '{uid}' AND category = 'Tops' ORDER BY created_at DESC LIMIT 100",
                "drop_table": "DROP TABLE IF EXISTS b_clothing",
            },
            {
                "name": "recommendations_active_occasion",
                "table": "recommendations",
                "create_table": "CREATE TEMP TABLE b_recs AS SELECT id, user_id, outfit_id, occasion, recommendation_score, created_at FROM recommendations",
                "index_name": "idx_recommendations_user_occasion_created",
                "index_def": "CREATE INDEX idx_recommendations_user_occasion_created ON b_recs (user_id, occasion, created_at DESC)",
                "query": f"SELECT id, outfit_id, occasion, recommendation_score, created_at FROM b_recs WHERE user_id = '{uid}' AND occasion = 'Casual Daily' AND created_at >= NOW() - INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 1",
                "drop_table": "DROP TABLE IF EXISTS b_recs",
            },
            {
                "name": "wear_history_repetition",
                "table": "wear_history",
                "create_table": "CREATE TEMP TABLE b_wear AS SELECT id, user_id, outfit_id, worn_at FROM wear_history",
                "index_name": "idx_wear_history_user_worn",
                "index_def": "CREATE INDEX idx_wear_history_user_worn ON b_wear (user_id, worn_at DESC)",
                "query": f"SELECT id, outfit_id, worn_at FROM b_wear WHERE user_id = '{uid}' AND worn_at >= NOW() - INTERVAL '14 days' ORDER BY worn_at DESC",
                "drop_table": "DROP TABLE IF EXISTS b_wear",
            },
            {
                "name": "outfit_clothing_reverse_lookup",
                "table": "outfit_clothing",
                "create_table": "CREATE TEMP TABLE b_outfit_clothing AS SELECT outfit_id, clothing_id FROM outfit_clothing",
                "index_name": "idx_outfit_clothing_clothing_id",
                "index_def": "CREATE INDEX idx_outfit_clothing_clothing_id ON b_outfit_clothing (clothing_id, outfit_id)",
                "query": f"SELECT outfit_id FROM b_outfit_clothing WHERE clothing_id = '{cid}'",
                "drop_table": "DROP TABLE IF EXISTS b_outfit_clothing",
            },
            {
                "name": "user_email_case_insensitive",
                "table": "users",
                "create_table": "CREATE TEMP TABLE b_users AS SELECT id, username, email, is_active FROM users",
                "index_name": "idx_users_lower_email",
                "index_def": "CREATE INDEX idx_users_lower_email ON b_users (lower(email))",
                "query": "SELECT id, username, email FROM b_users WHERE lower(email) = 'test@example.com' LIMIT 1",
                "drop_table": "DROP TABLE IF EXISTS b_users",
            },
            {
                "name": "user_username_case_insensitive",
                "table": "users",
                "create_table": "CREATE TEMP TABLE b_users AS SELECT id, username, email, is_active FROM users",
                "index_name": "idx_users_lower_username",
                "index_def": "CREATE INDEX idx_users_lower_username ON b_users (lower(username))",
                "query": "SELECT id, username FROM b_users WHERE lower(username) = 'test' LIMIT 1",
                "drop_table": "DROP TABLE IF EXISTS b_users",
            }
        ]

        def parse_plan(plan_json):
            data = json.loads(plan_json)[0] if isinstance(plan_json, str) else plan_json[0]
            plan = data["Plan"]
            exec_time = data.get("Execution Time", 0.0)
            planning_time = data.get("Planning Time", 0.0)
            cost = plan.get("Total Cost", 0.0)
            
            scans = []
            has_sort = False
            def walk(node):
                nonlocal has_sort
                nt = node.get("Node Type", "")
                rel = node.get("Relation Name", "")
                idx = node.get("Index Name", "")
                if nt == "Sort":
                    has_sort = True
                if "Scan" in nt:
                    scans.append(f"{nt} ({idx or rel})")
                for sub in node.get("Plans", []):
                    walk(sub)
            walk(plan)
            return {
                "exec_time_ms": exec_time,
                "planning_time_ms": planning_time,
                "cost": cost,
                "scans": scans,
                "has_sort": has_sort
            }

        for tc in test_cases:
            try:
                # 1. Clean up & Create table
                conn.execute(text(tc["drop_table"]))
                conn.execute(text(tc["create_table"]))

                # 2. Baseline without index
                conn.execute(text("SET enable_seqscan = on"))
                base_raw = conn.execute(text(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {tc['query']}")).scalar()
                base_metrics = parse_plan(base_raw)

                # 3. Create index
                conn.execute(text(tc["index_def"]))

                # 4. Measure with index
                # Ensure index scan is preferred
                conn.execute(text("SET enable_seqscan = off"))
                opt_raw = conn.execute(text(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {tc['query']}")).scalar()
                opt_metrics = parse_plan(opt_raw)

                # Reset seqscan setting
                conn.execute(text("SET enable_seqscan = on"))
                
                # Cleanup table
                conn.execute(text(tc["drop_table"]))

                result_entry = {
                    "test_case": tc["name"],
                    "target_table": tc["table"],
                    "index_name": tc["index_name"],
                    "index_sql": tc["index_def"],
                    "query_sql": tc["query"],
                    "baseline": base_metrics,
                    "optimized": opt_metrics,
                    "cost_reduction_ratio": round(base_metrics["cost"] / max(opt_metrics["cost"], 0.01), 2),
                    "sort_eliminated": base_metrics["has_sort"] and not opt_metrics["has_sort"]
                }
                benchmark_results.append(result_entry)
                print(f"[{tc['name']:<30}] Base: {base_metrics['cost']:<8.2f} (Sort={base_metrics['has_sort']}) -> Opt: {opt_metrics['cost']:<8.2f} (Sort={opt_metrics['has_sort']}) | Ratio: {result_entry['cost_reduction_ratio']}x")
            except Exception as e:
                print(f"[{tc['name']:<30}] ERROR: {e}")
                conn.execute(text(tc["drop_table"]))

    with open("project_audit/before_after_benchmark_results.json", "w", encoding="utf-8") as f:
        json.dump(benchmark_results, f, indent=2)
    print("SUCCESS: Wrote project_audit/before_after_benchmark_results.json")

if __name__ == "__main__":
    run_benchmark()
