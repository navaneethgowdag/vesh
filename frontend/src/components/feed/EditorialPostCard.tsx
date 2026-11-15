import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MapPin,
  Trash2,
} from 'lucide-react';
import { Post } from '../../types';
import { useApp, useCurrentUser } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';
import { CommentModal } from '../social/CommentDrawer';
import { ShareModal } from '../social/ShareModal';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { PollWidget } from '../social/PollWidget';
import { useAsyncLock } from '../../hooks/useAsyncLock';

interface EditorialPostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
}

export const EditorialPostCard: React.FC<EditorialPostCardProps> = ({ post, onDelete }) => {
  const { toggleLikePost, toggleSavePost, deletePost } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const { execute: runLike } = useAsyncLock();
  const { execute: runSave } = useAsyncLock();
  const { execute: runDelete } = useAsyncLock();

  const isMe = currentUser && post.user.id === currentUser.id;

  // Handle Like Action
  const handleLike = () => {
    runLike(async () => {
      if (!post.isLiked) {
        setLikeBurst(true);
        setTimeout(() => setLikeBurst(false), 800);
      }
      await toggleLikePost(post.id);
    });
  };

  // Handle Save Action
  const handleSave = () => {
    runSave(async () => {
      await toggleSavePost(post.id);
    });
  };

  // Double tap image to like
  const handleDoubleTap = () => {
    if (!post.isLiked) {
      handleLike();
    }
  };

  const handleDelete = () => {
    if (!window.confirm('Delete this post?')) return;
    runDelete(async () => {
      try {
        await deletePost(post.id);
        onDelete?.(post.id);
      } catch {
        // quiet
      }
    });
  };

  const postImg = resolveImageUrl(post.image) || FALLBACK_POST_IMAGE;
  const isCaptionLong = (post.caption || '').length > 150;

  return (
    <>
      <article className="rounded-[4px] bg-[#FFFFFF] dark:bg-[#211E1B] border border-[#EAE3D8] dark:border-[#36322D] overflow-hidden shadow-xs transition-all duration-200">
        {/* Creator Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#EAE3D8]/60 dark:border-[#36322D]/60">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate(isMe ? '/profile' : `/profile/${post.user.username}`)
              }
              className="focus:outline-none rounded-full cursor-pointer p-[1.5px] border border-[#B8A99A] dark:border-[#4A443E]"
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
                  className="font-serif font-bold text-base text-[#25231F] dark:text-[#F8F6F1] hover:text-[#75624D] dark:hover:text-[#C2AB95] transition-colors cursor-pointer"
                >
                  {post.user.name}
                </button>
                <span className="text-xs text-[#A68B72] dark:text-[#B8A99A] font-sans">
                  @{post.user.username}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#A68B72] dark:text-[#B8A99A] font-sans mt-0.5">
                {post.location && (
                  <span className="flex items-center gap-1 text-[#75624D] dark:text-[#C2AB95]">
                    <MapPin className="w-3 h-3" />
                    {post.location}
                    <span>·</span>
                  </span>
                )}
                <span>{post.createdAt}</span>
                {post.occasion && (
                  <>
                    <span>·</span>
                    <span className="italic">{post.occasion}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Delete action for author */}
          {isMe && (
            <button
              onClick={handleDelete}
              className="p-2 text-[#A68B72] hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
              title="Delete post"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Media Frame (Aspect 4:5) */}
        {post.image ? (
          <div
            onDoubleClick={handleDoubleTap}
            className="relative bg-[#F8F6F1] dark:bg-[#181614] aspect-[4/5] sm:aspect-[4/4.5] overflow-hidden cursor-pointer select-none group"
          >
            <img
              src={postImg}
              alt={post.caption || 'Outfit inspiration'}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
              loading="lazy"
            />

            {/* Double Tap Heart Burst Animation */}
            {likeBurst && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.25, opacity: 1 }}
                exit={{ scale: 1.7, opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center">
                  <Heart className="w-10 h-10 text-rose-500 fill-rose-500" />
                </div>
              </motion.div>
            )}
          </div>
        ) : null}

        {/* Interaction Toolbar & Caption Content */}
        <div className="p-4 sm:p-5 space-y-3.5">
          {/* Action Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Like Button */}
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 text-xs font-sans font-semibold text-[#25231F] dark:text-[#F8F6F1] hover:text-[#75624D] transition-colors cursor-pointer"
                title="Like post"
              >
                <Heart
                  className={`w-5 h-5 transition-transform duration-150 active:scale-125 ${
                    post.isLiked
                      ? 'fill-rose-500 text-rose-500'
                      : 'text-[#25231F] dark:text-[#F8F6F1]'
                  }`}
                />
                <span>{post.likesCount || 0}</span>
              </button>

              {/* Comment Button */}
              <button
                onClick={() => setCommentModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-sans font-semibold text-[#25231F] dark:text-[#F8F6F1] hover:text-[#75624D] transition-colors cursor-pointer"
                title="View comments"
              >
                <MessageCircle className="w-5 h-5 text-[#25231F] dark:text-[#F8F6F1]" />
                <span>{post.commentsCount || 0}</span>
              </button>

              {/* Share Button */}
              <button
                onClick={() => setShareModalOpen(true)}
                className="p-1 text-[#25231F] dark:text-[#F8F6F1] hover:text-[#75624D] transition-colors cursor-pointer"
                title="Share post"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* Save / Bookmark Button */}
            <button
              onClick={handleSave}
              className="p-1 text-[#25231F] dark:text-[#F8F6F1] hover:text-[#75624D] transition-colors cursor-pointer"
              title={post.isSaved ? 'Remove from saved' : 'Save post'}
            >
              <Bookmark
                className={`w-5 h-5 ${
                  post.isSaved
                    ? 'fill-[#75624D] text-[#75624D] dark:fill-[#C2AB95] dark:text-[#C2AB95]'
                    : ''
                }`}
              />
            </button>
          </div>

          {/* Attached Poll if present */}
          {post.poll && (
            <div className="pt-1">
              <PollWidget poll={post.poll} />
            </div>
          )}

          {/* Caption */}
          {post.caption && (
            <div className="text-xs sm:text-sm text-[#25231F] dark:text-[#F8F6F1] font-sans leading-relaxed">
              <span className="font-bold mr-2">{post.user.name}</span>
              <span>
                {isCaptionLong && !isExpanded
                  ? `${post.caption.slice(0, 150)}...`
                  : post.caption}
              </span>
              {isCaptionLong && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="ml-2 font-semibold text-[#75624D] dark:text-[#C2AB95] hover:underline cursor-pointer"
                >
                  {isExpanded ? 'Less' : 'More'}
                </button>
              )}
            </div>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-sans font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded-[2px] bg-[#F8F6F1] dark:bg-[#181614] text-[#75624D] dark:text-[#C2AB95] border border-[#EAE3D8] dark:border-[#36322D]"
                >
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* Comment Drawer Modal */}
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
