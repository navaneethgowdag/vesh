import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Sparkles, X, Bookmark } from 'lucide-react';
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
      <div className="py-20 text-center rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8">
        <Sparkles className="w-8 h-8 text-zinc-600 dark:text-zinc-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          No Silhouettes Matching Search
        </h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
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
              className={`group relative rounded-lg overflow-hidden cursor-pointer bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all duration-300 ${spanClass}`}
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
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Gradient Backdrop on Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 sm:p-5" />

              {/* Top Tags strip (visible on hover) */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-black/70 text-white backdrop-blur-md border border-white/20">
                  {post.occasion || 'Look'}
                </span>

                <div className="flex items-center gap-1.5 text-white text-xs font-semibold bg-black/70 px-2 py-1 rounded backdrop-blur-md border border-white/20">
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
                    <p className="text-[10px] text-zinc-300 truncate">@{post.user.username}</p>
                  </div>
                </div>

                {post.caption && (
                  <p className="text-xs text-white line-clamp-2 leading-relaxed">
                    &ldquo;{post.caption}&rdquo;
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Post Modal Inspection */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
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
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {selectedPost.user.name}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    @{selectedPost.user.username}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="p-2 min-h-[44px] min-w-[44px] rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-4">
              <div className="rounded-md overflow-hidden aspect-[4/5] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800">
                <img
                  src={resolveImageUrl(selectedPost.image) || FALLBACK_POST_IMAGE}
                  alt={selectedPost.caption}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                  {selectedPost.occasion}
                </span>
                <p className="text-sm sm:text-base text-zinc-900 dark:text-zinc-100 mt-1 leading-relaxed">
                  {selectedPost.caption}
                </p>
              </div>

              {selectedPost.tags && selectedPost.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPost.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Tagged wardrobe items if present */}
              {selectedPost.taggedItems && selectedPost.taggedItems.length > 0 && (
                <div className="pt-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                    Tagged Wardrobe Pieces
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedPost.taggedItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedPost(null);
                          navigate(`/wardrobe/${item.id}`);
                        }}
                        className="flex items-center gap-2 p-2 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-zinc-400"
                      >
                        <img src={item.image} alt={item.name} className="w-8 h-8 rounded object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{item.name}</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{item.category}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => toggleLikePost(selectedPost.id)}
                  className="flex items-center gap-1.5 min-h-[44px] text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
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
                  className="flex items-center gap-1.5 min-h-[44px] text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <Bookmark
                    className={`w-4 h-4 ${
                      selectedPost.isSaved ? 'fill-zinc-900 dark:fill-zinc-100 text-zinc-900 dark:text-zinc-100' : ''
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
                className="min-h-[44px]"
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
