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
      <article className="bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl border border-[#E5DED3] dark:border-[#393832] shadow-subtle hover:shadow-soft overflow-hidden transition-all duration-200">
        {/* Post Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate(isMe ? '/profile' : `/profile/${post.user.username}`)
              }
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C3A36B] rounded-full"
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
                  className="font-bold text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] hover:text-[#C3A36B] dark:hover:text-[#D1B47A] transition-colors"
                >
                  {post.user.name}
                </button>
                <span className="text-[11px] text-[#82796F] dark:text-[#B2AA9E]">@{post.user.username}</span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#82796F] dark:text-[#B2AA9E] mt-0.5">
                {post.location && (
                  <span className="flex items-center gap-1 text-[#82796F] dark:text-[#B2AA9E]">
                    <MapPin className="w-3 h-3 text-[#C3A36B] dark:text-[#D1B47A]" />
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
              className="p-2 text-[#82796F] dark:text-[#B2AA9E] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
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
                  ? 'bg-[#EFE9DF] dark:bg-[#2A2A26] text-[#25211E] dark:text-[#F4F0E8] hover:bg-[#E5DED3] dark:hover:bg-[#393832]'
                  : 'bg-[#25211E] dark:bg-[#F4F0E8] text-[#F7F4EE] dark:text-[#171715] hover:bg-[#C3A36B] dark:hover:bg-[#D1B47A]'
              )}
            >
              {isFollowing ? 'Following' : '+ Follow'}
            </button>
          )}
        </div>

        {/* Post Image Container */}
        <div
          onDoubleClick={handleDoubleTap}
          className="relative bg-[#F7F4EE] dark:bg-[#171715] aspect-[4/5] sm:aspect-[4/4.5] overflow-hidden cursor-pointer select-none group"
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
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
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
              className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md text-[11px] font-medium flex items-center gap-1.5 transition-colors"
            >
              <Tag className="w-3 h-3 text-[#D1B47A]" />
              <span>{post.taggedItems.length} {post.taggedItems.length === 1 ? 'piece' : 'pieces'}</span>
            </button>
          )}
        </div>

        {/* Tagged Clothing drawer / pills */}
        {showTags && post.taggedItems && post.taggedItems.length > 0 && (
          <div className="p-3 bg-[#F7F4EE] dark:bg-[#171715] border-t border-[#E5DED3] dark:border-[#393832] flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {post.taggedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/wardrobe/${item.id}`)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-white dark:bg-[#22221F] border border-[#E5DED3] dark:border-[#393832] flex-shrink-0 cursor-pointer hover:border-[#C3A36B] transition-colors"
              >
                <img
                  src={resolveImageUrl(item.image)}
                  alt={item.name}
                  className="w-7 h-7 rounded-lg object-cover"
                />
                <div className="text-[11px] leading-tight">
                  <p className="font-semibold text-[#25211E] dark:text-[#F4F0E8]">{item.name}</p>
                  <p className="text-[10px] text-[#82796F] dark:text-[#B2AA9E] capitalize">{item.category}</p>
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
                className="flex items-center gap-1.5 text-xs font-semibold group focus:outline-none"
              >
                <Heart
                  className={cn(
                    'w-5 h-5 transition-transform group-hover:scale-110 active:scale-90',
                    post.isLiked
                      ? 'text-rose-500 fill-rose-500'
                      : 'text-[#82796F] dark:text-[#B2AA9E] group-hover:text-rose-500'
                  )}
                />
                <span className={cn(post.isLiked ? 'text-rose-600 dark:text-rose-400' : 'text-[#82796F] dark:text-[#B2AA9E]')}>
                  {post.likesCount}
                </span>
              </button>

              {/* Comments */}
              <button
                onClick={() => setCommentModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] transition-colors focus:outline-none"
              >
                <MessageCircle className="w-5 h-5" />
                <span>{post.comments?.length || 0}</span>
              </button>

              {/* Share */}
              <button
                onClick={() => setShareModalOpen(true)}
                className="text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] transition-colors focus:outline-none"
                aria-label="Share post"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* Bookmark / Save */}
            <button
              onClick={() => toggleSavePost(post.id)}
              className="text-[#82796F] dark:text-[#B2AA9E] hover:text-[#C3A36B] dark:hover:text-[#D1B47A] transition-colors focus:outline-none"
              aria-label={post.isSaved ? 'Remove from saved' : 'Save outfit'}
            >
              <Bookmark
                className={cn(
                  'w-5 h-5 transition-transform active:scale-90',
                  post.isSaved ? 'text-[#C3A36B] dark:text-[#D1B47A] fill-[#C3A36B] dark:fill-[#D1B47A]' : ''
                )}
              />
            </button>
          </div>

          {/* Caption */}
          {post.caption && (
            <p className="text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] leading-relaxed font-sans">
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
                  className="text-[11px] font-medium text-[#C3A36B] dark:text-[#D1B47A] hover:underline cursor-pointer"
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
          <div className="bg-[#FFFFFF] dark:bg-[#22221F] border border-[#E5DED3] dark:border-[#393832] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-soft">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h4 className="font-serif text-lg font-bold text-[#25211E] dark:text-[#F4F0E8]">
                Delete Lookbook Post?
              </h4>
              <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mt-1 font-sans">
                This will permanently remove this post and its comments from the social feed and your profile.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-[#EFE9DF] dark:bg-[#2A2A26] text-[#25211E] dark:text-[#F4F0E8] hover:bg-[#E5DED3]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
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
