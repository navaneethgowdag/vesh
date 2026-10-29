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

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deletePost(post.id);
      setIsDeleteDialogOpen(false);
    } catch {
      // Handled via toast in AppContext
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <article className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-200">
        {/* Post Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate(isMe ? '/profile' : `/profile/${post.user.username}`)
              }
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-full"
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
                  className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:underline transition-colors"
                >
                  {post.user.name}
                </button>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">@{post.user.username}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {post.location && (
                  <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                    <MapPin className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                    {post.location}
                  </span>
                )}
                <span>&middot;</span>
                <span>{post.createdAt}</span>
              </div>
            </div>
          </div>

          {/* Actions: Delete for author, Follow for others */}
          {isMe ? (
            <button
              onClick={() => setIsDeleteDialogOpen(true)}
              className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
              title="Delete post"
              aria-label="Delete post"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => toggleFollowUser(post.user.id)}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 min-h-[36px] rounded-md transition-all duration-200 border',
                isFollowing
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent hover:bg-zinc-800 dark:hover:bg-zinc-200'
              )}
            >
              {isFollowing ? 'Following' : '+ Follow'}
            </button>
          )}
        </div>

        {/* Post Image Container */}
        <div
          onDoubleClick={handleDoubleTap}
          className="relative bg-zinc-100 dark:bg-zinc-950 aspect-[4/5] sm:aspect-[4/4.5] overflow-hidden cursor-pointer select-none group"
        >
          <img
            src={resolveImageUrl(post.image) || FALLBACK_POST_IMAGE}
            alt={post.caption}
            onError={(e) => {
              if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                e.currentTarget.src = FALLBACK_POST_IMAGE;
              }
            }}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
            loading="lazy"
          />

          {/* Double tap like animation overlay */}
          {likeBurst && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-20 h-20 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <Heart className="w-10 h-10 text-rose-500 fill-rose-500" />
              </div>
            </motion.div>
          )}

          {/* Tagged Items Button Overlay */}
          {post.taggedItems && post.taggedItems.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTags(!showTags);
              }}
              className="absolute bottom-3 left-3 px-2.5 py-1.5 rounded-md bg-black/70 hover:bg-black/90 text-white backdrop-blur-md text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Tag className="w-3.5 h-3.5 text-zinc-300" />
              <span>{post.taggedItems.length} {post.taggedItems.length === 1 ? 'piece' : 'pieces'}</span>
            </button>
          )}
        </div>

        {/* Tagged Clothing drawer / pills */}
        {showTags && post.taggedItems && post.taggedItems.length > 0 && (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {post.taggedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/wardrobe/${item.id}`)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex-shrink-0 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <img
                  src={resolveImageUrl(item.image)}
                  alt={item.name}
                  className="w-7 h-7 rounded object-cover"
                />
                <div className="text-xs leading-tight">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">{item.category}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Post Actions & Meta */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Like */}
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 min-h-[40px] text-xs font-semibold group focus:outline-none"
              >
                <Heart
                  className={cn(
                    'w-5 h-5 transition-transform group-hover:scale-110 active:scale-90',
                    post.isLiked
                      ? 'text-rose-500 fill-rose-500'
                      : 'text-zinc-500 dark:text-zinc-400 group-hover:text-rose-500'
                  )}
                />
                <span className={cn(post.isLiked ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-zinc-700 dark:text-zinc-300')}>
                  {post.likesCount}
                </span>
              </button>

              {/* Comments */}
              <button
                onClick={() => setCommentModalOpen(true)}
                className="flex items-center gap-1.5 min-h-[40px] text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none"
              >
                <MessageCircle className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                <span>{post.comments?.length || 0}</span>
              </button>

              {/* Share */}
              <button
                onClick={() => setShareModalOpen(true)}
                className="min-h-[40px] flex items-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none"
                aria-label="Share post"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* Bookmark / Save */}
            <button
              onClick={() => toggleSavePost(post.id)}
              className="min-h-[40px] flex items-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none"
              aria-label={post.isSaved ? 'Remove from saved' : 'Save outfit'}
            >
              <Bookmark
                className={cn(
                  'w-5 h-5 transition-transform active:scale-90',
                  post.isSaved ? 'text-zinc-900 dark:text-zinc-100 fill-zinc-900 dark:fill-zinc-100' : ''
                )}
              />
            </button>
          </div>

          {/* Caption */}
          {post.caption && (
            <p className="text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed">
              <span className="font-bold mr-1.5">{post.user.username}</span>
              {post.caption}
            </p>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:underline cursor-pointer"
                >
                  {t.startsWith('#') ? t : `#${t}`}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* Delete Confirmation Modal */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="w-10 h-10 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Delete Lookbook Post?
              </h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                This will permanently remove this post and its comments from the social feed and your profile.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="flex-1 py-2.5 min-h-[44px] text-xs font-semibold rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 min-h-[44px] text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Drawer / Modal */}
      <CommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        post={post}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        post={post}
      />
    </>
  );
};
