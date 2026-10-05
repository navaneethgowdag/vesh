import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Plus, Compass, TrendingUp, Flame } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { DailyFitWidget } from '../components/feed/DailyFitWidget';
import { PostCard } from '../components/feed/PostCard';
import { Avatar } from '../components/ui/Avatar';
import { useApp, useCurrentUser } from '../context/AppContext';

export const Home: React.FC = () => {
  const { posts, allCreators } = useApp();
  const currentUser = useCurrentUser();
  const [activeTab, setActiveTab] = useState<'for_you' | 'following' | 'trending'>('for_you');
  const navigate = useNavigate();

  // Filter posts based on active tab
  const filteredPosts = posts.filter((post) => {
    if (activeTab === 'following') {
      return post.user.isFollowing || post.user.id === currentUser.id;
    }
    if (activeTab === 'trending') {
      return post.likesCount > 500;
    }
    return true;
  });

  return (
    <AppShell showRightSidebar={true}>
      {/* Top Greeting */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
          Good morning, {currentUser.name.split(' ')[0]} 👋
        </h1>
        <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
          What are you wearing today? Here is your personalized daily styling rotation.
        </p>
      </div>

      {/* Stories / Active Tastemakers Row */}
      <div className="flex items-center gap-4 overflow-x-auto pb-4 mb-6 hide-scrollbar">
        {/* Your Outfit Story */}
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

        {/* Other Creators Stories */}
        {allCreators.map((creator) => (
          <div
            key={creator.id}
            onClick={() => navigate(`/profile/${creator.username}`)}
            className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group"
          >
            <div className="w-14 h-14 rounded-full p-0.5 ring-2 ring-cognac-500/70 group-hover:ring-cognac-700 transition-all flex items-center justify-center bg-cream-50">
              <Avatar src={creator.avatar} alt={creator.name} size="sm" isVerified={creator.isVerified} />
            </div>
            <span className="text-[11px] font-medium text-charcoal-700 truncate max-w-[64px]">
              {creator.username.split('.')[0]}
            </span>
          </div>
        ))}
      </div>

      {/* Daily Fit Highlight Card */}
      <DailyFitWidget />

      {/* Social Feed Tabs */}
      <div className="flex items-center justify-between border-b border-sand-200/80 mb-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('for_you')}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wide transition-all relative ${
              activeTab === 'for_you'
                ? 'text-charcoal-950 font-bold'
                : 'text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            For You
            {activeTab === 'for_you' && (
              <motion.div
                layoutId="feedTab"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-charcoal-900"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('following')}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wide transition-all relative ${
              activeTab === 'following'
                ? 'text-charcoal-950 font-bold'
                : 'text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            Following
            {activeTab === 'following' && (
              <motion.div
                layoutId="feedTab"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-charcoal-900"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('trending')}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wide transition-all relative flex items-center gap-1.5 ${
              activeTab === 'trending'
                ? 'text-charcoal-950 font-bold'
                : 'text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-cognac-600" />
            Trending
            {activeTab === 'trending' && (
              <motion.div
                layoutId="feedTab"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-charcoal-900"
              />
            )}
          </button>
        </div>

        <button
          onClick={() => navigate('/create')}
          className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-cognac-700 hover:text-cognac-900 pb-3"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Post</span>
        </button>
      </div>

      {/* Feed Posts */}
      <div className="space-y-6">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16 bg-cream-50 rounded-3xl border border-sand-200">
            <p className="text-sm font-bold text-charcoal-800">No posts in this feed yet</p>
            <p className="text-xs text-charcoal-500 mt-1">
              Follow more creators in Explore or share your first look!
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </AppShell>
  );
};

