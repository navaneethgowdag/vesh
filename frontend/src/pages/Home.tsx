import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Camera,
  Shirt,
  Users,
  Compass,
  ArrowRight,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { DailyFitWidget } from '../components/feed/DailyFitWidget';
import { PostCard } from '../components/feed/PostCard';
import { DiscoveryDeck } from '../components/feed/DiscoveryDeck';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { Post, OutfitMoment } from '../types';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useCurrentUser();
  const { followingIds, isFollowingUser, refreshData } = useApp();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'for_you' | 'following'>(
    tabParam === 'following' ? 'following' : 'for_you'
  );

  useEffect(() => {
    if (tabParam === 'following' || tabParam === 'for-you') {
      setActiveTab(tabParam === 'following' ? 'following' : 'for_you');
    }
  }, [tabParam]);

  // For You discovery moments (unexpired 24-hour outfit moments)
  const [forYouMoments, setForYouMoments] = useState<OutfitMoment[]>([]);
  const [isLoadingForYou, setIsLoadingForYou] = useState(true);
  const [forYouError, setForYouError] = useState<string | null>(null);

  // Following feed (permanent posts from creators the user follows)
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [followingError, setFollowingError] = useState<string | null>(null);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Load moments
  const loadForYouMoments = useCallback(async () => {
    setIsLoadingForYou(true);
    setForYouError(null);
    try {
      const data = await api.moments.listFeed();
      setForYouMoments(data);
    } catch (err: any) {
      setForYouError(err?.message || 'Failed to load discovery moments.');
    } finally {
      setIsLoadingForYou(false);
    }
  }, []);

  // Load following feed permanent posts
  const loadFollowingPosts = useCallback(async () => {
    setIsLoadingFollowing(true);
    setFollowingError(null);
    try {
      const data = await api.posts.listFeed('following');
      setFollowingPosts(data);
    } catch (err: any) {
      setFollowingError(err?.message || 'Failed to load following feed.');
    } finally {
      setIsLoadingFollowing(false);
    }
  }, []);

  // Reload moments and following feed
  useEffect(() => {
    loadForYouMoments();
    if (activeTab === 'following') {
      loadFollowingPosts();
    }
  }, [loadForYouMoments, loadFollowingPosts, followingIds, activeTab]);

  // Ensure only moments from followed accounts are displayed
  const visibleMoments = forYouMoments.filter(
    (m) => m.user && isFollowingUser(m.user.id)
  );

  const handleDiscoveryLike = async (moment: OutfitMoment) => {
    await api.moments.like(moment.id);
  };

  const handleDiscoverySkip = async (moment: OutfitMoment) => {
    await api.moments.skip(moment.id);
  };

  // Pull to refresh handler
  const handlePullRefresh = async () => {
    await Promise.allSettled([
      activeTab === 'for_you' ? loadForYouMoments() : loadFollowingPosts(),
      refreshData(),
    ]);
  };

  return (
    <AppShell showRightSidebar={true}>
      <PullToRefresh onRefresh={handlePullRefresh}>
        {/* Top Editorial Greeting */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[#C3A36B] dark:text-[#D1B47A] block mb-1 font-sans">
                Curator Journal
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-normal text-[#25211E] dark:text-[#F4F0E8] tracking-tight">
                {getGreeting()}, <span className="italic font-light">{currentUser.name.split(' ')[0]}</span>
              </h1>
            </div>

            {/* Desktop Refresh Button */}
            <button
              onClick={handlePullRefresh}
              aria-label="Refresh feed data"
              title="Refresh feed"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E5DED3] dark:border-[#393832] bg-[#FFFFFF] dark:bg-[#22221F] text-xs text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] shadow-subtle transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFollowing || isLoadingForYou ? 'animate-spin text-[#C3A36B]' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          <p className="text-xs sm:text-sm text-[#82796F] dark:text-[#B2AA9E] mt-1.5 font-sans">
            {activeTab === 'for_you'
              ? "Discover active 24-hour outfit moments from creators you follow."
              : 'Recent permanent looks and editorial ensembles from your network.'}
          </p>
        </div>

        {/* Two Compact Quick-Action Cards: Share Daily Outfit & My Library */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-7">
          {/* Share Daily Outfit Card */}
          <div
            onClick={() => navigate('/create?type=moment')}
            className="group cursor-pointer p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#22221F] hover:bg-[#F7F4EE] dark:hover:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] shadow-subtle hover:shadow-soft transition-all duration-300 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#EFE9DF] dark:bg-[#2A2A26] text-[#25211E] dark:text-[#F4F0E8] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Camera className="w-5 h-5 text-[#C3A36B] dark:text-[#D1B47A]" />
              </div>
              <div>
                <h2 className="font-serif font-medium text-sm text-[#25211E] dark:text-[#F4F0E8] group-hover:text-[#C3A36B] dark:group-hover:text-[#D1B47A] transition-colors">
                  Share Daily Outfit
                </h2>
                <p className="text-[11px] text-[#82796F] dark:text-[#B2AA9E]">
                  Publish a 24-hour outfit moment
                </p>
              </div>
            </div>
            <span className="p-2 rounded-xl bg-[#F7F4EE] dark:bg-[#2A2A26] group-hover:bg-[#25211E] group-hover:text-white dark:group-hover:bg-[#F4F0E8] dark:group-hover:text-[#171715] transition-colors text-[#82796F] dark:text-[#B2AA9E]">
              <PlusCircle className="w-4 h-4" />
            </span>
          </div>

          {/* My Library Card */}
          <div
            onClick={() => navigate('/profile')}
            className="group cursor-pointer p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#22221F] hover:bg-[#F7F4EE] dark:hover:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] shadow-subtle hover:shadow-soft transition-all duration-300 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#EFE9DF] dark:bg-[#2A2A26] text-[#25211E] dark:text-[#F4F0E8] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Shirt className="w-5 h-5 text-[#525744] dark:text-[#8C967E]" />
              </div>
              <div>
                <h2 className="font-serif font-medium text-sm text-[#25211E] dark:text-[#F4F0E8] group-hover:text-[#C3A36B] dark:group-hover:text-[#D1B47A] transition-colors">
                  Capsule Wardrobe
                </h2>
                <p className="text-[11px] text-[#82796F] dark:text-[#B2AA9E]">
                  Catalog pieces & wear history
                </p>
              </div>
            </div>
            <span className="p-2 rounded-xl bg-[#F7F4EE] dark:bg-[#2A2A26] group-hover:bg-[#25211E] group-hover:text-white dark:group-hover:bg-[#F4F0E8] dark:group-hover:text-[#171715] transition-colors text-[#82796F] dark:text-[#B2AA9E]">
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Daily Fit Highlight Teaser */}
        <div className="mb-7">
          <DailyFitWidget />
        </div>

        {/* Feed Tabs: Only "For You" and "Following" */}
        <div className="flex items-center justify-between border-b border-[#E5DED3] dark:border-[#393832] mb-6">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab('for_you')}
              className={`pb-3 text-xs sm:text-sm font-medium tracking-wide transition-all relative ${
                activeTab === 'for_you'
                  ? 'text-[#25211E] dark:text-[#F4F0E8] font-bold'
                  : 'text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8]'
              }`}
            >
              For You · Moments
              {activeTab === 'for_you' && (
                <motion.div
                  layoutId="homeFeedTab"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-[#C3A36B] dark:bg-[#D1B47A]"
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab('following')}
              className={`pb-3 text-xs sm:text-sm font-medium tracking-wide transition-all relative ${
                activeTab === 'following'
                  ? 'text-[#25211E] dark:text-[#F4F0E8] font-bold'
                  : 'text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8]'
              }`}
            >
              Following · Feed
              {activeTab === 'following' && (
                <motion.div
                  layoutId="homeFeedTab"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-[#C3A36B] dark:bg-[#D1B47A]"
                />
              )}
            </button>
          </div>

          {activeTab === 'following' && (
            <button
              onClick={loadFollowingPosts}
              disabled={isLoadingFollowing}
              className="flex items-center gap-1.5 text-xs text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] pb-3 font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFollowing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>

        {/* TAB 1: FOR YOU (Discovery Deck of 24h Moments) */}
        {activeTab === 'for_you' && (
          <div className="w-full">
            {forYouError ? (
              <div className="text-center py-16 px-4 bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl border border-[#E5DED3] dark:border-[#393832] shadow-subtle max-w-md mx-auto">
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">Discovery Moments Unavailable</p>
                <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mb-4">{forYouError}</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={loadForYouMoments}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <DiscoveryDeck
                moments={visibleMoments}
                onLike={handleDiscoveryLike}
                onSkip={handleDiscoverySkip}
                onRefresh={loadForYouMoments}
                isLoading={isLoadingForYou}
              />
            )}
          </div>
        )}

        {/* TAB 2: FOLLOWING FEED (Permanent Lookbook Posts) */}
        {activeTab === 'following' && (
          <div className="w-full">
            {isLoadingFollowing ? (
              <div className="space-y-6">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl border border-[#E5DED3] dark:border-[#393832] p-4 space-y-4 animate-pulse shadow-subtle"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#EFE9DF] dark:bg-[#2A2A26]" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3.5 w-28 bg-[#EFE9DF] dark:bg-[#2A2A26] rounded-md" />
                        <div className="h-2.5 w-20 bg-[#EFE9DF] dark:bg-[#2A2A26] rounded-md" />
                      </div>
                    </div>
                    <div className="aspect-[4/5] bg-[#EFE9DF] dark:bg-[#2A2A26] rounded-xl" />
                    <div className="h-3 w-48 bg-[#EFE9DF] dark:bg-[#2A2A26] rounded-md" />
                  </div>
                ))}
              </div>
            ) : followingError ? (
              <div className="text-center py-16 px-4 bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl border border-[#E5DED3] dark:border-[#393832] shadow-subtle max-w-md mx-auto">
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">Following Feed Unavailable</p>
                <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mb-4">{followingError}</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={loadFollowingPosts}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Retry
                </Button>
              </div>
            ) : followingPosts.length === 0 ? (
              <div className="text-center py-20 px-6 bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl border border-[#E5DED3] dark:border-[#393832] shadow-subtle">
                <div className="w-14 h-14 rounded-2xl bg-[#EFE9DF] dark:bg-[#2A2A26] flex items-center justify-center text-[#C3A36B] dark:text-[#D1B47A] mx-auto mb-4">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-xl font-normal text-[#25211E] dark:text-[#F4F0E8] mb-1">
                  Your Following Feed is Empty
                </h3>
                <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] max-w-sm mx-auto mb-6 font-sans">
                  Follow style curators and tastemakers in Explore to see their permanent lookbook posts here.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => navigate('/explore')}
                    icon={<Compass className="w-4 h-4" />}
                  >
                    Discover Tastemakers
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {followingPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        )}
      </PullToRefresh>
    </AppShell>
  );
};
