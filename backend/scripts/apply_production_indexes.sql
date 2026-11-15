-- ============================================================================
-- TailorBird Production Database Indexing & Query Optimization Script
-- Target: Neon PostgreSQL (neondb)
-- Run in: Neon Console -> SQL Editor (as neondb_owner)
-- Description: Creates justified indexes to eliminate sequential scans, avoid
--              in-memory sorts, index foreign keys, and drop redundant duplicates.
-- ============================================================================

-- 1. POSTS & MOMENTS
-- Supports user lookbook & moments filtering: WHERE user_id = :uid ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON public.posts (user_id, created_at DESC);

-- Supports global post feed & 24h moment cutoff: WHERE created_at >= :cutoff ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);


-- 2. SOCIAL FOLLOWS
-- Supports followers count and followers list: WHERE following_id = :uid
-- (Existing uq_follow only covers (follower_id, following_id))
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows (following_id, follower_id);


-- 3. COMMENTS
-- Supports post comments retrieval: WHERE post_id = :pid ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.comments (post_id, created_at ASC);

-- Supports user comment joins and user profile comment lookups
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments (user_id);


-- 4. LIKES
-- Supports post likes count and batch feed interaction lookups: WHERE post_id = :pid
-- (Existing uq_like_user_post only covers (user_id, post_id))
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes (post_id);


-- 5. NOTIFICATIONS
-- Supports user notification list: WHERE user_id = :uid ORDER BY created_at DESC LIMIT 50
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- Partial index for instantaneous unread notification badges: WHERE user_id = :uid AND is_read = false
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE is_read = false;


-- 6. SAVED CURATIONS
-- Supports post saved counts and checks: WHERE post_id = :pid
CREATE INDEX IF NOT EXISTS idx_saved_post_id ON public.saved (post_id);


-- 7. COLLECTIONS & MOODBOARDS
-- Supports user collection list: WHERE user_id = :uid ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_collections_user_created ON public.collections (user_id, created_at DESC);


-- 8. OUTFIT CLOTHING ASSOCIATION
-- Supports reverse garment lookups: WHERE clothing_id = :cid
-- (Existing outfit_clothing_pkey only covers (outfit_id, clothing_id))
CREATE INDEX IF NOT EXISTS idx_outfit_clothing_clothing_id ON public.outfit_clothing (clothing_id, outfit_id);


-- 9. CLOTHING & WARDROBE
-- Supports user wardrobe sorting with zero in-memory sort: WHERE user_id = :uid ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_clothing_user_created ON public.clothing (user_id, created_at DESC);

-- Supports category filtering on user wardrobe: WHERE user_id = :uid AND category = :cat
CREATE INDEX IF NOT EXISTS idx_clothing_user_category ON public.clothing (user_id, category);


-- 10. RECOMMENDATIONS
-- Supports active recommendation retrieval: WHERE user_id = :uid AND occasion = :occ AND created_at >= :cutoff
CREATE INDEX IF NOT EXISTS idx_recommendations_user_occasion_created ON public.recommendations (user_id, occasion, created_at DESC);

-- Supports foreign-key join from recommendations to outfits: WHERE outfit_id = :outfit_id
CREATE INDEX IF NOT EXISTS idx_recommendations_outfit_id ON public.recommendations (outfit_id);


-- 11. WEAR HISTORY
-- Supports recent wear history & repetition avoidance: WHERE user_id = :uid AND worn_at >= :cutoff ORDER BY worn_at DESC
CREATE INDEX IF NOT EXISTS idx_wear_history_user_worn ON public.wear_history (user_id, worn_at DESC);


-- 12. USERS (FUNCTIONAL / CASE-INSENSITIVE)
-- Supports case-insensitive login without full table scan: WHERE lower(email) = :email
CREATE INDEX IF NOT EXISTS idx_users_lower_email ON public.users (lower(email));

-- Supports case-insensitive profile lookups without full table scan: WHERE lower(username) = :username
CREATE INDEX IF NOT EXISTS idx_users_lower_username ON public.users (lower(username));


-- 13. DEDUPLICATION
-- Drop redundant index idx_learned_preferences_user (fully covered by unique index learned_preferences_user_id_key)
DROP INDEX IF EXISTS public.idx_learned_preferences_user;

-- ANALYZE tables to update PostgreSQL query planner statistics immediately
ANALYZE public.clothing;
ANALYZE public.clothing_analysis;
ANALYZE public.collections;
ANALYZE public.comments;
ANALYZE public.follows;
ANALYZE public.learned_preferences;
ANALYZE public.likes;
ANALYZE public.notifications;
ANALYZE public.outfit_clothing;
ANALYZE public.outfits;
ANALYZE public.posts;
ANALYZE public.recommendation_feedback;
ANALYZE public.recommendations;
ANALYZE public.saved;
ANALYZE public.user_preferences;
ANALYZE public.users;
ANALYZE public.wear_history;
