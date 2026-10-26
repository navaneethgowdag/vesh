import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, RefreshCw, Compass, AlertCircle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useApp, useCurrentUser } from '../../context/AppContext';
import { api } from '../../services/api';
import { Post } from '../../types';
import { StoryViewerModal } from './StoryViewerModal';

export const Stories: React.FC = () => {
  const { toggleLikePost } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const [stories, setStories] = useState<Post[]>([]);
  const [myStories, setMyStories] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [viewerStories, setViewerStories] = useState<Post[]>([]);

  // Fetch active 24h stories strictly from followed accounts only, plus own active stories
  const fetchStories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [followingStories, ownStories] = await Promise.all([
        api.posts.getStories().catch(() => []),
        api.posts.getMyStories().catch(() => []),
      ]);
      setStories(followingStories || []);
      setMyStories(ownStories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load stories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Group followed stories by creator so each creator displays as one story circle
  const uniqueCreatorStories = React.useMemo(() => {
    const map = new Map<string, Post>();
    for (const s of stories) {
      if (!map.has(s.user.id)) {
        map.set(s.user.id, s);
      }
    }
    return Array.from(map.values());
  }, [stories]);

  const handleOpenFollowedStory = (index: number) => {
    setViewerStories(uniqueCreatorStories);
    setSelectedStoryIndex(index);
  };

  const handleOpenMyStory = () => {
    if (myStories.length > 0) {
      setViewerStories(myStories);
      setSelectedStoryIndex(0);
    } else {
      navigate('/create?type=story');
    }
  };

  const handleCloseStory = () => {
    setSelectedStoryIndex(null);
  };

  const handleLikePost = async (postId: string) => {
    await toggleLikePost(postId);
    setStories((prev) =>
      prev.map((s) =>
        s.id === postId
          ? { ...s, isLiked: true, likesCount: s.isLiked ? s.likesCount : s.likesCount + 1 }
          : s
      )
    );
  };

  return (
    <>
      {/* Error Banner with Retry */}
      {error && !isLoading && (
        <div className="flex items-center justify-between p-3 mb-4 bg-sand-100 border border-sand-200 rounded-2xl text-xs text-charcoal-700 shadow-soft-xs">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-4 h-4 text-cognac-600 flex-shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            onClick={fetchStories}
            className="flex items-center gap-1 font-semibold text-cognac-700 hover:text-cognac-900 ml-3 flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Stories Rail */}
      <div className="flex items-center gap-4 overflow-x-auto pb-4 mb-6 hide-scrollbar">
        {/* Your Outfit Story Action */}
        <div className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group">
          <div
            onClick={handleOpenMyStory}
            className={`relative w-14 h-14 rounded-full p-0.5 transition-all flex items-center justify-center bg-cream-50 ${
              myStories.length > 0
                ? 'ring-2 ring-cognac-600 ring-offset-2 ring-offset-cream-50 shadow-soft-xs'
                : 'border-2 border-dashed border-sand-300 group-hover:border-cognac-600'
            }`}
          >
            <Avatar src={currentUser.avatar} alt={currentUser.name} size="sm" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/create?type=story');
              }}
              title="Add 24h story"
              className="absolute bottom-0 right-0 w-4 h-4 bg-cognac-600 hover:bg-cognac-700 text-white rounded-full flex items-center justify-center text-xs shadow transition-transform hover:scale-110"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <span className="text-[11px] font-medium text-charcoal-700">
            {myStories.length > 0 ? 'Your Story' : 'Post Fit'}
          </span>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="flex items-center gap-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-sand-200" />
                <div className="w-10 h-2 rounded bg-sand-200" />
              </div>
            ))}
          </div>
        )}

        {/* Real User Outfit Stories (Accounts Authenticated User Follows) */}
        {!isLoading &&
          uniqueCreatorStories.map((story, idx) => (
            <div
              key={story.id}
              onClick={() => handleOpenFollowedStory(idx)}
              className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group"
            >
              <div className="relative w-14 h-14 rounded-full p-0.5 ring-2 ring-cognac-500/80 group-hover:ring-cognac-700 group-hover:scale-105 transition-all flex items-center justify-center bg-cream-50 shadow-soft-xs">
                <Avatar
                  src={story.user.avatar}
                  alt={story.user.name}
                  size="sm"
                  isVerified={story.user.isVerified}
                />
              </div>
              <span className="text-[11px] font-medium text-charcoal-700 truncate max-w-[64px]">
                {story.user.name.split(' ')[0]}
              </span>
            </div>
          ))}

        {/* Empty State when no followed accounts have stories */}
        {!isLoading && !error && uniqueCreatorStories.length === 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-sand-50/70 border border-sand-200/70 rounded-2xl flex-shrink-0">
            <span className="text-xs text-charcoal-500">
              No active stories from accounts you follow.
            </span>
            <Link
              to="/explore"
              className="flex items-center gap-1 text-xs font-semibold text-cognac-600 hover:text-cognac-800 transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Find creators</span>
            </Link>
          </div>
        )}
      </div>

      {/* Story Viewer Modal */}
      {selectedStoryIndex !== null && viewerStories.length > 0 && (
        <StoryViewerModal
          stories={viewerStories}
          initialIndex={selectedStoryIndex}
          isOpen={selectedStoryIndex !== null}
          onClose={handleCloseStory}
          onLike={handleLikePost}
        />
      )}
    </>
  );
};
