import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useApp, useCurrentUser } from '../../context/AppContext';
import { api } from '../../services/api';
import { Post } from '../../types';
import { StoryViewerModal } from './StoryViewerModal';

export const Stories: React.FC = () => {
  const { posts, toggleLikePost } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const [stories, setStories] = useState<Post[]>([]);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);

  // Load real stories from backend; fallback to posts that have valid images
  useEffect(() => {
    let cancelled = false;
    api.posts
      .getStories()
      .then((data) => {
        if (!cancelled && data && data.length > 0) {
          setStories(data);
        } else if (!cancelled) {
          // If stories endpoint returned empty, extract recent image posts from current feed
          const imagePosts = posts.filter((p) => Boolean(p.image));
          setStories(imagePosts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const imagePosts = posts.filter((p) => Boolean(p.image));
          setStories(imagePosts);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [posts]);

  // Group stories by creator so each creator displays as one story circle
  const uniqueCreatorStories = React.useMemo(() => {
    const map = new Map<string, Post>();
    for (const s of stories) {
      if (!map.has(s.user.id)) {
        map.set(s.user.id, s);
      }
    }
    return Array.from(map.values());
  }, [stories]);

  const handleOpenStory = (index: number) => {
    setSelectedStoryIndex(index);
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
      <div className="flex items-center gap-4 overflow-x-auto pb-4 mb-6 hide-scrollbar">
        {/* Your Outfit Story Action */}
        <div
          onClick={() => navigate('/create')}
          className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group"
        >
          <div className="relative w-14 h-14 rounded-full p-0.5 border-2 border-dashed border-sand-300 group-hover:border-cognac-600 transition-colors flex items-center justify-center bg-cream-50">
            <Avatar src={currentUser.avatar} alt={currentUser.name} size="sm" />
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-cognac-600 text-white rounded-full flex items-center justify-center text-xs shadow">
              <Plus className="w-3 h-3" />
            </span>
          </div>
          <span className="text-[11px] font-medium text-charcoal-700">Post Fit</span>
        </div>

        {/* Real User Outfit Stories */}
        {uniqueCreatorStories.map((story, idx) => (
          <div
            key={story.id}
            onClick={() => handleOpenStory(idx)}
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
      </div>

      {/* Story Viewer Modal */}
      {selectedStoryIndex !== null && (
        <StoryViewerModal
          stories={uniqueCreatorStories}
          initialIndex={selectedStoryIndex}
          isOpen={selectedStoryIndex !== null}
          onClose={handleCloseStory}
          onLike={handleLikePost}
        />
      )}
    </>
  );
};

