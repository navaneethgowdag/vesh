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
  BarChart2,
  Plus,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { DailyFitWidget } from '../components/feed/DailyFitWidget';
import { PostCard } from '../components/feed/PostCard';
import { DiscoveryDeck } from '../components/feed/DiscoveryDeck';
import { PollWidget } from '../components/social/PollWidget';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { Post, OutfitMoment, Poll } from '../types';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useCurrentUser();
  const { followingIds, isFollowingUser, refreshData } = useApp();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'for_you' | 'following' | 'polls'>(
    tabParam === 'following' ? 'following' : tabParam === 'polls' ? 'polls' : 'for_you'
  );

  useEffect(() => {
    if (tabParam === 'following' || tabParam === 'for-you' || tabParam === 'polls') {
      setActiveTab(tabParam === 'following' ? 'following' : tabParam === 'polls' ? 'polls' : 'for_you');
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

  // Community Polls feed
  const [pollsList, setPollsList] = useState<Poll[]>([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);
  const [pollsError, setPollsError] = useState<string | null>(null);

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

  // Load community polls
  const loadPolls = useCallback(async () => {
    setIsLoadingPolls(true);
    setPollsError(null);
    try {
      const data = await api.polls.list();
      setPollsList(data);
    } catch (err: any) {
      setPollsError(err?.message || 'Failed to load community polls.');
    } finally {
      setIsLoadingPolls(false);
    }
  }, []);

  // Reload moments and following feed
  useEffect(() => {
    loadForYouMoments();
    if (activeTab === 'following') {
      loadFollowingPosts();
    } else if (activeTab === 'polls') {
      loadPolls();
    }
  }, [loadForYouMoments, loadFollowingPosts, loadPolls, followingIds, activeTab]);

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
        {/* Top Greeting */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                Curator Feed
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {getGreeting()}, <span>{currentUser.name.split(' ')[0]}</span>
              </h1>
            </div>

            {/* Desktop Refresh Button */}
            <button
              onClick={handlePullRefresh}
              aria-label="Refresh feed data"
              title="Refresh feed"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFollowing || isLoadingForYou ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5">
            {activeTab === 'for_you'
              ? 'Discover active 24-hour outfit moments from creators you follow.'
              : 'Recent permanent looks and outfits from your network.'}
          </p>
        </div>

        {/* Two Quick-Action Cards: Share Daily Outfit & My Library */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-7">
          {/* Share Daily Outfit Card */}
          <div
            onClick={() => navigate('/create?type=moment')}
            className="group cursor-pointer p-4 sm:p-5 rounded-md bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all duration-200 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
                <Camera className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:underline">
                  Share Daily Outfit
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Publish a 24-hour outfit moment
                </p>
              </div>
            </div>
            <span className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <PlusCircle className="w-4 h-4" />
            </span>
          </div>

          {/* My Library Card */}
          <div
            onClick={() => navigate('/profile')}
            className="group cursor-pointer p-4 sm:p-5 rounded-md bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all duration-200 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
                <Shirt className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:underline">
                  Capsule Wardrobe
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Catalog pieces & wear history
                </p>
              </div>
            </div>
            <span className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Daily Fit Highlight Teaser */}
        <div className="mb-7">
          <DailyFitWidget />
        </div>

        {/* Feed Tabs: "For You", "Following", "Polls" */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 mb-6">
          <div className="flex items-center gap-6 sm:gap-8">
            <button
              onClick={() => setActiveTab('for_you')}
              className={`pb-3 min-h-[44px] text-xs sm:text-sm font-medium tracking-wide transition-all relative ${
                activeTab === 'for_you'
                  ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              For You · Moments
              {activeTab === 'for_you' && (
                <motion.div
                  layoutId="homeFeedTab"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-zinc-900 dark:bg-zinc-100"
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab('following')}
              className={`pb-3 min-h-[44px] text-xs sm:text-sm font-medium tracking-wide transition-all relative ${
                activeTab === 'following'
                  ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Following · Feed
              {activeTab === 'following' && (
                <motion.div
                  layoutId="homeFeedTab"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-zinc-900 dark:bg-zinc-100"
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab('polls')}
              className={`pb-3 min-h-[44px] text-xs sm:text-sm font-medium tracking-wide transition-all relative ${
                activeTab === 'polls'
                  ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Polls · Community
              {activeTab === 'polls' && (
                <motion.div
                  layoutId="homeFeedTab"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-zinc-900 dark:bg-zinc-100"
                />
              )}
            </button>
          </div>

          {activeTab === 'following' && (
            <button
              onClick={loadFollowingPosts}
              disabled={isLoadingFollowing}
              className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 pb-3 min-h-[44px] font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFollowing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {activeTab === 'polls' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/create?type=poll')}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ask Poll</span>
              </button>
              <button
                onClick={loadPolls}
                disabled={isLoadingPolls}
                className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 pb-3 min-h-[44px] font-medium transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPolls ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: FOR YOU (Discovery Deck of 24h Moments) */}
        {activeTab === 'for_you' && (
          <div className="w-full">
            {forYouError ? (
              <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-md mx-auto">
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">Discovery Moments Unavailable</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">{forYouError}</p>
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
                    className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 p-4 space-y-4 animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3.5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
                        <div className="h-2.5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      </div>
                    </div>
                    <div className="aspect-[4/5] bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            ) : followingError ? (
              <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-md mx-auto">
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">Following Feed Unavailable</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">{followingError}</p>
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
              <div className="text-center py-20 px-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="w-14 h-14 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mx-auto mb-4">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                  Your Following Feed is Empty
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto mb-6">
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

        {/* Community Polls Feed Tab */}
        {activeTab === 'polls' && (
          <div className="space-y-6">
            {isLoadingPolls ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse space-y-3"
                  >
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                    <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                    <div className="space-y-2 pt-2">
                      <div className="h-9 bg-zinc-100 dark:bg-zinc-800 rounded w-full" />
                      <div className="h-9 bg-zinc-100 dark:bg-zinc-800 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pollsError ? (
              <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-md mx-auto">
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">Polls Unavailable</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">{pollsError}</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={loadPolls}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Retry
                </Button>
              </div>
            ) : pollsList.length === 0 ? (
              <div className="text-center py-20 px-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="w-14 h-14 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mx-auto mb-4">
                  <BarChart2 className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                  No Active Community Polls
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto mb-6">
                  Be the first to ask the fashion community a question about styling, outfit pairings, or wardrobe choices.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => navigate('/create?type=poll')}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    Create a Poll
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {pollsList.map((p) => (
                  <div
                    key={p.id}
                    className="p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3"
                  >
                    {/* Creator Header */}
                    {p.creator && (
                      <div
                        onClick={() => navigate(`/profile/${p.creator?.username}`)}
                        className="flex items-center gap-2.5 cursor-pointer group"
                      >
                        <Avatar
                          src={p.creator.avatar}
                          alt={p.creator.name || p.creator.username}
                          size="sm"
                          isVerified={p.creator.is_verified}
                        />
                        <div>
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:underline">
                            {p.creator.name || p.creator.username}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            @{p.creator.username}
                          </p>
                        </div>
                      </div>
                    )}

                    <PollWidget poll={p} onVoteSuccess={(updated) => {
                      setPollsList((prev) => prev.map((item) => item.id === updated.id ? updated : item));
                    }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </PullToRefresh>
    </AppShell>
  );
};
