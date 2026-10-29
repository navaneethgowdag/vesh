import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Sparkles, X, Bookmark, Share2 } from 'lucide-react';
import { Post } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { useApp } from '../../context/AppContext';

interface EditorialMosaicProps {
  posts: Post[];
}

export const EditorialMosaic: React.FC<EditorialMosaicProps> = ({ posts }) => {
  const navigate = useNavigate();
  const { toggleLikePost, toggleSavePost } = useApp();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  if (!posts || posts.length === 0) {
    return (
      <div className="py-20 text-center rounded-3xl bg-luxury-surface dark:bg-luxury-dark-surface border border-luxury-border dark:border-luxury-dark-border p-8">
        <Sparkles className="w-8 h-8 text-luxury-champagne dark:text-luxury-dark-champagne mx-auto mb-3" />
        <h3 className="font-serif text-lg font-bold text-luxury-text dark:text-luxury-dark-text">
          No Silhouettes Matching Search
        </h3>
        <p className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1 max-w-sm mx-auto">
          Adjust your filters, search terms, or explore other seasonal style aesthetics.
        </p>
      </div>
    );
  }

  const getSpanClass = (index: number) => {
    const cycle = index % 6;
    switch (cycle) {
      case 0:
        return 'sm:col-span-2 sm:row-span-2'; // Featured Large
      case 1:
        return 'sm:col-span-1 sm:row-span-1';
      case 2:
        return 'sm:col-span-1 sm:row-span-1';
      case 3:
        return 'sm:col-span-1 sm:row-span-2'; // Tall Column Accent
      case 4:
        return 'sm:col-span-2 sm:row-span-1'; // Wide Horizon
      case 5:
        return 'sm:col-span-1 sm:row-span-1';
      default:
        return 'sm:col-span-1 sm:row-span-1';
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[220px] sm:auto-rows-[260px] gap-4">
        {posts.map((post, index) => {
          const spanClass = getSpanClass(index);
          const imageUrl = resolveImageUrl(post.image) || FALLBACK_POST_IMAGE;

          return (
            <div
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className={`group relative rounded-3xl overflow-hidden cursor-pointer bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle border border-luxury-border/80 dark:border-luxury-dark-border/80 shadow-soft hover:shadow-soft-lg transition-all duration-500 ${spanClass}`}
            >
              {/* Media Image */}
              <img
                src={imageUrl}
                alt={post.caption || 'Editorial fashion outfit'}
                onError={(e) => {
                  if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                    e.currentTarget.src = FALLBACK_POST_IMAGE;
                  }
                }}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              {/* Gradient Backdrop on Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 sm:p-5" />

              {/* Top Tags strip (visible on hover) */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/20">
                  {post.occasion || 'Atelier Look'}
                </span>

                <div className="flex items-center gap-1.5 text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded-full backdrop-blur-md border border-white/20">
                  <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                  <span>{post.likesCount}</span>
                </div>
              </div>

              {/* Bottom Creator Info & Caption (visible on hover) */}
              <div className="absolute bottom-3 left-3 right-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar
                    src={post.user.avatar}
                    alt={post.user.name}
                    size="sm"
                    isVerified={post.user.isVerified}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate leading-tight">{post.user.name}</p>
                    <p className="text-[10px] text-white/70 truncate">@{post.user.username}</p>
                  </div>
                </div>

                {post.caption && (
                  <p className="text-xs text-white/90 line-clamp-2 font-serif italic">
                    &quot;{post.caption}&quot;
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Post Modal Inspection */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border shadow-soft-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-luxury-border dark:border-luxury-dark-border">
              <div
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => {
                  setSelectedPost(null);
                  navigate(`/profile/${selectedPost.user.username}`);
                }}
              >
                <Avatar
                  src={selectedPost.user.avatar}
                  alt={selectedPost.user.name}
                  size="md"
                  isVerified={selectedPost.user.isVerified}
                />
                <div>
                  <h4 className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text">
                    {selectedPost.user.name}
                  </h4>
                  <p className="text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted">
                    @{selectedPost.user.username}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="p-2 rounded-full hover:bg-luxury-surfaceSubtle dark:hover:bg-luxury-dark-surfaceSubtle text-luxury-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-4">
              <div className="rounded-2xl overflow-hidden aspect-[4/5] bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle border border-luxury-border dark:border-luxury-dark-border">
                <img
                  src={resolveImageUrl(selectedPost.image) || FALLBACK_POST_IMAGE}
                  alt={selectedPost.caption}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-luxury-champagne dark:text-luxury-dark-champagne">
                  {selectedPost.occasion}
                </span>
                <p className="font-serif text-sm sm:text-base text-luxury-text dark:text-luxury-dark-text mt-1">
                  {selectedPost.caption}
                </p>
              </div>

              {selectedPost.tags && selectedPost.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPost.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle text-luxury-champagne dark:text-luxury-dark-champagne border border-luxury-border dark:border-luxury-dark-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Tagged wardrobe items if present */}
              {selectedPost.taggedItems && selectedPost.taggedItems.length > 0 && (
                <div className="pt-2">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-2">
                    Tagged Wardrobe Staples
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedPost.taggedItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedPost(null);
                          navigate(`/wardrobe/${item.id}`);
                        }}
                        className="flex items-center gap-2 p-2 rounded-xl bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border cursor-pointer hover:border-luxury-champagne"
                      >
                        <img src={item.image} alt={item.name} className="w-8 h-8 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text truncate">{item.name}</p>
                          <p className="text-[10px] text-luxury-textMuted dark:text-luxury-dark-textMuted truncate">{item.category}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-luxury-border dark:border-luxury-dark-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleLikePost(selectedPost.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-luxury-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text cursor-pointer"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      selectedPost.isLiked ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                  <span>{selectedPost.likesCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleSavePost(selectedPost.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-luxury-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text cursor-pointer"
                >
                  <Bookmark
                    className={`w-4 h-4 ${
                      selectedPost.isSaved ? 'fill-luxury-champagne text-luxury-champagne' : ''
                    }`}
                  />
                  <span>{selectedPost.savesCount}</span>
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedPost(null);
                  navigate(`/profile/${selectedPost.user.username}`);
                }}
              >
                View Creator Profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
