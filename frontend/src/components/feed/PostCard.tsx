import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Tag,
  MapPin,
  Sparkles,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Post } from '../../types';
import { useApp, useCurrentUser } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';
import { CommentModal } from '../social/CommentDrawer';
import { ShareModal } from '../social/ShareModal';
import { cn } from '../../utils/cn';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const {
    toggleLikePost,
    toggleSavePost,
    toggleFollowUser,
    isFollowingUser,
    deletePost,
    wardrobe,
  } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isMe = post.user.id === currentUser.id;
  const isFollowing = isFollowingUser(post.user.id);

  const handleLike = () => {
    if (!post.isLiked) {
      setLikeBurst(true);
      setTimeout(() => setLikeBurst(false), 800);
    }
    toggleLikePost(post.id);
  };

  const handleDoubleTap = () => {
    if (!post.isLiked) {
      handleLike();
    }
  };

  // Resolve tagged wardrobe items
  const taggedItems = post.taggedItems && post.taggedItems.length > 0
    ? post.taggedItems
    : [];

  return (
    <>
      <article className="bg-cream-50 rounded-3xl border border-sand-200/90 shadow-soft overflow-hidden transition-all duration-300 hover:shadow-soft-lg mb-8">
        {/* Post Header */}
        <div className="flex items-center justify-between p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                navigate(isMe ? '/profile' : `/profile/${post.user.username}`)
              }
              className="cursor-pointer"
            >
              <Avatar
                src={post.user.avatar}
                alt={post.user.name}
                size="md"
                isVerified={post.user.isVerified}
              />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    navigate(isMe ? '/profile' : `/profile/${post.user.username}`)
                  }
                  className="font-bold text-xs sm:text-sm text-charcoal-900 hover:text-cognac-700 transition-colors"
                >
                  {post.user.name}
                </button>
                <span className="text-[11px] text-charcoal-400">@{post.user.username}</span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-charcoal-400 mt-0.5">
                {post.location && (
                  <span className="flex items-center gap-1 text-charcoal-500">
                    <MapPin className="w-3 h-3 text-cognac-600" />
                    {post.location}
                  </span>
                )}
                <span>·</span>
                <span>{post.createdAt}</span>
              </div>
            </div>
          </div>

          {/* Actions: Delete for author, Follow for others */}
          {isMe ? (
            <button
              onClick={() => setIsDeleteDialogOpen(true)}
              className="p-1.5 text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
              title="Delete post"
              aria-label="Delete post"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => toggleFollowUser(post.user.id)}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200',
                isFollowing
                  ? 'bg-sand-200/70 text-charcoal-700 hover:bg-sand-300'
                  : 'bg-charcoal-900 text-cream-50 hover:bg-cognac-700'
              )}
            >
              {isFollowing ? 'Following' : '+ Follow'}
            </button>
          )}
        </div>

        {/* Post Image Container */}
        <div
          onDoubleClick={handleDoubleTap}
          className="relative bg-sand-200/50 aspect-[4/5] sm:aspect-[4/4.5] overflow-hidden cursor-pointer select-none group"
        >
          <img
            src={resolveImageUrl(post.image) || FALLBACK_POST_IMAGE}
            alt={post.caption}
            onError={(e) => {
              if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                e.currentTarget.src = FALLBACK_POST_IMAGE;
              }
            }}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.01]"
            loading="lazy"
          />

          {/* Double tap like animation overlay */}
          {likeBurst && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            >
              <Heart className="w-24 h-24 text-white fill-white drop-shadow-lg" />
            </motion.div>
          )}

          {/* Tagged Items Toggle Button */}
          {taggedItems.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTags(!showTags);
              }}
              className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-charcoal-900/75 hover:bg-charcoal-900 text-cream-50 text-xs backdrop-blur-md transition-all shadow-soft"
            >
              <Tag className="w-3.5 h-3.5 text-cognac-300" />
              <span>{showTags ? 'Hide Pieces' : `${taggedItems.length} Wardrobe Pieces`}</span>
            </button>
          )}

          {/* Occasion Badge */}
          <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full bg-cream-50/90 backdrop-blur-md text-charcoal-800 text-[11px] font-semibold tracking-wide border border-sand-200 shadow-soft-sm">
            {post.occasion}
          </div>

          {/* Overlay Tagged Garment Drawer */}
          {showTags && taggedItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-x-4 bottom-14 z-20 bg-cream-50/95 backdrop-blur-md rounded-2xl p-3 border border-sand-200 shadow-soft-xl max-h-48 overflow-y-auto space-y-2"
            >
              <p className="text-[10px] uppercase font-bold tracking-wider text-charcoal-400 mb-1">
                Tagged in this outfit
              </p>
              {taggedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/wardrobe/${item.id}`);
                  }}
                  className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-sand-100 transition-colors cursor-pointer"
                >
                  <img
                    src={resolveImageUrl(item.image) || FALLBACK_POST_IMAGE}
                    alt={item.name}
                    onError={(e) => {
                      if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                        e.currentTarget.src = FALLBACK_POST_IMAGE;
                      }
                    }}
                    className="w-9 h-9 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-charcoal-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-charcoal-500">
                      {item.brand ? `${item.brand} · ` : ''}
                      {item.category}
                    </p>
                  </div>
                  <span className="text-[10px] bg-sand-200 text-charcoal-700 px-2 py-0.5 rounded-full">
                    Inspect
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Post Actions Bar */}
        <div className="p-4 sm:p-5 pt-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              {/* Like Button */}
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 text-xs font-semibold text-charcoal-700 hover:text-rose-600 transition-colors group"
                aria-label={post.isLiked ? 'Unlike post' : 'Like post'}
              >
                <Heart
                  className={cn(
                    'w-5 h-5 transition-transform group-hover:scale-110',
                    post.isLiked
                      ? 'text-rose-500 fill-rose-500'
                      : 'text-charcoal-600 group-hover:text-rose-500'
                  )}
                />
                <span>{post.likesCount}</span>
              </button>

              {/* Comment Button */}
              <button
                onClick={() => setCommentModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-charcoal-700 hover:text-charcoal-950 transition-colors group"
                aria-label="View comments"
              >
                <MessageCircle className="w-5 h-5 text-charcoal-600 group-hover:scale-110 transition-transform" />
                <span>{post.commentsCount}</span>
              </button>

              {/* Share Button */}
              <button
                onClick={() => setShareModalOpen(true)}
                className="text-charcoal-600 hover:text-charcoal-950 transition-colors hover:scale-110"
                aria-label="Share post"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* Save Bookmark Button */}
            <button
              onClick={() => toggleSavePost(post.id)}
              className="flex items-center gap-1.5 text-xs font-semibold text-charcoal-700 hover:text-cognac-700 transition-colors group"
              aria-label={post.isSaved ? 'Remove from saved' : 'Save outfit'}
            >
              <Bookmark
                className={cn(
                  'w-5 h-5 transition-transform group-hover:scale-110',
                  post.isSaved
                    ? 'text-cognac-700 fill-cognac-700'
                    : 'text-charcoal-600 group-hover:text-cognac-700'
                )}
              />
              <span className="hidden sm:inline">{post.savesCount}</span>
            </button>
          </div>

          {/* Caption */}
          <div className="space-y-1.5 text-xs sm:text-sm">
            <p className="text-charcoal-800 leading-relaxed">
              <span className="font-bold text-charcoal-950 mr-2">
                @{post.user.username}
              </span>
              {post.caption}
            </p>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    onClick={() => navigate('/explore')}
                    className="text-xs text-cognac-700 hover:underline cursor-pointer font-medium"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Comments preview */}
          {post.comments && post.comments.length > 0 && (
            <button
              onClick={() => setCommentModalOpen(true)}
              className="text-xs text-charcoal-400 hover:text-charcoal-700 mt-2 block"
            >
              View all {post.comments.length} comments...
            </button>
          )}
        </div>
      </article>

      {/* Modals */}
      <CommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        post={post}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/50 backdrop-blur-xs">
          <div className="bg-cream-50 rounded-2xl border border-sand-300 shadow-soft-xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-charcoal-900 mb-2">
              Delete Outfit Post?
            </h3>
            <p className="text-xs text-charcoal-600 mb-6 leading-relaxed">
              This action cannot be undone and will permanently remove this look from your profile and community feed.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeleteDialogOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-sand-300 text-xs font-semibold text-charcoal-700 hover:bg-sand-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deletePost(post.id);
                    setIsDeleteDialogOpen(false);
                  } catch {
                    // handled via toast
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-cream-50 text-xs font-semibold shadow-soft transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

