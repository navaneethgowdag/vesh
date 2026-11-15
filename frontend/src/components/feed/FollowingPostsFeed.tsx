import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Compass, RefreshCw } from 'lucide-react';
import { Post } from '../../types';
import { api } from '../../services/api';
import { EditorialPostCard } from './EditorialPostCard';
import { Button } from '../ui/Button';

interface FollowingPostsFeedProps {
  className?: string;
}

export const FollowingPostsFeed: React.FC<FollowingPostsFeedProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [offset, setOffset] = useState<number>(0);

  const PAGE_SIZE = 10;

  // Load Initial Following Feed
  const loadInitialFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.posts.listFeed('following', PAGE_SIZE, 0);
      setPosts(data);
      setOffset(data.length);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      console.warn('Failed to load following posts feed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  // Load More Posts (Pagination)
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextBatch = await api.posts.listFeed('following', PAGE_SIZE, offset);
      if (nextBatch.length === 0) {
        setHasMore(false);
      } else {
        setPosts((prev) => {
          // De-duplicate posts by ID
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = nextBatch.filter((p) => !existingIds.has(p.id));
          return [...prev, ...fresh];
        });
        setOffset((prev) => prev + nextBatch.length);
        if (nextBatch.length < PAGE_SIZE) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.warn('Failed to load more posts:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handlePostDeleted = (deletedId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  return (
    <section className={`space-y-6 ${className}`}>
      {/* Editorial Section Heading */}
      <div className="pb-2 border-b border-[#EAE3D8] dark:border-[#36322D]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#75624D] dark:text-[#C2AB95]">
            CURATED FEED
          </span>
          <span className="text-[#B8A99A]">·</span>
          <span className="text-[11px] font-sans text-[#A68B72] dark:text-[#B8A99A] italic">
            Following Only
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-serif font-normal text-[#25231F] dark:text-[#F8F6F1] tracking-tight leading-tight">
          From Your Circle
        </h2>
        <p className="text-xs sm:text-sm font-sans text-[#A68B72] dark:text-[#B8A99A] mt-1">
          Style inspiration from people you follow.
        </p>
      </div>

      {/* Feed Content */}
      {isLoading ? (
        // Initial Loading Skeletons
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[4px] bg-[#FFFFFF] dark:bg-[#211E1B] border border-[#EAE3D8] dark:border-[#36322D] p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EAE3D8]/70 dark:bg-[#36322D]/60" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-32 h-3.5 rounded-[2px] bg-[#EAE3D8]/70 dark:bg-[#36322D]/60" />
                  <div className="w-20 h-2.5 rounded-[2px] bg-[#EAE3D8]/70 dark:bg-[#36322D]/60" />
                </div>
              </div>
              <div className="w-full aspect-[4/5] rounded-[2px] bg-[#EAE3D8]/50 dark:bg-[#36322D]/40" />
            </div>
          ))}
        </div>
      ) : posts.length > 0 ? (
        // Feed List
        <div className="space-y-8">
          {posts.map((post) => (
            <EditorialPostCard
              key={post.id}
              post={post}
              onDelete={handlePostDeleted}
            />
          ))}

          {/* Load More Pagination */}
          {hasMore && (
            <div className="text-center pt-2 pb-6">
              <Button
                variant="outline"
                size="md"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="font-sans uppercase tracking-[0.14em] text-xs border-[#B8A99A] dark:border-[#4A443E]"
                icon={
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoadingMore ? 'animate-spin' : ''}`}
                  />
                }
              >
                {isLoadingMore ? 'Loading Posts...' : 'Load More Outfits'}
              </Button>
            </div>
          )}

          {!hasMore && posts.length > 3 && (
            <p className="text-center text-xs text-[#A68B72] dark:text-[#B8A99A] font-sans py-4">
              You are all caught up with your circle.
            </p>
          )}
        </div>
      ) : (
        // Empty State: No followed users have posted
        <div className="rounded-[4px] bg-[#FFFFFF] dark:bg-[#211E1B] border border-[#EAE3D8] dark:border-[#36322D] p-10 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-[2px] bg-[#F8F6F1] dark:bg-[#181614] border border-[#EAE3D8] dark:border-[#36322D] flex items-center justify-center mx-auto text-[#75624D] dark:text-[#C2AB95]">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif text-2xl text-[#25231F] dark:text-[#F8F6F1]">
              Your circle is quiet for now.
            </h3>
            <p className="text-xs sm:text-sm text-[#A68B72] dark:text-[#B8A99A] max-w-sm mx-auto font-sans leading-relaxed">
              Posts from people you follow will appear here.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/discover')}
              className="font-sans uppercase tracking-[0.14em] text-xs border-[#B8A99A] dark:border-[#4A443E]"
              icon={<Compass className="w-3.5 h-3.5" />}
            >
              Discover Creators
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};
